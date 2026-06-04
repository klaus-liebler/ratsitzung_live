import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("login-card")
export class LoginCard extends LitElement {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String }) username = "";
  @property({ type: String }) password = "";
  @property({ type: String }) error = "";
  @property({ type: Boolean }) isBusy = false;

  private onUsernameInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent("username-change", { detail: value, bubbles: true, composed: true }));
  }

  private onPasswordInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent("password-change", { detail: value, bubbles: true, composed: true }));
  }

  private onSubmit(): void {
    this.dispatchEvent(new CustomEvent("submit-login", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="card">
        <h2>Login</h2>
        <p class="hint">Demo-Login: <b>rat1</b> / <b>Initial123!</b></p>
        <div class="row">
          <label for="username">Benutzername</label>
          <input
            id="username"
            .value=${this.username}
            @input=${this.onUsernameInput}
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>
        <div class="row">
          <label for="password">Passwort</label>
          <input
            id="password"
            type="password"
            .value=${this.password}
            @input=${this.onPasswordInput}
            autocomplete="current-password"
          />
        </div>
        <button ?disabled=${this.isBusy} @click=${this.onSubmit}>Anmelden</button>
        <p class="error">${this.error}</p>
      </div>
    `;
  }
}
