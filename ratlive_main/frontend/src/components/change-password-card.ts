import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("change-password-card")
export class ChangePasswordCard extends LitElement {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String }) newPassword = "";
  @property({ type: String }) newPasswordConfirm = "";
  @property({ type: String }) error = "";
  @property({ type: String }) success = "";
  @property({ type: Boolean }) isBusy = false;

  private onPasswordInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent("new-password-change", { detail: value, bubbles: true, composed: true }));
  }

  private onPasswordConfirmInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent("new-password-confirm-change", { detail: value, bubbles: true, composed: true }));
  }

  private onSubmit(): void {
    this.dispatchEvent(new CustomEvent("submit-change-password", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="card">
        <h2>Passwortwechsel erforderlich</h2>
        <p class="hint">Bitte sofort ein neues Passwort setzen (mind. 10 Zeichen, 1 Zahl, 1 Grossbuchstabe).</p>
        <div class="row">
          <label for="newPassword">Neues Passwort</label>
          <input
            id="newPassword"
            type="password"
            .value=${this.newPassword}
            @input=${this.onPasswordInput}
            autocomplete="new-password"
            minlength="10"
            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
          />
        </div>
        <div class="row">
          <label for="newPasswordConfirm">Neues Passwort bestaetigen</label>
          <input
            id="newPasswordConfirm"
            type="password"
            .value=${this.newPasswordConfirm}
            @input=${this.onPasswordConfirmInput}
            autocomplete="new-password"
            minlength="10"
            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
          />
        </div>
        <button ?disabled=${this.isBusy} @click=${this.onSubmit}>Passwort setzen</button>
        <p class="error">${this.error}</p>
        <p class="ok">${this.success}</p>
      </div>
    `;
  }
}
