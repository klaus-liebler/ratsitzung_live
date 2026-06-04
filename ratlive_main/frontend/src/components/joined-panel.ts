import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChairSpeechRequestItem, ChairStateResponse, ParticipantsResponse } from "../types";
import { ArcElement, Chart, Legend, PieController, Tooltip } from "chart.js";

Chart.register(PieController, ArcElement, Tooltip, Legend);

@customElement("joined-panel")
export class JoinedPanel extends LitElement {
  private sharesChart: Chart<"pie", number[], string> | null = null;

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: Number }) joinedSessionId = 0;
  @property({ type: String }) participantsError = "";
  @property({ type: String }) sessionStatus = "";
  @property({ type: Boolean }) hasSpeechRequest = false;
  @property({ attribute: false }) participantsData: ParticipantsResponse | null = null;
  @property({ type: Boolean }) canManageSession = false;
  @property({ type: String }) chairError = "";
  @property({ attribute: false }) chairState: ChairStateResponse | null = null;
  @property({ attribute: false }) chairSpeechRequests: ChairSpeechRequestItem[] = [];
  @property({ attribute: false }) formatDateTime: (value?: string | null) => string = () => "-";
  @property({ attribute: false }) formatTime: (value?: string | null) => string = () => "-";
  @property({ attribute: false }) formatDuration: (seconds?: number) => string = () => "00:00:00";

  private emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  private emitWithUser(name: string, userId: number): void {
    this.dispatchEvent(new CustomEvent<number>(name, { detail: userId, bubbles: true, composed: true }));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sharesChart?.destroy();
    this.sharesChart = null;
  }

  protected updated(): void {
    const canvas = this.querySelector<HTMLCanvasElement>("#chairSharesChart");
    if (!canvas || !this.canManageSession) {
      this.sharesChart?.destroy();
      this.sharesChart = null;
      return;
    }

    const shares = this.chairState?.contributionShares ?? [];
    const labels = shares.map((s) => s.fractionName);
    const values = shares.map((s) => s.totalSeconds);
    const colors = shares.map((s) => {
      const raw = (s.fractionColorRgb ?? "").trim();
      return /^\d{1,3},\d{1,3},\d{1,3}$/.test(raw) ? `rgb(${raw})` : "#808080";
    });
    const hasData = values.some((v) => v > 0);
    const chartLabels = hasData ? labels : ["Keine Redeanteile"];
    const chartValues = hasData ? values : [1];
    const chartColors = hasData ? colors : ["#d3dce6"];

    this.sharesChart?.destroy();
    this.sharesChart = new Chart(canvas, {
      type: "pie",
      data: {
        labels: chartLabels,
        datasets: [
          {
            data: chartValues,
            backgroundColor: chartColors
          }
        ]
      },
      options: {
        animation: false,
        plugins: {
          legend: {
            position: "bottom"
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (!hasData) return "Keine Daten";
                const value = Number(ctx.raw ?? 0);
                const hh = Math.floor(value / 3600).toString().padStart(2, "0");
                const mm = Math.floor((value % 3600) / 60).toString().padStart(2, "0");
                const ss = Math.floor(value % 60).toString().padStart(2, "0");
                return `${ctx.label}: ${hh}:${mm}:${ss}`;
              }
            }
          }
        }
      }
    });
  }

  private onChairCreateSpeechRequestForUser(userId: number): void {
    this.dispatchEvent(new CustomEvent("chair-create-speech-request", { detail: userId, bubbles: true, composed: true }));
  }

  render() {
    const participants = this.participantsData?.participants ?? [];

    return html`
      <p class="error">${this.participantsError}</p>
      <p class="ok">${this.sessionStatus}</p>
      <button @click=${() => this.emit("toggle-speech")}>${this.hasSpeechRequest ? "Wortmeldung zuruecknehmen" : "Wortmeldung"}</button>
      <button class="secondary" @click=${() => this.emit("leave-session")}>Sitzung verlassen</button>

      ${this.canManageSession
        ? html`
            <section class="card">
              <h3>Leitung und Steuerung (Chair)</h3>
              <p class="error">${this.chairError}</p>
              <div>
                <span class="kpi">Eroeffnet: <b>${this.formatDateTime(this.chairState?.sessionOpenedDt)}</b></span>
                <span class="kpi">Sitzungsbeginn: <b>${this.formatDateTime(this.chairState?.sessionStartDt)}</b></span>
                <span class="kpi">Dauer: <b>${this.formatDuration(this.chairState?.durationSeconds)}</b></span>
                <span class="kpi">Status: <b>${this.chairState?.isStarted ? "Gestartet" : "Nicht gestartet"}</b></span>
                <span class="kpi">Aktuell Sprechender: <b>${this.chairState?.currentSpeakerDisplayName || "-"}</b></span>
              </div>
              <button ?disabled=${!!this.chairState?.isStarted} @click=${() => this.emit("chair-start")}>Sitzung starten</button>
              <button class="secondary" @click=${() => this.emit("chair-end")}>Sitzung beenden</button>
              <div class="chart-wrap">
                <h4>Redeanteile</h4>
                <canvas id="chairSharesChart" height="180"></canvas>
              </div>
            </section>

            <div class="chair-columns">
              <section class="card">
                <h3>Wortmeldungsliste</h3>
                ${this.chairSpeechRequests.length === 0
                  ? html`<p class="hint">Keine aktiven Wortmeldungen.</p>`
                  : html`
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th class="action-col">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${this.chairSpeechRequests.map(
                            (r) => html`
                              <tr class=${r.isActive || r.state === "paused" ? "speaking" : ""}>
                                <td>${r.displayName || r.username}${r.fractionName ? html` (${r.fractionName})` : ""}</td>
                                <td>${r.state}</td>
                                <td class="action-buttons">
                                  <button
                                    class="small"
                                    title=${r.isActive ? "Pausieren" : "Wortmeldung aufrufen"}
                                    @click=${() =>
                                      this.emitWithUser(
                                        r.isActive ? "chair-pause-speech-request" : "chair-play-speech-request",
                                        r.userId
                                      )}
                                  >${r.isActive ? html`&#9208;` : html`&#9654;`}</button>
                                  <button class="small secondary" title="Wortbeitrag beenden" @click=${() => this.emitWithUser("chair-stop-speech-request", r.userId)}>&#9632;</button>
                                  <button class="small secondary" title="Ganz nach oben" @click=${() => this.emitWithUser("chair-move-top-speech-request", r.userId)}>&#8593;&#8593;</button>
                                  <button class="small secondary" title="Nach oben" @click=${() => this.emitWithUser("chair-move-up-speech-request", r.userId)}>&#8593;</button>
                                  <button class="small secondary" title="Nach unten" @click=${() => this.emitWithUser("chair-move-down-speech-request", r.userId)}>&#8595;</button>
                                  <button class="small secondary" title="Eintrag loeschen" @click=${() => this.emitWithUser("chair-delete-speech-request", r.userId)}>&#128465;</button>
                                </td>
                              </tr>
                            `
                          )}
                        </tbody>
                      </table>
                    `}
              </section>

              <section class="card">
                <h3>Anwesenheitsliste</h3>
                ${participants.length === 0
                  ? html`<p class="hint">Keine Teilnehmer gefunden.</p>`
                  : html`
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Benutzer</th>
                            <th>Beigetreten</th>
                            <th>Status</th>
                            <th class="action-col">Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${participants.map((p) => {
                            const isMe = p.userId === this.participantsData?.myUserId;
                            const isSpeaking = p.userId === this.participantsData?.activeSpeakerUserId;
                            return html`
                              <tr class=${`${isMe ? "mine" : ""} ${isSpeaking ? "speaking" : ""}`.trim()}>
                                <td>
                                  ${p.displayName || p.username}
                                  ${p.fractionName ? html` (${p.fractionName})` : ""}
                                  ${isMe ? html`<span class="mine-label">(Du)</span>` : null}
                                </td>
                                <td>${p.username || "-"}</td>
                                <td>${this.formatTime(p.joinedAt)}</td>
                                <td>${p.hasSpeechRequest ? html`<span class="badge">Wortmeldung</span>` : html`<span class="hint">-</span>`}</td>
                                <td class="action">
                                  <button
                                    class="small"
                                    title="Wortmeldung fuer diesen Benutzer erstellen"
                                    ?disabled=${!this.chairState?.isStarted || p.hasSpeechRequest}
                                    @click=${() => this.onChairCreateSpeechRequestForUser(p.userId)}
                                  >&#9995;</button>
                                </td>
                              </tr>
                            `;
                          })}
                        </tbody>
                      </table>
                    `}
              </section>
            </div>
          `
        : html`
            <h3>Beigetretene Benutzer</h3>
            ${participants.length === 0
              ? html`<p class="hint">Keine Teilnehmer gefunden.</p>`
              : html`
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Benutzer</th>
                        <th>Beigetreten</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${participants.map((p) => {
                        const isMe = p.userId === this.participantsData?.myUserId;
                        const isSpeaking = p.userId === this.participantsData?.activeSpeakerUserId;
                        return html`
                          <tr class=${`${isMe ? "mine" : ""} ${isSpeaking ? "speaking" : ""}`.trim()}>
                            <td>
                              ${p.displayName || p.username}
                              ${p.fractionName ? html` (${p.fractionName})` : ""}
                              ${isMe ? html`<span class="mine-label">(Du)</span>` : null}
                            </td>
                            <td>${p.username || "-"}</td>
                            <td>${this.formatTime(p.joinedAt)}</td>
                            <td>${p.hasSpeechRequest ? html`<span class="badge">Wortmeldung</span>` : html`<span class="hint">-</span>`}</td>
                          </tr>
                        `;
                      })}
                    </tbody>
                  </table>
                `}
          `}
    `;
  }
}
