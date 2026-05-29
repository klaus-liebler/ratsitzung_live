import express from "express";
import QRCode from "qrcode";
import path from "node:path";
import XLSX from "xlsx";
import {
  addSpeechOnBehalf,
  checkInParticipant,
  checkOutParticipant,
  deleteSpeech,
  findParticipantByToken,
  finishSpeech,
  getAllParticipants,
  getCompletedSessions,
  getDashboardState,
  getRandomParticipant,
  getSessionSummary,
  moveSpeech,
  pauseSpeech,
  requestSpeech,
  startCommitteeSession,
  startSpeech,
  stopCommitteeSession,
  withdrawSpeech,
  type Participant,
  type SessionSummary
} from "./db/index";

const app = express();
const publicDir = path.join(__dirname, "..", "public");
const vendorDir = path.join(__dirname, "..", "node_modules");

app.use(express.json());
app.use("/vendor", express.static(vendorDir));
app.use(express.static(publicDir));

function escapeForHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getBaseUrl(req: express.Request): string {
  const host = req.get("host") ?? "localhost:3000";
  return `${req.protocol}://${host}`;
}

function renderShell(payload: {
  pageMode: "member" | "chair";
  status: "authorized" | "unauthorized";
  participant?: Participant;
  token?: string;
  qrCodeDataUrl: string;
  qrTargetUrl: string;
}): string {
  const data = toInlineJson(payload);
  const firstName = payload.participant?.firstName?.trim();
  const safeFirstName = firstName ? escapeForHtml(firstName) : "Gast";
  const pageTitle = payload.pageMode === "chair"
    ? `RatLive Chair (${safeFirstName})`
    : payload.status === "authorized"
      ? `RatLive Dashboard (${safeFirstName})`
      : "RatLive Dashboard (Anmeldung)";

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <script type="importmap">
      {
        "imports": {
          "lit": "/vendor/lit/index.js",
          "lit-html": "/vendor/lit-html/lit-html.js",
          "lit-html/is-server.js": "/vendor/lit-html/is-server.js",
          "@lit/reactive-element": "/vendor/@lit/reactive-element/reactive-element.js",
          "lit-element/lit-element.js": "/vendor/lit-element/lit-element.js"
        }
      }
    </script>
  </head>
  <body>
    <ratsitzung-app></ratsitzung-app>
    <script>window.__RATSITZUNG_DATA__ = ${data};</script>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}

