import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./components/login-card";
import "./components/change-password-card";
import "./components/selection-panel";
import "./components/joined-panel";
import type {
  ActiveSession,
  ChairStateResponse,
  MeResponse,
  OpenableCommittee,
  ParticipantsResponse,
  ViewMode
} from "./types";

@customElement("ratlive-dashboard-app")
export class RatsitzungDashboardApp extends LitElement {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @state() private viewMode: ViewMode = "login";
  @state() private statusMessage = "Bitte anmelden.";
  @state() private statusClass = "";

  @state() private username = "rat1";
  @state() private password = "Initial123!";
  @state() private newPassword = "";
  @state() private newPasswordConfirm = "";

  @state() private loginError = "";
  @state() private changePwdError = "";
  @state() private changePwdOk = "";

  @state() private me: MeResponse | null = null;
  @state() private profileJson = "";

  @state() private sessions: ActiveSession[] = [];
  @state() private sessionsError = "";

  @state() private openableCommittees: OpenableCommittee[] = [];
  @state() private openError = "";

  @state() private participantsError = "";
  @state() private participantsData: ParticipantsResponse | null = null;
  @state() private sessionStatus = "";

  @state() private joinedSessionId: number | null = null;
  @state() private isChairOfJoinedSession = false;
  @state() private chairError = "";
  @state() private chairState: ChairStateResponse | null = null;

  @state() private isBusy = false;

