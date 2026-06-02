import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChairStateResponse, ParticipantsResponse } from "../types";

@customElement("joined-panel")
export class JoinedPanel extends LitElement {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: Number }) joinedSessionId = 0;
  @property({ type: String }) participantsError = "";
  @property({ type: String }) sessionStatus = "";
  @property({ type: Boolean }) hasSpeechRequest = false;
  @property({ attribute: false }) participantsData: ParticipantsResponse | null = null;
  @property({ type: Boolean }) isChairOfJoinedSession = false;
  @property({ type: String }) chairError = "";
  @property({ attribute: false }) chairState: ChairStateResponse | null = null;
  @property({ attribute: false }) formatDateTime: (value?: string | null) => string = () => "-";
  @property({ attribute: false }) formatDuration: (seconds?: number) => string = () => "00:00:00";

  private emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  render() {
    const participants = this.participantsData?.participants ?? [];

    return html`
      <p class="hint">Du bist Sitzung ${this.joinedSessionId} beigetreten.</p>
      <p class="error">${this.participantsError}</p>
      <p class="ok">${this.sessionStatus}</p>
      <button @click=${() => this.emit("toggle-speech")}>${this.hasSpeechRequest ? "Wortmeldung zuruecknehmen" : "Wortmeldung"}</button>
      <button class="secondary" @click=${() => this.emit("leave-session")}>Sitzung verlassen</button>

      ${this.isChairOfJoinedSession
        ? html`
            <div class="card">
              <h3>Leitung und Steuerung (Chair)</h3>
              <p class="error">${this.chairError}</p>
              <div>
                <span class="kpi">Sitzungsbeginn: <b>${this.formatDateTime(this.chairState?.sessionStartDt)}</b></span>
                <span class="kpi">Dauer: <b>${this.formatDuration(this.chairState?.durationSeconds)}</b></span>
                <span class="kpi">Status: <b>${this.chairState?.isStarted ? "Gestartet" : "Nicht gestartet"}</b></span>
              </div>
              <button ?disabled=${!!this.chairState?.isStarted} @click=${() => this.emit("chair-start")}>Sitzung starten</button>
              <button class="secondary" @click=${() => this.emit("chair-end")}>Sitzung beenden</button>
            </div>
          `
        : null}

      <h3>Angemeldete Benutzer</h3>
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
                  return html`
                    <tr class=${isMe ? "mine" : ""}>
                      <td>
                        ${p.displayName || p.username}
                        ${isMe ? html`<span class="mine-label">(Du)</span>` : null}
                      </td>
                      <td>${p.username || "-"}</td>
                      <td>${this.formatDateTime(p.joinedAt)}</td>
                      <td>${p.hasSpeechRequest ? html`<span class="badge">Wortmeldung</span>` : html`<span class="hint">-</span>`}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          `}
    `;
  }
}
