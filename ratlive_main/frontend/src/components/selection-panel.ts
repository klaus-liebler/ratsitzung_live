import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ActiveSession, OpenableCommittee } from "../types";

@customElement("selection-panel")
export class SelectionPanel extends LitElement {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ attribute: false }) sessions: ActiveSession[] = [];
  @property({ type: String }) sessionsError = "";
  @property({ type: Boolean }) canOpenSession = false;
  @property({ attribute: false }) openableCommittees: OpenableCommittee[] = [];
  @property({ type: String }) openError = "";
  @property({ attribute: false }) formatDateTime: (value?: string | null) => string = () => "-";

  private onJoin(sessionId: number): void {
    this.dispatchEvent(new CustomEvent("join-session", { detail: sessionId, bubbles: true, composed: true }));
  }

  private onOpen(committeeId: number): void {
    this.dispatchEvent(new CustomEvent("open-session", { detail: committeeId, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <p class="hint">Du bist aktuell keiner Sitzung beigetreten. Bitte Sitzung waehlen oder eroeffnen.</p>

      <h3>Aktive Sitzungen</h3>
      <p class="error">${this.sessionsError}</p>
      ${this.sessions.length === 0
        ? html`<p class="hint">Aktuell sind keine Sitzungen aktiv.</p>`
        : html`
            <table>
              <thead>
                <tr>
                  <th>Gremium</th>
                  <th>Eroeffnet</th>
                  <th>Start</th>
                  <th>Eroeffnet durch</th>
                  <th>Teilnehmer</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                ${this.sessions.map(
                  (s) => html`
                    <tr>
                      <td>${s.committeeName}</td>
                      <td>${this.formatDateTime(s.openedDt)}</td>
                      <td>${this.formatDateTime(s.startDt)}</td>
                      <td>${s.openedByDisplayName ?? "-"}</td>
                      <td>${s.activeParticipants ?? 0}</td>
                      <td class="action">
                        ${s.isJoined
                          ? html`<span class="ok">Beigetreten</span>`
                          : html`<button class="small" @click=${() => this.onJoin(s.sessionId)}>Beitreten</button>`}
                      </td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          `}

      ${this.canOpenSession
        ? html`
            <h3>Sitzung eroeffnen</h3>
            <p class="error">${this.openError}</p>
            ${this.openableCommittees.length === 0
              ? html`<p class="hint">Keine Gremien verfuegbar, die du aktuell eroefnen kannst.</p>`
              : html`
                  <table>
                    <thead>
                      <tr><th>Gremium</th><th>Aktion</th></tr>
                    </thead>
                    <tbody>
                      ${this.openableCommittees.map(
                        (c) => html`
                          <tr>
                            <td>${c.committeeName}</td>
                            <td class="action"><button class="small" @click=${() => this.onOpen(c.committeeId)}>Sitzung eroeffnen</button></td>
                          </tr>
                        `
                      )}
                    </tbody>
                  </table>
                `}
          `
        : null}
    `;
  }
}