function getTokenFromRequest(req: express.Request): string {
  if (typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  const headerToken = req.header("x-auth-token");
  return headerToken ? headerToken.trim() : "";
}

function requireParticipant(req: express.Request): Participant {
  const token = getTokenFromRequest(req);
  if (!token) {
    throw new Error("Missing token");
  }

  const participant = findParticipantByToken(token);
  if (!participant) {
    throw new Error("Invalid token");
  }

  return participant;
}

function requireChairParticipant(req: express.Request): Participant {
  const participant = requireParticipant(req);
  if (participant.memberFunction !== "Ratsmitglied" || participant.chairedBodies.length === 0) {
    throw new Error("Chair access required");
  }

  return participant;
}

function handleApiError(res: express.Response, error: unknown): void {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unknown error";
  const statusCode = message === "Missing token" || message === "Invalid token" ? 401 : message === "Chair access required" ? 403 : 400;
  res.status(statusCode).json({ ok: false, error: message, stack: error instanceof Error ? error.stack : undefined });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("de-DE");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("de-DE");
}

function formatDateForFilename(value: string | null): string {
  if (!value) {
    return "0000-00-00";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "0000-00-00";
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeFileNameSegment(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Sitzung";
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function toTsvRow(cells: string[]): string {
  return cells.map((cell) => cell.replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t");
}

function toCsvRow(cells: string[]): string {
  return cells
    .map((cell) => {
      const escaped = cell.replace(/"/g, '""');
      return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
    })
    .join(",");
}

function buildSessionReportData(selectedSession: SessionSummary): {
  factionSectionsHtml: string;
  speechRowsHtml: string;
  factionStatsRowsHtml: string;
  attendeesTsvLines: string[];
  speechesTsvLines: string[];
  speeches: SessionSummary["speeches"];
  longestSpeaker: { name: string; seconds: number } | undefined;
  factionTotals: Array<{ faction: string; seconds: number }>;
  chartData: Array<{ label: string; seconds: number; color: string }>;
} {
  const attendeesByFaction = selectedSession.attendees.reduce<Record<string, typeof selectedSession.attendees>>((acc, attendee) => {
    const faction = attendee.faction ?? "Ohne Fraktion";
    if (!acc[faction]) {
      acc[faction] = [];
    }
    acc[faction].push(attendee);
    return acc;
  }, {});

  const factionSectionsHtml = Object.entries(attendeesByFaction)
    .sort(([a], [b]) => a.localeCompare(b, "de"))
    .map(([faction, attendees]) => {
      const rows = attendees
        .map(
          (attendee) => `<tr>
            <td>${escapeForHtml(attendee.firstName)}</td>
            <td>${escapeForHtml(attendee.lastName)}</td>
            <td>${escapeForHtml(attendee.memberFunction)}</td>
            <td>${escapeForHtml(formatDateTime(attendee.checkedInAt))}</td>
            <td>${escapeForHtml(formatDateTime(attendee.checkedOutAt))}</td>
          </tr>`
        )
        .join("\n");

      return `<section class="report-block">
        <h3>Fraktion: ${escapeForHtml(faction)}</h3>
        <table>
          <thead>
            <tr>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>Funktion</th>
              <th>Eingebucht</th>
              <th>Ausgebucht</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join("\n");

  const speeches = [...selectedSession.speeches].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const speechRowsHtml = speeches
    .map(
      (speech) => `<tr>
        <td>${speech.sequenceNumber}</td>
        <td>${escapeForHtml(`${speech.firstName} ${speech.lastName}`)}</td>
        <td>${escapeForHtml(speech.faction ?? "Ohne Fraktion")}</td>
        <td>${escapeForHtml(speech.status)}</td>
        <td>${escapeForHtml(formatDateTime(speech.requestedAt))}</td>
        <td>${escapeForHtml(formatDateTime(speech.finishedAt))}</td>
        <td>${escapeForHtml(formatSeconds(speech.effectiveSpeakingSeconds))}</td>
      </tr>`
    )
    .join("\n");

  const speakerTotalsMap = new Map<string, { name: string; seconds: number }>();
  for (const speech of speeches) {
    if (speech.status === "DELETED") {
      continue;
    }
    const existing = speakerTotalsMap.get(speech.participantToken) ?? { name: `${speech.firstName} ${speech.lastName}`, seconds: 0 };
    existing.seconds += speech.effectiveSpeakingSeconds;
    speakerTotalsMap.set(speech.participantToken, existing);
  }

  const speakerTotals = [...speakerTotalsMap.values()].sort((a, b) => b.seconds - a.seconds);
  const longestSpeaker = speakerTotals[0];

  const factionTotalsMap = new Map<string, number>();
  for (const speech of speeches) {
    if (speech.status === "DELETED") {
      continue;
    }
    const key = speech.faction ?? "Ohne Fraktion";
    factionTotalsMap.set(key, (factionTotalsMap.get(key) ?? 0) + speech.effectiveSpeakingSeconds);
  }

  const factionTotals = [...factionTotalsMap.entries()]
    .map(([faction, seconds]) => ({ faction, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const chartColors = ["#0b84f3", "#f39c12", "#27ae60", "#e74c3c", "#8e44ad", "#16a085", "#7f8c8d"];
  const chartData = factionTotals.map((entry, index) => ({ label: entry.faction, seconds: entry.seconds, color: chartColors[index % chartColors.length] }));

  const factionStatsRowsHtml = factionTotals
    .map(
      (entry) => `<tr>
        <td>${escapeForHtml(entry.faction)}</td>
        <td>${escapeForHtml(formatSeconds(entry.seconds))}</td>
      </tr>`
    )
    .join("\n");

  const attendeesTsvLines = [
    toTsvRow(["Fraktion", "Vorname", "Nachname", "Funktion", "Eingebucht", "Ausgebucht"]),
    ...selectedSession.attendees.map((attendee) =>
      toTsvRow([
        attendee.faction ?? "Ohne Fraktion",
        attendee.firstName,
        attendee.lastName,
        attendee.memberFunction,
        formatDateTime(attendee.checkedInAt),
        formatDateTime(attendee.checkedOutAt)
      ])
    )
  ];

  const speechesTsvLines = [
    toTsvRow(["Sequence", "Name", "Fraktion", "Status", "RequestedAt", "FinishedAt", "Redezeit"]),
    ...speeches.map((speech) =>
      toTsvRow([
        String(speech.sequenceNumber),
        `${speech.firstName} ${speech.lastName}`,
        speech.faction ?? "Ohne Fraktion",
        speech.status,
        formatDateTime(speech.requestedAt),
        formatDateTime(speech.finishedAt),
        formatSeconds(speech.effectiveSpeakingSeconds)
      ])
    )
  ];

  return {
    factionSectionsHtml,
    speechRowsHtml,
    factionStatsRowsHtml,
    attendeesTsvLines,
    speechesTsvLines,
    speeches,
    longestSpeaker,
    factionTotals,
    chartData
  };
}

function renderPieChartSvg(entries: Array<{ label: string; seconds: number; color: string }>): string {
  const total = entries.reduce((sum, entry) => sum + entry.seconds, 0);
  if (total <= 0) {
    return `<p>Keine Redezeit vorhanden.</p>`;
  }

  const radius = 120;
  const cx = 140;
  const cy = 140;
  let startAngle = -Math.PI / 2;

  const slices = entries
    .map((entry) => {
      const fraction = entry.seconds / total;
      const endAngle = startAngle + fraction * Math.PI * 2;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArc = fraction > 0.5 ? 1 : 0;

      const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      startAngle = endAngle;
      return `<path d="${path}" fill="${entry.color}"></path>`;
    })
    .join("\n");

  const legend = entries
    .map((entry) => {
      const percent = ((entry.seconds / total) * 100).toFixed(1);
      return `<li><span style="display:inline-block;width:12px;height:12px;background:${entry.color};margin-right:8px;"></span>${escapeForHtml(entry.label)}: ${formatSeconds(entry.seconds)} (${percent}%)</li>`;
    })
    .join("\n");

  return `
    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
      <svg width="280" height="280" viewBox="0 0 280 280" role="img" aria-label="Tortendiagramm Redezeit">
        ${slices}
      </svg>
      <ul style="margin:0;padding-left:16px;line-height:1.6;">
        ${legend}
      </ul>
    </div>
  `;
}

function renderApiDocsPage(baseUrl: string): string {
  const endpoints = [
    {
      method: "GET",
      path: "/api/state",
      auth: "token via query string or x-auth-token header",
      description: "Liefert den aktuellen Nutzer, seine Vorsitzrechte, laufende Sitzungen und die aktive Redeliste."
    },
    {
      method: "POST",
      path: "/api/committees/:committeeId/sessions/start",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Startet eine Sitzung eines Gremiums und bucht den Vorsitzenden automatisch ein."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/stop",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Stoppt eine Sitzung, bucht alle Teilnehmer aus und beendet aktive Redebeiträge."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/attendance/check-in",
      auth: "beliebiges berechtigtes Mitglied",
      description: "Bucht das Mitglied in eine laufende Sitzung ein."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/attendance/check-out",
      auth: "beliebiges berechtigtes Mitglied",
      description: "Bucht das Mitglied aus einer laufenden Sitzung aus."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/speeches/request",
      auth: "eingebuchtes Mitglied",
      description: "Meldet einen Redebeitrag für das eigene Mitglied in die FIFO-Redeliste."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/speeches/withdraw",
      auth: "eingebuchtes Mitglied",
      description: "Zieht den eigenen gemeldeten oder pausierten Redebeitrag zurück."
    },
    {
      method: "POST",
      path: "/api/sessions/:sessionId/speeches/add",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Legt stellvertretend einen Redebeitrag fuer einen anderen Teilnehmenden an."
    },
    {
      method: "POST",
      path: "/api/speeches/:speechId/move",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Verschiebt einen Redebeitrag hoch, runter oder ganz nach oben."
    },
    {
      method: "POST",
      path: "/api/speeches/:speechId/start",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Startet einen Redebeitrag und beginnt die Zeitmessung."
    },
    {
      method: "POST",
      path: "/api/speeches/:speechId/pause",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Pausiert einen laufenden Redebeitrag und speichert die bisherige Zeit."
    },
    {
      method: "POST",
      path: "/api/speeches/:speechId/finish",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Beendet einen Redebeitrag und schreibt die Gesamtdauer fort."
    },
    {
      method: "POST",
      path: "/api/speeches/:speechId/delete",
      auth: "Ratmitglied mit Vorsitzrechten",
      description: "Loescht einen Redebeitrag aus der Redeliste."
    }
  ];

  const rows = endpoints
    .map(
      (endpoint) => `<tr>
        <td><span class="method">${escapeForHtml(endpoint.method)}</span></td>
        <td><code>${escapeForHtml(endpoint.path)}</code></td>
        <td>${escapeForHtml(endpoint.auth)}</td>
        <td>${escapeForHtml(endpoint.description)}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API-Dokumentation</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 24px;
        background: linear-gradient(135deg, #f6fbff 0%, #e7f0ff 100%);
        color: #14253d;
      }
      .wrap {
        max-width: 1200px;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(17, 44, 77, 0.12);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 16px 40px rgba(17, 44, 77, 0.12);
      }
      h1 { margin: 0 0 8px; }
      p.lead { margin: 0 0 18px; color: #35526f; }
      .links { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0 22px; }
      a { color: #0b4f94; font-weight: 700; text-decoration: none; }
      a:hover { text-decoration: underline; }
      table { width: 100%; border-collapse: collapse; overflow: hidden; }
      th, td { border: 1px solid #d3dce8; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: #eff5ff; }
      tr:nth-child(even) td { background: #fafcff; }
      .method {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 999px;
        background: #e9f2ff;
        color: #0b4f94;
        font-weight: 700;
        font-size: 0.82rem;
      }
      code {
        background: #f3f6fb;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .auth-box {
        border-left: 4px solid #0b4f94;
        background: #f4f8ff;
        padding: 12px 14px;
        margin: 16px 0 22px;
      }
      .examples {
        margin-top: 22px;
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
      pre {
        margin: 0;
        padding: 14px;
        border-radius: 14px;
        background: #0f1f33;
        color: #ecf4ff;
        overflow-x: auto;
        font-size: 0.88rem;
      }
      .note { color: #35526f; font-size: 0.95rem; }
      @media print { body { background: #fff; padding: 0; } .wrap { box-shadow: none; border: none; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>API-Dokumentation</h1>
      <p class="lead">Token-geschuetzte REST-API fuer Sitzung, Ein-/Ausbuchung und Redeliste.</p>
      <div class="links">
        <a href="/test">/test</a>
        <a href="/chair">/chair</a>
        <a href="/session_report">/session_report</a>
        <a href="${escapeForHtml(baseUrl)}">Startseite</a>
      </div>
      <div class="auth-box">
        Authentifizierung: token als Query-Parameter ?token=... oder per Header x-auth-token.
        Ohne gueltigen Token antwortet die API mit 401. Falsche Chair-Berechtigung ergibt 403.
      </div>
      <table>
        <thead>
          <tr>
            <th>Methode</th>
            <th>Pfad</th>
            <th>Berechtigung</th>
            <th>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="examples">
        <div>
          <h2>Beispiel: Status abrufen</h2>
          <pre>GET ${baseUrl}/api/state?token=&lt;GUID&gt;</pre>
        </div>
        <div>
          <h2>Beispiel: Sitzung starten</h2>
          <pre>POST ${baseUrl}/api/committees/1/sessions/start?token=&lt;GUID&gt;</pre>
        </div>
        <div>
          <h2>Beispiel: Redebeitrag melden</h2>
          <pre>POST ${baseUrl}/api/sessions/1/speeches/request?token=&lt;GUID&gt;</pre>
        </div>
      </div>
      <p class="note">Die Chair-Ansicht unter <code>/chair</code> nutzt dieselbe Token-Authentifizierung und zeigt die Live-Redeliste.</p>
    </div>
  </body>
</html>`;
}

app.get("/", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const participant = token ? findParticipantByToken(token) : undefined;
  const baseUrl = getBaseUrl(req);

  if (participant) {
    const qrTargetUrl = `${baseUrl}/?token=${encodeURIComponent(participant.token)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, { width: 320, margin: 1 });

    res.type("html").send(
      renderShell({
        pageMode: "member",
        status: "authorized",
        participant,
        token: participant.token,
        qrCodeDataUrl,
        qrTargetUrl
      })
    );
    return;
  }

  const randomParticipant = getRandomParticipant();
  const fallbackToken = randomParticipant?.token ?? "";
  const qrTargetUrl = `${baseUrl}/?token=${encodeURIComponent(fallbackToken)}`;
  const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, { width: 320, margin: 1 });

  res.type("html").send(
    renderShell({
      pageMode: "member",
      status: "unauthorized",
      token,
      qrCodeDataUrl,
      qrTargetUrl
    })
  );
});

app.get("/test", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const participants = getAllParticipants();

  const groupedParticipants = participants.reduce<Record<string, Participant[]>>((acc, participant) => {
    const key = participant.memberFunction;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(participant);
    return acc;
  }, {});

  const sections = Object.entries(groupedParticipants)
    .map(([memberFunction, members]) => {
      const rows = members
        .map((participant) => {
          const url = `${baseUrl}/?token=${encodeURIComponent(participant.token)}`;
          const chairText = participant.isChair ? "Ja" : "Nein";
          const factionText = participant.faction ?? "-";
          const titleText = participant.title ?? "-";
          const committeesText = participant.chairedBodies.length > 0 ? participant.chairedBodies.join(", ") : "-";

          return `<tr>
            <td>${escapeForHtml(titleText)}</td>
            <td>${escapeForHtml(participant.firstName)}</td>
            <td>${escapeForHtml(participant.lastName)}</td>
            <td>${escapeForHtml(participant.gender)}</td>
            <td>${escapeForHtml(factionText)}</td>
            <td>${chairText}</td>
            <td>${escapeForHtml(committeesText)}</td>
            <td>${escapeForHtml(participant.token)}</td>
            <td><a href="${escapeForHtml(url)}" target="_blank" rel="noopener noreferrer">Anmelden</a></td>
          </tr>`;
        })
        .join("\n");

      return `<section class="function-group">
        <h2>${escapeForHtml(memberFunction)}</h2>
        <table>
          <thead>
            <tr>
              <th>Titel</th>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>Geschlecht</th>
              <th>Fraktion</th>
              <th>Vorsitzender</th>
              <th>Vorsitz in Gremien</th>
              <th>Security-Token</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>`;
    })
    .join("\n");

  const firstAdmin = participants.find((participant) => participant.memberFunction === "Administrator");
  const printoutHint = firstAdmin
    ? `<p>Druckansicht (nur Administrator): <a href="/printout?token=${escapeForHtml(firstAdmin.token)}" target="_blank" rel="noopener noreferrer">/printout</a> | <a href="/api-docs" target="_blank" rel="noopener noreferrer">API-Dokumentation</a> | <a href="/session_report" target="_blank" rel="noopener noreferrer">Reporting</a></p>`
    : "";

  res.type("html").send(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Testdaten</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { margin-bottom: 12px; }
      h2 { margin: 28px 0 8px; }
      .function-group { margin-bottom: 28px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background: #f3f3f3; }
      tr:nth-child(even) { background: #fafafa; }
    </style>
  </head>
  <body>
    <h1>Testzugänge</h1>
    <p>Alle in der Datenbank angelegten Moeglichkeiten als Klick-Link, gruppiert nach Funktion.</p>
    <p><a href="/api-docs" target="_blank" rel="noopener noreferrer">API-Dokumentation anzeigen</a> | <a href="/session_report" target="_blank" rel="noopener noreferrer">Reporting anzeigen</a></p>
    ${printoutHint}
    ${sections}
  </body>
</html>`);
});

app.get("/printout", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const caller = token ? findParticipantByToken(token) : undefined;

  if (!caller || caller.memberFunction !== "Administrator") {
    res.status(403).type("html").send(`<!doctype html>
<html lang="de">
  <head><meta charset="UTF-8" /><title>Kein Zugriff</title></head>
  <body>
    <h1>Kein Zugriff</h1>
    <p>Die URL /printout darf nur von Nutzern mit der Funktion Administrator aufgerufen werden.</p>
  </body>
</html>`);
    return;
  }

  const baseUrl = getBaseUrl(req);
  const participants = getAllParticipants();

  const sheets = await Promise.all(
    participants.map(async (participant) => {
      const loginUrl = `${baseUrl}/?token=${encodeURIComponent(participant.token)}`;
      const qrCodeDataUrl = await QRCode.toDataURL(loginUrl, { width: 280, margin: 1 });
      const faction = participant.faction ?? "-";
      const committees = participant.chairedBodies.length > 0 ? participant.chairedBodies.join(", ") : "-";

      return `<section class="sheet">
        <div class="header">
          <h1>RatLive Zugang ${escapeForHtml(participant.lastName)} ${escapeForHtml(participant.firstName)}</h1>
          <p class="subtitle">Personalisierte Zugangskarte</p>
        </div>
        <div class="content">
          <div class="meta">
            <div class="meta-row"><span class="label">Vorname</span><span class="value">${escapeForHtml(participant.firstName)}</span></div>
            <div class="meta-row"><span class="label">Nachname</span><span class="value">${escapeForHtml(participant.lastName)}</span></div>
            <div class="meta-row"><span class="label">Geschlecht</span><span class="value">${escapeForHtml(participant.gender)}</span></div>
            <div class="meta-row"><span class="label">Funktion</span><span class="value">${escapeForHtml(participant.memberFunction)}</span></div>
            <div class="meta-row"><span class="label">Fraktion</span><span class="value">${escapeForHtml(faction)}</span></div>
            <div class="meta-row"><span class="label">Vorsitz in Gremien</span><span class="value">${escapeForHtml(committees)}</span></div>
            <div class="meta-row"><span class="label">Sicherheits-Token</span><span class="value token">${escapeForHtml(participant.token)}</span></div>
            <div class="meta-row"><span class="label">Login-URL</span><span class="value url">${escapeForHtml(loginUrl)}</span></div>
          </div>
          <div class="qr-block">
            <img src="${qrCodeDataUrl}" alt="QR-Code fuer Login" />
            <p>Zum Login scannen</p>
          </div>
        </div>
      </section>`;
    })
  );

  res.type("html").send(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Druckvorlagen</title>
    <style>
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        background: linear-gradient(165deg, #e8f2ff 0%, #f7f9ff 55%, #eef7ff 100%);
      }
      .sheet {
        background: #ffffff;
        width: 190mm;
        min-height: 277mm;
        margin: 10mm auto;
        padding: 12mm;
        box-sizing: border-box;
        border: 1px solid #cbd8ea;
        border-radius: 12px;
        box-shadow: 0 14px 34px rgba(18, 47, 81, 0.16);
        page-break-after: always;
        position: relative;
        overflow: hidden;
      }
      .sheet::before {
        content: "";
        position: absolute;
        top: -38mm;
        right: -38mm;
        width: 90mm;
        height: 90mm;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(26, 106, 180, 0.18) 0%, rgba(26, 106, 180, 0) 70%);
        pointer-events: none;
      }
      .header {
        margin-bottom: 9mm;
        border-bottom: 2px solid #d7e5f6;
        padding-bottom: 4mm;
      }
      .header h1 {
        margin: 0;
        font-size: 23px;
        line-height: 1.2;
        color: #153355;
      }
      .header .subtitle {
        margin: 4px 0 0;
        color: #3a5b7e;
        font-size: 13px;
        letter-spacing: 0.02em;
      }
      .content {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 8mm;
        align-items: start;
      }
      .meta {
        background: #f8fbff;
        border: 1px solid #dce7f4;
        border-radius: 10px;
        padding: 5mm;
      }
      .meta-row {
        display: grid;
        grid-template-columns: 44mm 1fr;
        gap: 4mm;
        padding: 2.2mm 0;
        border-bottom: 1px dashed #d4e0ef;
      }
      .meta-row:last-child {
        border-bottom: none;
      }
      .label {
        color: #355677;
        font-weight: 700;
        font-size: 13px;
      }
      .value {
        color: #132f4d;
        font-size: 13px;
        word-break: break-word;
      }
      .value.token,
      .value.url {
        font-family: Consolas, "Courier New", monospace;
        font-size: 12px;
      }
      .qr-block {
        display: flex;
        flex-direction: column;
        gap: 3mm;
        justify-content: center;
        align-items: center;
        background: #ffffff;
        border: 1px solid #dce7f4;
        border-radius: 10px;
        padding: 5mm;
      }
      .qr-block img {
        width: 62mm;
        height: 62mm;
      }
      .qr-block p {
        margin: 0;
        color: #3a5b7e;
        font-size: 12px;
      }
      @media print {
        body { background: #fff; }
        .sheet {
          margin: 0;
          width: auto;
          min-height: 100vh;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }
        .sheet::before { display: none; }
      }
    </style>
  </head>
  <body>
    ${sheets.join("\n")}
  </body>
</html>`);
});

app.get("/api-docs", (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type("html").send(renderApiDocsPage(baseUrl));
});

app.get("/session_report", (req, res) => {
  const viewMode = typeof req.query.view === "string" ? req.query.view : "";
  const isReportView = viewMode === "report";
  const isExcelCopyView = viewMode === "excel_copy";
  const isStandaloneView = isReportView || isExcelCopyView;
  const completedSessions = getCompletedSessions();
  const selectedSessionId = typeof req.query.sessionId === "string" ? Number(req.query.sessionId) : NaN;
  const selectedSession = Number.isFinite(selectedSessionId) ? getSessionSummary(selectedSessionId) : undefined;
  const hasSelectedStoppedSession = Boolean(selectedSession && selectedSession.status === "STOPPED");

  const options = completedSessions
    .map((session) => {
      const selected = session.sessionId === selectedSessionId ? "selected" : "";
      return `<option value="${session.sessionId}" ${selected}>#${session.sessionId} - ${escapeForHtml(session.committeeName)} (${escapeForHtml(formatDateTime(session.stoppedAt))})</option>`;
    })
    .join("\n");

  const selectedSessionIdValue = hasSelectedStoppedSession && selectedSession ? String(selectedSession.sessionId) : "";

  let reportHtml = "<p>Bitte eine abgeschlossene Sitzung auswählen.</p>";
  let excelCopyHtml = "<p>Bitte eine abgeschlossene Sitzung auswählen.</p>";

  if (hasSelectedStoppedSession && selectedSession) {
    const reportData = buildSessionReportData(selectedSession);
    const chairParticipant = findParticipantByToken(selectedSession.startedByToken);
    const chairName = chairParticipant
      ? `${chairParticipant.lastName} ${chairParticipant.firstName}`
      : selectedSession.startedByToken;

    reportHtml = `
      <section class="report-block">
        <h2>${escapeForHtml(selectedSession.committeeName)} vom ${escapeForHtml(formatDate(selectedSession.startedAt))}</h2>
        <h3>Sitzungsdaten</h3>
        <table class="key-value-table">
          <tbody>
            <tr><th>Sitzungsnummer</th><td>#${selectedSession.sessionId}</td></tr>
            <tr><th>Start</th><td>${escapeForHtml(formatDateTime(selectedSession.startedAt))}</td></tr>
            <tr><th>Ende</th><td>${escapeForHtml(formatDateTime(selectedSession.stoppedAt))}</td></tr>
            <tr><th>Sitzungsleitung</th><td>${escapeForHtml(chairName)}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="report-block">
        <h2>Anwesende Teilnehmer nach Fraktionen</h2>
        ${reportData.factionSectionsHtml}
      </section>

      <section class="report-block">
        <h2>Abfolge der Redebeiträge</h2>
        <table>
          <thead>
            <tr>
              <th>Reihenfolge</th>
              <th>Name</th>
              <th>Fraktion</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Finished</th>
              <th>Redezeit</th>
            </tr>
          </thead>
          <tbody>${reportData.speechRowsHtml}</tbody>
        </table>
      </section>

      <section class="report-block">
        <h2>Statistik über Redebeiträge</h2>
        <p><strong>Längste Gesamt-Sprechzeit:</strong> ${reportData.longestSpeaker ? `${escapeForHtml(reportData.longestSpeaker.name)} (${escapeForHtml(formatSeconds(reportData.longestSpeaker.seconds))})` : "-"}</p>
        <h3>Sprechzeit pro Fraktion</h3>
        <table>
          <thead>
            <tr><th>Fraktion</th><th>Sprechzeit</th></tr>
          </thead>
          <tbody>${reportData.factionStatsRowsHtml}</tbody>
        </table>
        <h3>Tortendiagramm Verteilung Redezeit</h3>
        ${renderPieChartSvg(reportData.chartData)}
      </section>

    `;

    excelCopyHtml = `
      <section class="report-block">
        <h2>${escapeForHtml(selectedSession.committeeName)} vom ${escapeForHtml(formatDate(selectedSession.startedAt))}</h2>
        <h3>Excel-Kopie (TSV)</h3>
        <p>Den Inhalt markieren und direkt nach Excel einfügen.</p>
        <h3>Teilnehmer TSV</h3>
        <textarea readonly rows="8">${escapeForHtml(reportData.attendeesTsvLines.join("\n"))}</textarea>
        <h3>Redebeiträge TSV</h3>
        <textarea readonly rows="8">${escapeForHtml(reportData.speechesTsvLines.join("\n"))}</textarea>
      </section>
    `;
  }

  res.type("html").send(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Session Report</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 24px;
        color: #10243c;
        background: #f3f7fd;
      }
      .wrap {
        max-width: 1250px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #d8e2ef;
        border-radius: 14px;
        padding: 22px;
      }
      h1 { margin-top: 0; }
      .nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      a { color: #0b4f94; font-weight: 700; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .actions-row { display: flex; gap: 10px; align-items: center; flex-wrap: nowrap; margin: 0 0 18px; }
      form { margin: 0; display: flex; gap: 10px; align-items: center; flex-wrap: nowrap; }
      select, button {
        font-size: 0.95rem;
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px solid #c6d4e4;
      }
      button { background: #e9f2ff; color: #0b4f94; font-weight: 700; cursor: pointer; }
      .export-actions { display: flex; gap: 10px; flex-wrap: nowrap; margin: 0; }
      .btn-link {
        display: inline-block;
        border: 1px solid #0b4f94;
        background: #0b4f94;
        color: #fff;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
      }
      .btn-link:hover { text-decoration: none; background: #083a6d; }
      button.btn-link:disabled {
        background: #9ab3ce;
        border-color: #9ab3ce;
        cursor: default;
      }
      .btn-link[aria-disabled="true"] {
        background: #9ab3ce;
        border-color: #9ab3ce;
        cursor: default;
        pointer-events: none;
      }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 0; }
      th, td { border: 1px solid #d8e2ef; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #edf4ff; }
      .key-value-table { max-width: 760px; }
      .key-value-table th { width: 220px; }
      .key-value-table td { background: #fff; }
      .report-block { margin-top: 24px; }
      textarea {
        width: 100%;
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.86rem;
        border: 1px solid #d0dbe8;
        border-radius: 8px;
        padding: 8px;
        box-sizing: border-box;
        margin-bottom: 14px;
      }
      @media (max-width: 1020px) {
        .actions-row { flex-wrap: wrap; }
      }
      @media print {
        body { background: #fff; padding: 0; }
        .wrap { border: none; border-radius: 0; padding: 0; }
        .nav, .actions-row { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${isStandaloneView ? "" : "<h1>Session Report</h1>"}
      ${isStandaloneView ? "" : `<div class="nav"><a href="/test">/test</a><a href="/api-docs">/api-docs</a></div>`}
      ${isStandaloneView
        ? ""
        : `<div class="actions-row">
            <form method="get" action="/session_report" target="_blank" rel="noopener noreferrer">
              <label for="sessionId">Abgeschlossene Sitzung:</label>
              <select id="sessionId" name="sessionId">
                <option value="">Bitte wählen</option>
                ${options}
              </select>
              <button class="btn-link" id="reportViewButton" type="submit" name="view" value="report" ${selectedSessionIdValue ? "" : "disabled"}>Report anzeigen</button>
              <button class="btn-link" id="excelCopyViewButton" type="submit" name="view" value="excel_copy" ${selectedSessionIdValue ? "" : "disabled"}>Report als Kopiervorlage anzeigen</button>
            </form>
            <div class="export-actions" id="exportActions">
              <a
                class="btn-link"
                id="csvExportLink"
                href="${selectedSessionIdValue ? `/session_report/export?sessionId=${selectedSessionIdValue}&format=csv` : "#"}"
                aria-disabled="${selectedSessionIdValue ? "false" : "true"}"
              >
                Report als .CSV
              </a>
              <a
                class="btn-link"
                id="xlsxExportLink"
                href="${selectedSessionIdValue ? `/session_report/export?sessionId=${selectedSessionIdValue}&format=xlsx` : "#"}"
                aria-disabled="${selectedSessionIdValue ? "false" : "true"}"
              >
                Report als .XLSX
              </a>
            </div>
          </div>`}
      ${completedSessions.length === 0
        ? "<p>Keine abgeschlossenen Sitzungen vorhanden.</p>"
        : isExcelCopyView
          ? excelCopyHtml
          : reportHtml}
    </div>
    ${isStandaloneView
      ? ""
      : `<script>
          (function () {
            const sessionSelect = document.getElementById("sessionId");
            const reportViewButton = document.getElementById("reportViewButton");
            const excelCopyViewButton = document.getElementById("excelCopyViewButton");
            const csvLink = document.getElementById("csvExportLink");
            const xlsxLink = document.getElementById("xlsxExportLink");
            if (!sessionSelect || !reportViewButton || !excelCopyViewButton || !csvLink || !xlsxLink) {
              return;
            }

            const updateExportLinks = () => {
              const sessionId = sessionSelect.value;
              const hasSession = Boolean(sessionId);
              reportViewButton.disabled = !hasSession;
              excelCopyViewButton.disabled = !hasSession;

              if (!hasSession) {
                csvLink.setAttribute("href", "#");
                xlsxLink.setAttribute("href", "#");
                csvLink.setAttribute("aria-disabled", "true");
                xlsxLink.setAttribute("aria-disabled", "true");
                return;
              }

              csvLink.setAttribute("href", "/session_report/export?sessionId=" + encodeURIComponent(sessionId) + "&format=csv");
              xlsxLink.setAttribute("href", "/session_report/export?sessionId=" + encodeURIComponent(sessionId) + "&format=xlsx");
              csvLink.setAttribute("aria-disabled", "false");
              xlsxLink.setAttribute("aria-disabled", "false");
            };

            sessionSelect.addEventListener("change", updateExportLinks);
            updateExportLinks();
          })();
        </script>`}
  </body>
</html>`);
});

app.get("/session_report/export", (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? Number(req.query.sessionId) : NaN;
  const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "csv";

  if (!Number.isFinite(sessionId)) {
    res.status(400).type("text/plain").send("Ungültige sessionId");
    return;
  }

  const selectedSession = getSessionSummary(sessionId);
  if (!selectedSession || selectedSession.status !== "STOPPED") {
    res.status(400).type("text/plain").send("Sitzung nicht abgeschlossen oder nicht gefunden");
    return;
  }

  const reportData = buildSessionReportData(selectedSession);
  const fileDate = formatDateForFilename(selectedSession.startedAt);
  const safeCommitteeName = sanitizeFileNameSegment(selectedSession.committeeName);
  const fileBase = `${fileDate} ${safeCommitteeName}`;

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();

    const overviewRows = [
      ["Sitzung", `#${selectedSession.sessionId}`],
      ["Gremium", selectedSession.committeeName],
      ["Start", formatDateTime(selectedSession.startedAt)],
      ["Ende", formatDateTime(selectedSession.stoppedAt)],
      ["Laengste Gesamtsprechzeit", reportData.longestSpeaker ? `${reportData.longestSpeaker.name} (${formatSeconds(reportData.longestSpeaker.seconds)})` : "-"]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overviewRows), "Uebersicht");

    const attendeeRows = [
      ["Fraktion", "Vorname", "Nachname", "Funktion", "Eingebucht", "Ausgebucht"],
      ...selectedSession.attendees.map((attendee) => [
        attendee.faction ?? "Ohne Fraktion",
        attendee.firstName,
        attendee.lastName,
        attendee.memberFunction,
        formatDateTime(attendee.checkedInAt),
        formatDateTime(attendee.checkedOutAt)
      ])
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(attendeeRows), "Teilnehmer");

    const speechRows = [
      ["Sequence", "Name", "Fraktion", "Status", "RequestedAt", "FinishedAt", "Redezeit"],
      ...reportData.speeches.map((speech) => [
        String(speech.sequenceNumber),
        `${speech.firstName} ${speech.lastName}`,
        speech.faction ?? "Ohne Fraktion",
        speech.status,
        formatDateTime(speech.requestedAt),
        formatDateTime(speech.finishedAt),
        formatSeconds(speech.effectiveSpeakingSeconds)
      ])
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(speechRows), "Redebeitraege");

    const statsRows = [
      ["Fraktion", "Sprechzeit"],
      ...reportData.factionTotals.map((entry) => [entry.faction, formatSeconds(entry.seconds)])
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(statsRows), "Statistik");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
    res.send(buffer);
    return;
  }

  if (format === "csv") {
    const csvLines: string[] = [];
    csvLines.push(toCsvRow(["Sitzung", `#${selectedSession.sessionId}`]));
    csvLines.push(toCsvRow(["Gremium", selectedSession.committeeName]));
    csvLines.push(toCsvRow(["Start", formatDateTime(selectedSession.startedAt)]));
    csvLines.push(toCsvRow(["Ende", formatDateTime(selectedSession.stoppedAt)]));
    csvLines.push(toCsvRow(["Laengste Gesamtsprechzeit", reportData.longestSpeaker ? `${reportData.longestSpeaker.name} (${formatSeconds(reportData.longestSpeaker.seconds)})` : "-"]));
    csvLines.push("");
    csvLines.push(toCsvRow(["Teilnehmer"]));
    csvLines.push(toCsvRow(["Fraktion", "Vorname", "Nachname", "Funktion", "Eingebucht", "Ausgebucht"]));

    for (const attendee of selectedSession.attendees) {
      csvLines.push(
        toCsvRow([
          attendee.faction ?? "Ohne Fraktion",
          attendee.firstName,
          attendee.lastName,
          attendee.memberFunction,
          formatDateTime(attendee.checkedInAt),
          formatDateTime(attendee.checkedOutAt)
        ])
      );
    }

    csvLines.push("");
    csvLines.push(toCsvRow(["Redebeitraege"]));
    csvLines.push(toCsvRow(["Sequence", "Name", "Fraktion", "Status", "RequestedAt", "FinishedAt", "Redezeit"]));
    for (const speech of reportData.speeches) {
      csvLines.push(
        toCsvRow([
          String(speech.sequenceNumber),
          `${speech.firstName} ${speech.lastName}`,
          speech.faction ?? "Ohne Fraktion",
          speech.status,
          formatDateTime(speech.requestedAt),
          formatDateTime(speech.finishedAt),
          formatSeconds(speech.effectiveSpeakingSeconds)
        ])
      );
    }

    csvLines.push("");
    csvLines.push(toCsvRow(["Sprechzeit pro Fraktion"]));
    csvLines.push(toCsvRow(["Fraktion", "Sprechzeit"]));
    for (const entry of reportData.factionTotals) {
      csvLines.push(toCsvRow([entry.faction, formatSeconds(entry.seconds)]));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    res.send(`\uFEFF${csvLines.join("\r\n")}`);
    return;
  }

  res.status(400).type("text/plain").send("Ungueltiges Format. Erlaubt: csv, xlsx");
});

app.get("/chair", async (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const baseUrl = getBaseUrl(req);
    const qrTargetUrl = `${baseUrl}/?token=${encodeURIComponent(participant.token)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, { width: 320, margin: 1 });

    res.type("html").send(
      renderShell({
        pageMode: "chair",
        status: "authorized",
        participant,
        token: participant.token,
        qrCodeDataUrl,
        qrTargetUrl
      })
    );
  } catch (error) {
    res.status(403).type("html").send(`<!doctype html>
<html lang="de">
  <head><meta charset="UTF-8" /><title>Kein Zugriff</title></head>
  <body>
    <h1>Kein Zugriff</h1>
    <p>Die URL /chair ist nur fuer Ratsmitglieder mit Vorsitzrechten erreichbar.</p>
  </body>
</html>`);
  }
});

app.get("/api/state", (req, res) => {
  try {
    const participant = requireParticipant(req);
    res.json({ ok: true, state: getDashboardState(participant.token) });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/committees/:committeeId/sessions/start", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const committeeId = Number(req.params.committeeId);
    const session = startCommitteeSession(committeeId, participant.token);
    res.json({ ok: true, session });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/stop", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const session = stopCommitteeSession(sessionId, participant.token);
    res.json({ ok: true, session });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/attendance/check-in", (req, res) => {
  try {
    const participant = requireParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const attendance = checkInParticipant(sessionId, participant.token);
    res.json({ ok: true, attendance });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/attendance/check-out", (req, res) => {
  try {
    const participant = requireParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const attendance = checkOutParticipant(sessionId, participant.token);
    res.json({ ok: true, attendance });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/speeches/request", (req, res) => {
  try {
    const participant = requireParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const speech = requestSpeech(sessionId, participant.token, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/speeches/withdraw", (req, res) => {
  try {
    const participant = requireParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const speech = withdrawSpeech(sessionId, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/sessions/:sessionId/speeches/add", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const sessionId = Number(req.params.sessionId);
    const targetToken = typeof req.body?.participantToken === "string" ? req.body.participantToken : "";
    const speech = addSpeechOnBehalf(sessionId, participant.token, targetToken);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/speeches/:speechId/move", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const speechId = Number(req.params.speechId);
    const direction = req.body?.direction;
    if (direction !== "up" && direction !== "down" && direction !== "top") {
      throw new Error("Invalid direction");
    }
    const speeches = moveSpeech(speechId, participant.token, direction);
    res.json({ ok: true, speeches });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/speeches/:speechId/start", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const speechId = Number(req.params.speechId);
    const speech = startSpeech(speechId, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/speeches/:speechId/pause", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const speechId = Number(req.params.speechId);
    const speech = pauseSpeech(speechId, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/speeches/:speechId/finish", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const speechId = Number(req.params.speechId);
    const speech = finishSpeech(speechId, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/speeches/:speechId/delete", (req, res) => {
  try {
    const participant = requireChairParticipant(req);
    const speechId = Number(req.params.speechId);
    const speech = deleteSpeech(speechId, participant.token);
    res.json({ ok: true, speech });
  } catch (error) {
    handleApiError(res, error);
  }
});

export default app;
