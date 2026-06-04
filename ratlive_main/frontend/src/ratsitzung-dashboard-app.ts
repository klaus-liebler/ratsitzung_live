import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./components/login-card";
import "./components/change-password-card";
import "./components/selection-panel";
import "./components/joined-panel";
import type {
  ActiveSession,
  ChairSpeechRequestItem,
  ChairSpeechRequestsResponse,
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
  @state() private joinedCommitteeName = "";
  @state() private canManageJoinedSession = false;
  @state() private chairError = "";
  @state() private chairState: ChairStateResponse | null = null;
  @state() private chairSpeechRequests: ChairSpeechRequestItem[] = [];

  @state() private isBusy = false;
  @state() private appPage: "sessions" | "manage_my_user" = "sessions";
  @state() private avatarMenuOpen = false;
  @state() private privateKeyPem = "";
  @state() private certStatus = "";
  @state() private certError = "";

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
      this.updateDocumentTitle();
      return;
    }

    await this.loadDashboardState();
    this.startPolling();
  }

  private updateDocumentTitle(committeeName?: string): void {
    const user = this.me?.username?.trim();
    if (!user) {
      document.title = "RatLive";
      return;
    }

    const committee = (committeeName ?? "Dashboard").trim() || "Dashboard";
    document.title = `${user}@${committee} - RatLive`;
  }

  private token(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  private setToken(value: string | null): void {
    if (value) {
      sessionStorage.setItem(this.tokenKey, value);
    } else {
      sessionStorage.removeItem(this.tokenKey);
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

  private formatTime(value?: string | null): string {
    if (!value) return "-";
    const normalized = value.replace("T", " ").trim();
    const match = normalized.match(/(\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : normalized;
  }

  private formatDuration(seconds?: number): string {
    const s = Number(seconds ?? 0);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  private formatDisplayNameLastFirst(displayName?: string | null): string {
    const raw = (displayName ?? "").trim();
    if (!raw) return "-";

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return raw;

    const firstName = parts.slice(0, -1).join(" ");
    const lastName = parts[parts.length - 1];
    return `${lastName}, ${firstName}`;
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
    if (!this.joinedSessionId || !this.canManageJoinedSession) {
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

  private async loadChairSpeechRequests(): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession) {
      this.chairSpeechRequests = [];
      return;
    }

    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests`);
    if (!res.ok) {
      this.chairSpeechRequests = [];
      return;
    }

    const data = (await res.json()) as ChairSpeechRequestsResponse;
    this.chairSpeechRequests = Array.isArray(data.requests) ? data.requests : [];
  }

  private async loadDashboardState(): Promise<void> {
    const meRes = await this.api("/api/auth/me");
    if (!meRes.ok) {
      this.stopPolling();
      this.setToken(null);
      this.viewMode = "login";
      this.me = null;
      this.updateDocumentTitle();
      return;
    }

    const me = (await meRes.json()) as MeResponse;
    this.me = me;
    this.profileJson = JSON.stringify(me, null, 2);

    if (me.mustChangePassword) {
      this.stopPolling();
      this.viewMode = "change-password";
      return;
    }

    this.viewMode = "app";

    const sessions = await this.loadActiveSessions();
    const joined = sessions.find((s) => s.isJoined);

    if (joined) {
      this.joinedSessionId = joined.sessionId;
      this.joinedCommitteeName = joined.committeeName;
      this.canManageJoinedSession = joined.canManageSession;
      this.updateDocumentTitle(joined.committeeName);
      await this.loadParticipants(joined.sessionId);
      await this.loadChairState();
      await this.loadChairSpeechRequests();
      return;
    }

    this.joinedSessionId = null;
    this.joinedCommitteeName = "";
    this.canManageJoinedSession = false;
    this.participantsData = null;
    this.chairState = null;
    this.chairSpeechRequests = [];
    this.updateDocumentTitle();
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
      this.appPage = "sessions";
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
    await this.loadChairState();
    await this.loadChairSpeechRequests();
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
    if (!this.joinedSessionId || !this.canManageJoinedSession) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/start`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Sitzung konnte nicht gestartet werden." }));
      this.chairError = (err as { error?: string }).error ?? "Sitzung konnte nicht gestartet werden.";
      return;
    }

    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairEnd(): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession) return;

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

  private async chairCreateSpeechRequest(userId: number): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortmeldung konnte nicht fuer Benutzer erstellt werden." }));
      this.chairError = (err as { error?: string }).error ?? "Wortmeldung konnte nicht fuer Benutzer erstellt werden.";
      return;
    }

    await this.loadParticipants(this.joinedSessionId);
    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairPlaySpeechRequest(userId: number, forceStopCurrent = false): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests/${userId}/play`, {
      method: "POST",
      body: JSON.stringify({ forceStopCurrent })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortmeldung konnte nicht aufgerufen werden." }));
      if ((err as { requiresConfirm?: boolean }).requiresConfirm && !forceStopCurrent) {
        const ok = window.confirm("Ein anderer Redebeitrag ist aktiv. Soll dieser beendet und der neue gestartet werden?");
        if (ok) {
          await this.chairPlaySpeechRequest(userId, true);
        }
        return;
      }

      this.chairError = (err as { error?: string }).error ?? "Wortmeldung konnte nicht aufgerufen werden.";
      return;
    }

    await this.loadParticipants(this.joinedSessionId);
    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairPauseSpeechRequest(userId: number): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests/${userId}/pause`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortbeitrag konnte nicht pausiert werden." }));
      this.chairError = (err as { error?: string }).error ?? "Wortbeitrag konnte nicht pausiert werden.";
      return;
    }

    await this.loadParticipants(this.joinedSessionId);
    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairStopSpeechRequest(userId: number): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests/${userId}/stop`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortbeitrag konnte nicht beendet werden." }));
      this.chairError = (err as { error?: string }).error ?? "Wortbeitrag konnte nicht beendet werden.";
      return;
    }

    await this.loadParticipants(this.joinedSessionId);
    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairDeleteSpeechRequest(userId: number): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortmeldung konnte nicht geloescht werden." }));
      this.chairError = (err as { error?: string }).error ?? "Wortmeldung konnte nicht geloescht werden.";
      return;
    }

    await this.loadParticipants(this.joinedSessionId);
    await this.loadChairState();
    await this.loadChairSpeechRequests();
  }

  private async chairMoveSpeechRequest(userId: number, direction: "top" | "up" | "down"): Promise<void> {
    if (!this.joinedSessionId || !this.canManageJoinedSession || !userId) return;

    this.chairError = "";
    const res = await this.api(`/api/sessions/${this.joinedSessionId}/chair/speech-requests/${userId}/move-${direction}`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Wortmeldung konnte nicht verschoben werden." }));
      this.chairError = (err as { error?: string }).error ?? "Wortmeldung konnte nicht verschoben werden.";
      return;
    }

    await this.loadChairSpeechRequests();
  }

  private logout(): void {
    this.avatarMenuOpen = false;
    this.appPage = "sessions";
    this.stopPolling();
    this.setToken(null);
    this.viewMode = "login";
    this.updateDocumentTitle();
  }

  private toggleAvatarMenu(): void {
    if (this.viewMode !== "app") return;
    this.avatarMenuOpen = !this.avatarMenuOpen;
  }

  private openManageMyUser(): void {
    this.appPage = "manage_my_user";
    this.avatarMenuOpen = false;
  }

  private openSessionsPage(): void {
    this.appPage = "sessions";
    this.avatarMenuOpen = false;
  }

  private generatePrivateKey(): void {
    const bytes = new Uint8Array(48);
    crypto.getRandomValues(bytes);
    const b64 = btoa(String.fromCharCode(...bytes));
    this.privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;
    this.certError = "";
    this.certStatus = "Privater Schluessel wurde im Browser erzeugt.";
  }

  private savePrivateKey(): void {
    if (!this.privateKeyPem) {
      this.certError = "Bitte zuerst einen privaten Schluessel erzeugen.";
      return;
    }

    const blob = new Blob([this.privateKeyPem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ratlive-private-key-${this.me?.username ?? "user"}.pem`;
    a.click();
    URL.revokeObjectURL(url);
    this.certError = "";
    this.certStatus = "Privater Schluessel wurde als Datei angeboten.";
  }

  private sendCertificateRequest(): void {
    if (!this.privateKeyPem) {
      this.certError = "Bitte zuerst einen privaten Schluessel erzeugen.";
      return;
    }

    this.certError = "";
    this.certStatus = "CSR-Workflow ist als Seite vorhanden; Server-Anbindung fuer Zertifikatserzeugung folgt als naechster Schritt.";
  }

  private downloadCertificate(): void {
    this.certError = "";
    this.certStatus = "Zertifikats-Download ist als Bedienpunkt vorbereitet; Implementierung des Endpunkts folgt.";
  }

  render() {
    const showSelection = this.viewMode === "app" && this.appPage === "sessions" && !this.joinedSessionId;
    const showJoined = this.viewMode === "app" && this.appPage === "sessions" && !!this.joinedSessionId;
    const showManageMyUser = this.viewMode === "app" && this.appPage === "manage_my_user";
    const navLabel = this.appPage === "manage_my_user" ? "Sitzungen" : showJoined ? "Sitzung" : "Sitzungen";
    const isCurrentSpeakerMe =
      !!showJoined &&
      !this.canManageJoinedSession &&
      !!this.participantsData?.myUserId &&
      this.participantsData.activeSpeakerUserId === this.participantsData.myUserId;

    return html`
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand-block">
            <span class="brand">RatLive</span>
            <a
              class="nav-link"
              href="#sessions"
              @click=${(e: Event) => {
                e.preventDefault();
                this.openSessionsPage();
              }}
            >${navLabel}</a>
          </div>
          <button class="avatar-button" type="button" title="Benutzermenue" @click=${() => this.toggleAvatarMenu()}>
            <span class="avatar-glyph">UA</span>
          </button>
          ${this.viewMode === "app" && this.avatarMenuOpen
            ? html`
                <div class="avatar-menu" role="menu" aria-label="Benutzermenue">
                  <button class="menu-item" @click=${() => this.openManageMyUser()} role="menuitem">Account verwalten</button>
                  <button class="menu-item danger" @click=${() => this.logout()} role="menuitem">Abmelden</button>
                </div>
              `
            : null}
        </div>
      </header>

      <div class=${`wrap${showJoined ? " wrap-wide" : ""}`}>
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
                ${showJoined
                  ? html`
                      <h2 id="sessions">${this.joinedCommitteeName}, Sitzung ${this.joinedSessionId} (${this.formatDisplayNameLastFirst(this.me?.displayName)})</h2>
                    `
                  : html`
                      <h2 id="sessions">Sitzungsauswahl</h2>
                      <p>Willkommen ${this.me?.displayName} (${this.me?.username})</p>
                    `}

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
                        .canManageSession=${this.canManageJoinedSession}
                        .chairError=${this.chairError}
                        .chairState=${this.chairState}
                        .chairSpeechRequests=${this.chairSpeechRequests}
                        .formatDateTime=${this.formatDateTime.bind(this)}
                        .formatTime=${this.formatTime.bind(this)}
                        .formatDuration=${this.formatDuration.bind(this)}
                        @toggle-speech=${() => void this.toggleSpeechRequest()}
                        @leave-session=${() => void this.leaveSession()}
                        @chair-start=${() => void this.chairStart()}
                        @chair-end=${() => void this.chairEnd()}
                        @chair-create-speech-request=${(e: CustomEvent<number>) => void this.chairCreateSpeechRequest(e.detail)}
                        @chair-play-speech-request=${(e: CustomEvent<number>) => void this.chairPlaySpeechRequest(e.detail)}
                        @chair-pause-speech-request=${(e: CustomEvent<number>) => void this.chairPauseSpeechRequest(e.detail)}
                        @chair-stop-speech-request=${(e: CustomEvent<number>) => void this.chairStopSpeechRequest(e.detail)}
                        @chair-delete-speech-request=${(e: CustomEvent<number>) => void this.chairDeleteSpeechRequest(e.detail)}
                        @chair-move-top-speech-request=${(e: CustomEvent<number>) => void this.chairMoveSpeechRequest(e.detail, "top")}
                        @chair-move-up-speech-request=${(e: CustomEvent<number>) => void this.chairMoveSpeechRequest(e.detail, "up")}
                        @chair-move-down-speech-request=${(e: CustomEvent<number>) => void this.chairMoveSpeechRequest(e.detail, "down")}
                      ></joined-panel>
                    `
                  : null}

                ${showManageMyUser
                  ? html`
                      <section class="card account-panel">
                        <h2 id="manage_my_user">Account verwalten</h2>
                        <p class="hint">Selbst-Management des angemeldeten Nutzers.</p>

                        <h3>Passwort aendern</h3>
                        <div class="row">
                          <label for="accountNewPassword">Neues Passwort</label>
                          <input
                            id="accountNewPassword"
                            type="password"
                            .value=${this.newPassword}
                            @input=${(e: Event) => {
                              this.newPassword = (e.target as HTMLInputElement).value;
                            }}
                            autocomplete="new-password"
                            minlength="10"
                            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
                            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
                          />
                        </div>
                        <div class="row">
                          <label for="accountNewPasswordConfirm">Neues Passwort bestaetigen</label>
                          <input
                            id="accountNewPasswordConfirm"
                            type="password"
                            .value=${this.newPasswordConfirm}
                            @input=${(e: Event) => {
                              this.newPasswordConfirm = (e.target as HTMLInputElement).value;
                            }}
                            autocomplete="new-password"
                            minlength="10"
                            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
                            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
                          />
                        </div>
                        <button ?disabled=${this.isBusy} @click=${() => void this.changePassword()}>Passwort speichern</button>
                        <p class="error">${this.changePwdError}</p>
                        <p class="ok">${this.changePwdOk}</p>

                        <h3>Zertifikat erstellen</h3>
                        <p class="hint">Schritt 1: Privaten Schluessel erzeugen.</p>
                        <button @click=${() => this.generatePrivateKey()}>Erzeugen</button>

                        <p class="hint">Schritt 2: Privaten Schluessel lokal speichern.</p>
                        <button class="secondary" @click=${() => this.savePrivateKey()}>Speichern</button>

                        <p class="hint">Schritt 3: CSR erzeugen und an den Server senden.</p>
                        <button @click=${() => this.sendCertificateRequest()}>Erzeugen und Senden</button>

                        <p class="hint">Schritt 4: Zertifikat vom Server laden und lokal speichern.</p>
                        <button class="secondary" @click=${() => this.downloadCertificate()}>Zertifikat runterladen</button>

                        ${this.privateKeyPem
                          ? html`
                              <h4>Privater Schluessel (lokal erzeugt)</h4>
                              <pre>${this.privateKeyPem}</pre>
                            `
                          : null}

                        <p class="error">${this.certError}</p>
                        <p class="ok">${this.certStatus}</p>
                      </section>
                    `
                  : null}

                ${this.appPage === "sessions"
                  ? html`
                      <h3>Profil (API /api/auth/me)</h3>
                      <pre>${this.profileJson}</pre>
                    `
                  : null}
              </div>

              ${isCurrentSpeakerMe
                ? html`
                    <div class="speaker-overlay" aria-live="assertive">
                      <div class="speaker-overlay-text">Sprechen Sie bitte</div>
                    </div>
                  `
                : null}
            `
          : null}
      </div>
    `;
  }
}
