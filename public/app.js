import { LitElement, css, html } from "lit";

const initialData = window.__RATSITZUNG_DATA__ ?? {
  pageMode: "member",
  status: "unauthorized",
  participant: undefined,
  token: "",
  qrCodeDataUrl: "",
  qrTargetUrl: ""
};

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function speechStatusLabel(status) {
  const labels = {
    REQUESTED: "Gemeldet",
    ACTIVE: "Aktiv",
    PAUSED: "Pausiert",
    FINISHED: "Beendet",
    DELETED: "Geloescht",
    WITHDRAWN: "Zurueckgezogen"
  };

  return labels[status] ?? status;
}

function isVisibleSpeech(status) {
  return status === "REQUESTED" || status === "ACTIVE" || status === "PAUSED";
}

function isHighlightedSpeech(status) {
  return status === "ACTIVE" || status === "PAUSED";
}

class RatsitzungApp extends LitElement {
  static properties = {
    state: { state: true },
    loading: { state: true },
    error: { state: true }
  };

  static styles = css`
    :host {
      color: #122033;
      display: block;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 12% 18%, #8dd3ff 0%, transparent 32%),
        radial-gradient(circle at 88% 12%, #ffe49a 0%, transparent 30%),
        linear-gradient(160deg, #f6fbff 0%, #eaf2ff 60%, #dce9ff 100%);
      padding: 24px;
      box-sizing: border-box;
    }

    .layout {
      display: grid;
      place-items: center;
      min-height: calc(100dvh - 48px);
    }

    .card {
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(17, 44, 77, 0.15);
      border-radius: 20px;
      box-shadow: 0 18px 45px rgba(17, 44, 77, 0.18);
      width: min(1240px, 100%);
      overflow: hidden;
    }

    .main {
      padding: 28px;
    }

    .panel {
      margin-top: 18px;
      padding: 16px;
      border: 1px solid rgba(17, 44, 77, 0.12);
      border-radius: 14px;
      background: rgba(248, 250, 255, 0.92);
    }

    .title {
      margin: 0 0 8px;
      font-size: clamp(1.6rem, 2vw, 2.1rem);
      line-height: 1.2;
    }

    .subtitle {
      margin: 0 0 22px;
      color: #2a4059;
    }

    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 5px 10px;
      margin-bottom: 14px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .ok {
      background: #def7e6;
      color: #0e6b34;
    }

    .warn {
      background: #ffeaca;
      color: #8a4f00;
    }

    .danger {
      background: #ffe0e0;
      color: #8a1a1a;
    }

    dl {
      margin: 0;
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 12px;
    }

    dt {
      font-weight: 700;
      color: #24415f;
    }

    dd {
      margin: 0;
      color: #0e2238;
    }

    .links {
      margin-top: 18px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    a, button {
      color: #0b4f94;
      text-decoration: none;
      font-weight: 700;
    }

    button {
      background: #eff5ff;
      border: 1px solid rgba(11, 79, 148, 0.2);
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }

    button:hover {
      background: #e3eeff;
    }

    button.danger {
      color: #8a1a1a;
      background: #fff1f1;
    }

    button.danger:hover {
      background: #ffe2e2;
    }

    button.active {
      color: #0e6b34;
      background: #def7e6;
    }

    .section {
      margin-top: 18px;
    }

    .section h2 {
      margin: 0 0 10px;
      font-size: 1.05rem;
    }

    .chair-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .chair-session-title {
      margin: 0;
      font-size: clamp(1.25rem, 2vw, 1.6rem);
      line-height: 1.2;
    }

    .chair-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 14px;
      align-items: start;
    }

    .chair-column {
      border: 1px solid rgba(17, 44, 77, 0.12);
      border-radius: 14px;
      background: #ffffff;
      padding: 12px;
    }

    .chair-column h2 {
      margin: 0 0 8px;
      font-size: 1rem;
    }

    .compact-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 0.9rem;
    }

    .speaker-table th:nth-child(1),
    .speaker-table td:nth-child(1),
    .speaker-table th:nth-child(3),
    .speaker-table td:nth-child(3),
    .speaker-table th:nth-child(4),
    .speaker-table td:nth-child(4),
    .attendee-table th:nth-child(2),
    .attendee-table td:nth-child(2),
    .attendee-table th:nth-child(3),
    .attendee-table td:nth-child(3),
    .attendee-table th:nth-child(4),
    .attendee-table td:nth-child(4) {
      width: 1%;
      white-space: nowrap;
    }

    .compact-table th,
    .compact-table td {
      border-bottom: 1px solid #e5ecf5;
      padding: 7px 6px;
      text-align: left;
      vertical-align: middle;
      word-break: break-word;
    }

    .compact-table th {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #3d5878;
    }

    .speaker-table tr.speech-highlight td {
      background: #def7e6;
    }

    .compact-actions {
      display: flex;
      gap: 4px;
      flex-wrap: nowrap;
      justify-content: flex-start;
      align-items: center;
      white-space: nowrap;
    }

    .compact-table td:last-child {
      white-space: nowrap;
    }

    .session-list, .committee-list, .speech-list, .attendee-list {
      display: grid;
      gap: 12px;
    }

    .session-card, .committee-card, .speech-card, .attendee-card {
      border: 1px solid rgba(17, 44, 77, 0.12);
      border-radius: 14px;
      padding: 14px;
      background: white;
    }

    .speech-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px 14px;
      align-items: center;
    }

    .speech-name {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .speech-name strong {
      font-size: 1rem;
      line-height: 1.2;
      word-break: break-word;
    }

    .speech-name span {
      font-size: 0.86rem;
      color: #49617f;
    }

    .speech-center-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
    }

    .speech-move-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: stretch;
      justify-content: center;
      min-width: 52px;
    }

    .icon-button {
      min-width: 30px;
      min-height: 30px;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      line-height: 1;
      border-radius: 8px;
    }

    .icon-button span {
      font-size: 0.95rem;
    }

    .session-header, .committee-header, .speech-header, .attendee-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .meta-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
      color: #2a4059;
      font-size: 0.92rem;
    }

    .speech-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      margin-top: 10px;
      font-size: 0.92rem;
    }

    .row-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .committee-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .error {
      color: #8a1a1a;
      margin: 12px 0 0;
      font-weight: 700;
    }

    .word-screen {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      text-align: center;
      background: #0f8f3d;
      color: #ffffff;
      padding: 24px;
      box-sizing: border-box;
    }

    .word-screen h1 {
      margin: 0;
      font-size: clamp(3rem, 8vw, 7rem);
      line-height: 1;
      letter-spacing: 0.03em;
      text-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
    }

    .word-screen p {
      margin: 18px 0 0;
      font-size: clamp(1rem, 2vw, 1.4rem);
      opacity: 0.95;
    }

    .empty {
      color: #2a4059;
      font-style: italic;
    }

    @media (max-width: 980px) {
      .chair-grid {
        grid-template-columns: 1fr;
      }
    }

  `;