  private readonly tokenKey = "ratlive_token";
  private pollHandle: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.bootstrap();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPolling();
  }

  private async bootstrap(): Promise<void> {
    if (!this.token()) {
      this.viewMode = "login";
      this.statusMessage = "Bitte anmelden.";
      this.statusClass = "";
      return;
    }

    await this.loadDashboardState();
    this.startPolling();
  }

  private token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(value: string | null): void {
    if (value) {
      localStorage.setItem(this.tokenKey, value);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  private async api(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers ?? undefined);
    const t = this.token();
    if (t) {
      headers.set("Authorization", `Bearer ${t}`);
    }
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(path, { ...options, headers });
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollHandle = window.setInterval(() => {
      void this.loadDashboardState();
    }, 3000);
  }

  private formatDateTime(value?: string | null): string {
    if (!value) return "-";
    return value.replace("T", " ");
  }

  private formatDuration(seconds?: number): string {
    const s = Number(seconds ?? 0);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  private async loadActiveSessions(): Promise<ActiveSession[]> {
    this.sessionsError = "";
    const res = await this.api("/api/sessions/active");
    if (!res.ok) {
      this.sessionsError = "Aktive Sitzungen konnten nicht geladen werden.";
      this.sessions = [];
      return [];
    }

    const data = (await res.json()) as ActiveSession[];
    this.sessions = Array.isArray(data) ? data : [];
    return this.sessions;
  }

  private async loadOpenableCommittees(): Promise<void> {
    this.openError = "";

    if (!this.me?.canOpenSession) {
      this.openableCommittees = [];
      return;
    }

    const res = await this.api("/api/sessions/openable");
    if (!res.ok) {
      this.openError = "Liste fuer Sitzungseroeffnung konnte nicht geladen werden.";
      this.openableCommittees = [];
      return;
    }

    const data = (await res.json()) as OpenableCommittee[];
    this.openableCommittees = Array.isArray(data) ? data : [];
  }

  private async loadParticipants(sessionId: number): Promise<void> {
    this.participantsError = "";
    const res = await this.api(`/api/sessions/${sessionId}/participants`);
    if (!res.ok) {
      this.participantsError = "Teilnehmerliste konnte nicht geladen werden.";
      this.participantsData = null;
      return;
    }

    this.participantsData = (await res.json()) as ParticipantsResponse;
  }

  private async loadChairState(): Promise<void> {
    if (!this.joinedSessionId || !this.isChairOfJoinedSession) {
      this.chairState = null;
      return;
    }

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/state`);
    if (!res.ok) {
      this.chairError = "Chair-Status konnte nicht geladen werden.";
      this.chairState = null;
      return;
    }

    this.chairState = (await res.json()) as ChairStateResponse;
  }

  private async loadDashboardState(): Promise<void> {
    const meRes = await this.api("/api/auth/me");
    if (!meRes.ok) {
      this.stopPolling();
      this.setToken(null);
      this.viewMode = "login";
      this.statusMessage = "Nicht angemeldet.";
      this.statusClass = "";
      this.me = null;
      return;
    }

    const me = (await meRes.json()) as MeResponse;
    this.me = me;
    this.profileJson = JSON.stringify(me, null, 2);

    if (me.mustChangePassword) {
      this.stopPolling();
      this.viewMode = "change-password";
      this.statusMessage = "Passwortwechsel erforderlich.";
      this.statusClass = "error";
      return;
    }

    this.viewMode = "app";
    this.statusMessage = "Angemeldet.";
    this.statusClass = "ok";

    const sessions = await this.loadActiveSessions();
    const joined = sessions.find((s) => s.isJoined);

    if (joined) {
      this.joinedSessionId = joined.sessionId;
      this.isChairOfJoinedSession = Number(joined.startUserId) === Number(me.id);
      await this.loadParticipants(joined.sessionId);
      await this.loadChairState();
      return;
    }

    this.joinedSessionId = null;
    this.isChairOfJoinedSession = false;
    this.participantsData = null;
    this.chairState = null;
    await this.loadOpenableCommittees();
  }

  private async login(): Promise<void> {
    this.loginError = "";
    this.isBusy = true;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, password: this.password })
      });

      if (!res.ok) {
        this.loginError = "Login fehlgeschlagen.";
        return;
      }

      const data = (await res.json()) as { accessToken: string };
      this.setToken(data.accessToken);
      await this.loadDashboardState();
      this.startPolling();
    } finally {
      this.isBusy = false;
    }
  }

  private async changePassword(): Promise<void> {
    this.changePwdError = "";
    this.changePwdOk = "";

    if (this.newPassword !== this.newPasswordConfirm) {
      this.changePwdError = "Die Passwoerter sind nicht identisch.";
      return;
    }

    this.isBusy = true;
    try {
      const res = await this.api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword: this.newPassword })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Aenderung fehlgeschlagen." }));
        this.changePwdError = (err as { error?: string }).error ?? "Aenderung fehlgeschlagen.";
        return;
      }

      this.changePwdOk = "Passwort erfolgreich gesetzt.";
      this.newPassword = "";
      this.newPasswordConfirm = "";
      await this.loadDashboardState();
      this.startPolling();
    } finally {
      this.isBusy = false;
    }
  }

  private async joinSession(sessionId: number): Promise<void> {
    this.sessionsError = "";
    const res = await this.api(`/api/sessions/${sessionId}/join`, { method: "POST" });
    if (!res.ok) {
      this.sessionsError = "Beitritt fehlgeschlagen.";
      return;
    }

    await this.loadDashboardState();
  }

  private async openSession(committeeId: number): Promise<void> {
    this.openError = "";
    const res = await this.api("/api/sessions/open", {
      method: "POST",
      body: JSON.stringify({ committeeId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Sitzung konnte nicht eroeffnet werden." }));
      this.openError = (err as { error?: string }).error ?? "Sitzung konnte nicht eroeffnet werden.";
      return;
    }

    await this.loadDashboardState();
  }

  private async toggleSpeechRequest(): Promise<void> {
    if (!this.joinedSessionId) return;

    this.participantsError = "";
    this.sessionStatus = "";

    const res = await this.api(`/api/sessions/${this.joinedSessionId}/speech-request/toggle`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortmeldung konnte nicht geaendert werden." }));
      this.participantsError = (err as { error?: string }).error ?? "Wortmeldung konnte nicht geaendert werden.";
      return;
    }

    this.sessionStatus = "Wortmeldung aktualisiert.";
    await this.loadParticipants(this.joinedSessionId);
  }

  private async leaveSession(): Promise<void> {
    if (!this.joinedSessionId) return;

    const confirmLeave = window.confirm("Moechtest du die Sitzung wirklich verlassen?");
    if (!confirmLeave) return;

    this.participantsError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/leave`, { method: "POST" });
    if (!res.ok) {
      this.participantsError = "Sitzung konnte nicht verlassen werden.";
      return;
    }

    await this.loadDashboardState();
  }

  private async chairStart(): Promise<void> {
    if (!this.joinedSessionId || !this.isChairOfJoinedSession) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/start`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Sitzung konnte nicht gestartet werden." }));
      this.chairError = (err as { error?: string }).error ?? "Sitzung konnte nicht gestartet werden.";
      return;
    }

    await this.loadChairState();
  }

  private async chairEnd(): Promise<void> {
    if (!this.joinedSessionId || !this.isChairOfJoinedSession) return;

    const ok = window.confirm("Moechtest du die Sitzung wirklich beenden?");
    if (!ok) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/end`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Sitzung konnte nicht beendet werden." }));
      this.chairError = (err as { error?: string }).error ?? "Sitzung konnte nicht beendet werden.";
      return;
    }

    await this.loadDashboardState();
  }

  private logout(): void {
    this.stopPolling();
    this.setToken(null);
    this.viewMode = "login";
    this.statusMessage = "Abgemeldet.";
    this.statusClass = "";
  }

  render() {
    const showSelection = this.viewMode === "app" && !this.joinedSessionId;
    const showJoined = this.viewMode === "app" && !!this.joinedSessionId;

    return html`
      <div class="wrap">
        <div class="card">
          <h1>RatLive - Dashboard</h1>
          <p class="hint">Eine Seite mit zwei Betriebsmodi: vor Beitritt (Sitzungsauswahl) und nach Beitritt (Sitzungsansicht).</p>
          <p class="hint">Demo-Login: <b>rat1</b> / <b>Initial123!</b></p>
          <p class=${this.statusClass}>${this.statusMessage}</p>
        </div>

        ${this.viewMode === "login"
          ? html`
              <login-card
                .username=${this.username}
                .password=${this.password}
                .error=${this.loginError}
                .isBusy=${this.isBusy}
                @username-change=${(e: CustomEvent<string>) => {
                  this.username = e.detail;
                }}
                @password-change=${(e: CustomEvent<string>) => {
                  this.password = e.detail;
                }}
                @submit-login=${() => void this.login()}
              ></login-card>
            `
          : null}

        ${this.viewMode === "change-password"
          ? html`
              <change-password-card
                .newPassword=${this.newPassword}
                .newPasswordConfirm=${this.newPasswordConfirm}
                .error=${this.changePwdError}
                .success=${this.changePwdOk}
                .isBusy=${this.isBusy}
                @new-password-change=${(e: CustomEvent<string>) => {
                  this.newPassword = e.detail;
                }}
                @new-password-confirm-change=${(e: CustomEvent<string>) => {
                  this.newPasswordConfirm = e.detail;
                }}
                @submit-change-password=${() => void this.changePassword()}
              ></change-password-card>
            `
          : null}

        ${this.viewMode === "app"
          ? html`
              <div class="card">
                <h2>${showJoined ? "Sitzungsansicht" : "Sitzungsauswahl"}</h2>
                <p>Willkommen ${this.me?.displayName} (${this.me?.username})</p>

                ${showSelection
                  ? html`
                      <selection-panel
                        .sessions=${this.sessions}
                        .sessionsError=${this.sessionsError}
                        .canOpenSession=${!!this.me?.canOpenSession}
                        .openableCommittees=${this.openableCommittees}
                        .openError=${this.openError}
                        .formatDateTime=${this.formatDateTime.bind(this)}
                        @join-session=${(e: CustomEvent<number>) => void this.joinSession(e.detail)}
                        @open-session=${(e: CustomEvent<number>) => void this.openSession(e.detail)}
                      ></selection-panel>
                    `
                  : null}

                ${showJoined
                  ? html`
                      <joined-panel
                        .joinedSessionId=${this.joinedSessionId ?? 0}
                        .participantsError=${this.participantsError}
                        .sessionStatus=${this.sessionStatus}
                        .hasSpeechRequest=${!!this.participantsData?.hasMySpeechRequest}
                        .participantsData=${this.participantsData}
                        .isChairOfJoinedSession=${this.isChairOfJoinedSession}
                        .chairError=${this.chairError}
                        .chairState=${this.chairState}
                        .formatDateTime=${this.formatDateTime.bind(this)}
                        .formatDuration=${this.formatDuration.bind(this)}
                        @toggle-speech=${() => void this.toggleSpeechRequest()}
                        @leave-session=${() => void this.leaveSession()}
                        @chair-start=${() => void this.chairStart()}
                        @chair-end=${() => void this.chairEnd()}
                      ></joined-panel>
                    `
                  : null}

                <button class="secondary" @click=${() => this.logout()}>Abmelden</button>
                <h3>Profil (API /api/auth/me)</h3>
                <pre>${this.profileJson}</pre>
              </div>
            `
          : null}
      </div>
    `;
  }
}