  constructor() {
    super();
    this.data = initialData;
    this.state = null;
    this.loading = Boolean(this.data.token);
    this.error = "";
    this.pollHandle = null;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.data.token) {
      this.loadState();
      this.pollHandle = window.setInterval(() => this.loadState(), 2500);
    }
  }

  disconnectedCallback() {
    if (this.pollHandle) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    super.disconnectedCallback();
  }

  async loadState() {
    if (!this.data.token) {
      return;
    }

    try {
      const response = await fetch(`/api/state?token=${encodeURIComponent(this.data.token)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "State konnte nicht geladen werden.");
      }

      this.state = payload.state;
      this.error = "";
      this.loading = false;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unbekannter Fehler";
      this.loading = false;
    }
  }

  async callApi(path, body) {
    const response = await fetch(`${path}?token=${encodeURIComponent(this.data.token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body ?? {})
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Aktion fehlgeschlagen.");
    }

    await this.loadState();
    return payload;
  }

  getParticipant() {
    return this.state?.participant ?? this.data.participant ?? null;
  }

  getUserAttendance(session) {
    const participant = this.getParticipant();
    if (!participant) {
      return null;
    }

    return session.attendees.find((entry) => entry.participantToken === participant.token) ?? null;
  }

  getUserSpeech(session) {
    const participant = this.getParticipant();
    if (!participant) {
      return null;
    }

    return session.speeches.find(
      (entry) => entry.participantToken === participant.token && isVisibleSpeech(entry.status)
    ) ?? null;
  }

  getActiveSpeechForParticipant() {
    const participant = this.getParticipant();
    if (!participant) {
      return null;
    }

    for (const session of this.state?.runningSessions ?? []) {
      const activeSpeech = session.speeches.find(
        (entry) => entry.participantToken === participant.token && entry.status === "ACTIVE"
      );

      if (activeSpeech) {
        return { session, speech: activeSpeech };
      }
    }

    return null;
  }

  getChairCommittee(committeeId) {
    return this.state?.chairedCommittees?.find((committee) => committee.committeeId === committeeId) ?? null;
  }

  isChairForCommittee(committeeId) {
    return Boolean(this.getChairCommittee(committeeId));
  }

  renderUnauthorized() {
    return html`
      <div class="layout">
        <article class="card">
          <div class="main">
            <span class="badge warn">Token ungueltig</span>
            <h1 class="title">Willkommen zur Ratsitzung Live</h1>
            <p class="subtitle">Das uebergebene Security-Token wurde nicht gefunden. Nutze die Testuebersicht.</p>
            <div class="links">
              <a href="/test">Zur Testseite /test</a>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  renderWordScreen() {
    return html`
      <div class="word-screen" aria-live="polite" aria-atomic="true">
        <div>
          <h1>Sie haben das Wort</h1>
          <p>Bitte sprechen Sie jetzt.</p>
        </div>
      </div>
    `;
  }

  renderParticipantPanel() {
    const participant = this.getParticipant();
    if (!participant) {
      return null;
    }

    const faction = participant.faction ?? "-";
    const chairBodies = participant.chairedBodies.length > 0 ? participant.chairedBodies.join(", ") : "-";

    return html`
      <div class="panel">
        <dl>
          <dt>Vorname</dt><dd>${participant.firstName}</dd>
          <dt>Nachname</dt><dd>${participant.lastName}</dd>
          <dt>Funktion</dt><dd>${participant.memberFunction}</dd>
          <dt>Fraktion</dt><dd>${faction}</dd>
          <dt>Vorsitz in Gremien</dt><dd>${chairBodies}</dd>
        </dl>
        <div class="links">
          ${participant.chairedBodies.length > 0
            ? html`<a href="/chair?token=${encodeURIComponent(participant.token)}">Zur Chair-Ansicht</a>`
            : null}
        </div>
      </div>
    `;
  }

  renderCommitteeControls() {
    const participant = this.getParticipant();
    const committees = this.state?.chairedCommittees ?? [];

    if (!participant || committees.length === 0) {
      return null;
    }

    return html`
      <div class="section">
        <h2>Meine Gremien</h2>
        <div class="committee-grid">
          ${committees.map(
            (committee) => html`
              <div class="committee-card">
                <div class="committee-header">
                  <strong>${committee.committeeName}</strong>
                  <span class="badge ${committee.activeSession ? "ok" : "warn"}">
                    ${committee.activeSession ? "Laeuft" : "Nicht gestartet"}
                  </span>
                </div>
                <div class="meta-row">
                  <span>Gremium #${committee.committeeId}</span>
                  ${committee.activeSession ? html`<span>Sitzung #${committee.activeSession.sessionId}</span>` : null}
                </div>
                <div class="row-actions">
                  ${committee.activeSession
                    ? html`
                        <button class="danger" @click=${() => this.callApi(`/api/sessions/${committee.activeSession.sessionId}/stop`).catch((error) => this.setError(error))}>
                          Sitzung stoppen
                        </button>
                        <a href="/chair?token=${encodeURIComponent(participant.token)}">Live-Redeliste</a>
                      `
                    : html`
                        <button @click=${() => this.callApi(`/api/committees/${committee.committeeId}/sessions/start`).catch((error) => this.setError(error))}>
                          Sitzung starten
                        </button>
                      `}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  renderSessionCard(session, chairView) {
    const participant = this.getParticipant();
    const userAttendance = this.getUserAttendance(session);
    const userSpeech = this.getUserSpeech(session);
    const checkedIn = Boolean(userAttendance && !userAttendance.checkedOutAt);
    const canChair = chairView && this.isChairForCommittee(session.committeeId);
    const openAttendees = session.attendees.filter((entry) => !entry.checkedOutAt);
    const visibleSpeeches = session.speeches.filter((speech) => isVisibleSpeech(speech.status));
    const speechNameWithFaction = (speech) => `${speech.firstName} ${speech.lastName} (${speech.faction ?? "-"})`;

    return html`
      <div class="session-card">
        <div class="session-header">
          <strong>${session.committeeName}</strong>
          <span class="badge ${session.status === "RUNNING" ? "ok" : "warn"}">${session.status}</span>
        </div>
        <div class="meta-row">
          <span>Sitzung #${session.sessionId}</span>
          <span>Start: ${new Date(session.startedAt).toLocaleString("de-DE")}</span>
          ${session.stoppedAt ? html`<span>Ende: ${new Date(session.stoppedAt).toLocaleString("de-DE")}</span>` : null}
        </div>

        <div class="row-actions">
          ${checkedIn
            ? html`
                <button class="danger" @click=${() => this.callApi(`/api/sessions/${session.sessionId}/attendance/check-out`).catch((error) => this.setError(error))}>
                  Ausbuchen
                </button>
              `
            : html`
                <button @click=${() => this.callApi(`/api/sessions/${session.sessionId}/attendance/check-in`).catch((error) => this.setError(error))}>
                  Einbuchen
                </button>
              `}

          ${checkedIn && !userSpeech
            ? html`
                <button @click=${() => this.callApi(`/api/sessions/${session.sessionId}/speeches/request`).catch((error) => this.setError(error))}>
                  Redebeitrag melden
                </button>
              `
            : null}

          ${userSpeech && (userSpeech.status === "REQUESTED" || userSpeech.status === "PAUSED")
            ? html`
                <button class="danger" @click=${() => this.callApi(`/api/sessions/${session.sessionId}/speeches/withdraw`).catch((error) => this.setError(error))}>
                  Redebeitrag zurueckziehen
                </button>
              `
            : null}
        </div>

        ${chairView
          ? html`
              <div class="section">
                <h2>Teilnehmer</h2>
                <div class="attendee-list">
                  ${session.attendees.map(
                    (attendee) => html`
                      <div class="attendee-card">
                        <div class="attendee-header">
                          <strong>${attendee.firstName} ${attendee.lastName}</strong>
                          <span class="badge ${attendee.checkedOutAt ? "warn" : "ok"}">
                            ${attendee.checkedOutAt ? "Ausgebucht" : "Eingebucht"}
                          </span>
                        </div>
                        <div class="meta-row">
                          <span>${attendee.memberFunction}</span>
                          <span>Ein: ${new Date(attendee.checkedInAt).toLocaleTimeString("de-DE")}</span>
                          ${attendee.checkedOutAt ? html`<span>Aus: ${new Date(attendee.checkedOutAt).toLocaleTimeString("de-DE")}</span>` : null}
                        </div>
                        <div class="row-actions">
                          <button @click=${() => this.callApi(`/api/sessions/${session.sessionId}/speeches/add`, { participantToken: attendee.participantToken }).catch((error) => this.setError(error))}>
                            Redebeitrag fuer diese Person anlegen
                          </button>
                        </div>
                      </div>
                    `
                  )}
                </div>
              </div>

              <div class="section">
                <h2>Redeliste</h2>
                <div class="speech-list">
                  ${visibleSpeeches.length === 0
                    ? html`<div class="empty">Keine Redebeitraege vorhanden.</div>`
                    : visibleSpeeches.map(
                        (speech) => html`
                          <div class="speech-card">
                            <div class="speech-name">
                              <strong>${speechNameWithFaction(speech)}</strong>
                              <span>${speechStatusLabel(speech.status)} · ${formatSeconds(speech.effectiveSpeakingSeconds)}</span>
                            </div>
                            <div class="speech-center-actions">
                              ${speech.status === "ACTIVE"
                                ? html`
                                    <button class="icon-button" title="Pause" aria-label="Pause" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/pause`).catch((error) => this.setError(error))}>
                                      <span>⏸</span>
                                    </button>
                                  `
                                : html`
                                    <button class="icon-button" title="Play" aria-label="Play" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/start`).catch((error) => this.setError(error))}>
                                      <span>▶</span>
                                    </button>
                                  `}
                              <button class="icon-button danger" title="Stop" aria-label="Stop" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/finish`).catch((error) => this.setError(error))}>
                                <span>⏹</span>
                              </button>
                            </div>
                            <div class="speech-move-actions">
                              <button class="icon-button" title="Ganz nach oben" aria-label="Ganz nach oben" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "top" }).catch((error) => this.setError(error))}>
                                <span>⇈</span>
                              </button>
                              <button class="icon-button" title="Hoch" aria-label="Hoch" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "up" }).catch((error) => this.setError(error))}>
                                <span>↑</span>
                              </button>
                              <button class="icon-button" title="Runter" aria-label="Runter" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "down" }).catch((error) => this.setError(error))}>
                                <span>↓</span>
                              </button>
                              <button class="icon-button danger" title="Loeschen" aria-label="Loeschen" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/delete`).catch((error) => this.setError(error))}>
                                <span>✖</span>
                              </button>
                            </div>
                          </div>
                        `
                      )}
                </div>
              </div>
            `
          : html`
              <div class="section">
                <h2>Aktuelle Redeliste</h2>
                <div class="speech-list">
                  ${visibleSpeeches.length === 0
                    ? html`<div class="empty">Keine Redebeitraege vorhanden.</div>`
                    : visibleSpeeches.map(
                        (speech) => html`
                          <div class="speech-card">
                            <div class="speech-header">
                              <strong>#${speech.sequenceNumber} ${speechNameWithFaction(speech)}</strong>
                              <span class="badge ${speech.status === "ACTIVE" ? "ok" : "warn"}">
                                ${speechStatusLabel(speech.status)}
                              </span>
                            </div>
                            <div class="speech-meta">
                              <span>Dauer: ${formatSeconds(speech.effectiveSpeakingSeconds)}</span>
                              <span>Gemeldet: ${new Date(speech.requestedAt).toLocaleString("de-DE")}</span>
                            </div>
                          </div>
                        `
                      )}
                </div>
              </div>
            `}
      </div>
    `;
  }

  setError(error) {
    this.error = error instanceof Error ? error.message : String(error);
  }

  renderMemberView() {
    const participant = this.getParticipant();
    const sessions = this.state?.runningSessions ?? [];
    const title = this.data.pageMode === "chair" ? "Chair-Dashboard" : "Ratsitzung Live";

    return html`
      <div class="layout">
        <article class="card">
          <section class="main">
            <span class="badge ${this.error ? "danger" : this.loading ? "warn" : "ok"}">
              ${this.error ? "Fehler" : this.loading ? "Lade" : "Bereit"}
            </span>
            <h1 class="title">
              ${participant ? `Willkommen ${participant.firstName} ${participant.lastName}` : title}
            </h1>
            <p class="subtitle">
              ${this.data.pageMode === "chair"
                ? "Die Chair-Ansicht zeigt die aktuelle Redeliste und Verwaltungsfunktionen."
                : "Hier sind die Buchungs- und Redebeitrags-Aktionen fuer die laufenden Sitzungen sichtbar."}
            </p>

            ${this.renderParticipantPanel()}
            ${this.renderCommitteeControls()}

            <div class="section">
              <h2>Laufende Sitzungen</h2>
              <div class="session-list">
                ${sessions.length === 0
                  ? html`<div class="empty">Keine Sitzung laeuft gerade.</div>`
                  : sessions.map((session) => this.renderSessionCard(session, this.data.pageMode === "chair"))}
              </div>
            </div>

            ${this.error ? html`<p class="error">${this.error}</p>` : null}
          </section>
        </article>
      </div>
    `;
  }

  renderChairView() {
    const sessions = this.state?.runningSessions ?? [];
    const chairSessions = sessions.filter((session) => this.isChairForCommittee(session.committeeId));

    if (chairSessions.length === 0) {
      return html`
        <div class="layout">
          <article class="card">
            <div class="main">
              <span class="badge ${this.error ? "danger" : this.loading ? "warn" : "ok"}">
                ${this.error ? "Fehler" : this.loading ? "Lade" : "Bereit"}
              </span>
              <h1 class="title">Keine aktive Chair-Sitzung</h1>
              <div class="section">
                <div class="empty">Derzeit laeuft in deinen Gremien keine Sitzung.</div>
              </div>
              ${this.error ? html`<p class="error">${this.error}</p>` : null}
            </div>
          </article>
        </div>
      `;
    }

    const session = chairSessions[0];
    const visibleSpeeches = session.speeches.filter((speech) => isVisibleSpeech(speech.status));
    const participants = session.attendees;

    return html`
      <div class="layout">
        <article class="card">
          <div class="main">
            <span class="badge ${this.error ? "danger" : this.loading ? "warn" : "ok"}">
              ${this.error ? "Fehler" : this.loading ? "Lade" : "Bereit"}
            </span>
            <div class="chair-topbar">
              <h1 class="chair-session-title">${session.committeeName} (Sitzung #${session.sessionId})</h1>
              <button
                class="danger"
                @click=${() => this.callApi(`/api/sessions/${session.sessionId}/stop`).catch((error) => this.setError(error))}
              >
                Sitzung beenden
              </button>
            </div>

            <div class="chair-grid">
              <div class="chair-column">
                <h2>Rednerliste</h2>
                ${visibleSpeeches.length === 0
                  ? html`<div class="empty">Keine Redebeitraege vorhanden.</div>`
                  : html`
                      <table class="compact-table speaker-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Dauer</th>
                            <th>Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${visibleSpeeches.map(
                            (speech) => html`
                              <tr class=${isHighlightedSpeech(speech.status) ? "speech-highlight" : ""}>
                                <td>${speech.sequenceNumber}</td>
                                <td>${speech.firstName} ${speech.lastName} (${speech.faction ?? "-"})</td>
                                <td>${formatSeconds(speech.effectiveSpeakingSeconds)}</td>
                                <td>
                                  <div class="compact-actions">
                                    ${speech.status === "ACTIVE"
                                      ? html`
                                          <button class="icon-button" title="Pause" aria-label="Pause" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/pause`).catch((error) => this.setError(error))}>
                                            <span>⏸</span>
                                          </button>
                                        `
                                      : html`
                                          <button class="icon-button" title="Play" aria-label="Play" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/start`).catch((error) => this.setError(error))}>
                                            <span>▶</span>
                                          </button>
                                        `}
                                    <button class="icon-button danger" title="Stop" aria-label="Stop" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/finish`).catch((error) => this.setError(error))}>
                                      <span>⏹</span>
                                    </button>
                                    <button class="icon-button" title="Ganz nach oben" aria-label="Ganz nach oben" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "top" }).catch((error) => this.setError(error))}>
                                      <span>⇈</span>
                                    </button>
                                    <button class="icon-button" title="Hoch" aria-label="Hoch" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "up" }).catch((error) => this.setError(error))}>
                                      <span>↑</span>
                                    </button>
                                    <button class="icon-button" title="Runter" aria-label="Runter" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/move`, { direction: "down" }).catch((error) => this.setError(error))}>
                                      <span>↓</span>
                                    </button>
                                    <button class="icon-button danger" title="Loeschen" aria-label="Loeschen" @click=${() => this.callApi(`/api/speeches/${speech.speechId}/delete`).catch((error) => this.setError(error))}>
                                      <span>✖</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            `
                          )}
                        </tbody>
                      </table>
                    `}
              </div>

              <div class="chair-column">
                <h2>Teilnehmer</h2>
                ${participants.length === 0
                  ? html`<div class="empty">Keine Teilnehmer vorhanden.</div>`
                  : html`
                      <table class="compact-table attendee-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Funktion</th>
                            <th>Status</th>
                            <th>Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${participants.map(
                            (attendee) => html`
                              <tr>
                                <td>${attendee.firstName} ${attendee.lastName}</td>
                                <td>${attendee.memberFunction}</td>
                                <td>${attendee.checkedOutAt ? "ausgebucht" : "eingebucht"}</td>
                                <td>
                                  <button @click=${() => this.callApi(`/api/sessions/${session.sessionId}/speeches/add`, { participantToken: attendee.participantToken }).catch((error) => this.setError(error))}>
                                    Redebeitrag
                                  </button>
                                </td>
                              </tr>
                            `
                          )}
                        </tbody>
                      </table>
                    `}
              </div>
            </div>

            ${this.error ? html`<p class="error">${this.error}</p>` : null}
          </div>
        </article>
      </div>
    `;
  }

  render() {
    if (!this.data.token) {
      return this.renderUnauthorized();
    }

    const activeSpeech = this.getActiveSpeechForParticipant();
    if (activeSpeech && this.data.pageMode !== "chair") {
      return this.renderWordScreen();
    }

    if (this.data.pageMode === "chair") {
      return this.renderChairView();
    }

    return this.renderMemberView();
  }
}

customElements.define("ratsitzung-app", RatsitzungApp);
