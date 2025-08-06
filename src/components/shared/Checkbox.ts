import { LitElement, html, css } from 'lit'

export class Checkbox extends LitElement {
  checked = false
  disabled = false
  indeterminate = false
  size: 'small' | 'medium' | 'large' = 'medium'
  variant: 'default' | 'primary' | 'success' | 'error' = 'default'
  label = ''
  name = ''
  value = ''

  static get properties() {
    return {
      checked: { type: Boolean },
      disabled: { type: Boolean },
      indeterminate: { type: Boolean },
      size: { type: String },
      variant: { type: String },
      label: { type: String },
      name: { type: String },
      value: { type: String },
    }
  }

  static get styles() {
    return css`
      :host {
        display: inline-block;
      }

      .checkbox-container {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }

      .checkbox-container:has(input:disabled) {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .checkbox-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      input[type='checkbox'] {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        border: 2px solid var(--color-border, #007bff);
        border-radius: var(--checkbox-border-radius, 4px);
        background-color: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      /* Sizes */
      .small input {
        width: 16px;
        height: 16px;
      }

      .medium input {
        width: 20px;
        height: 20px;
      }

      .large input {
        width: 24px;
        height: 24px;
      }

      /* Checked state */
      input:checked {
        background-color: var(--color-checked-bg, #007bff);
        border-color: var(--color-checked-border, #007bff);
      }

      /* Checkmark */
      input:checked::before {
        content: '✓';
        position: absolute;
        color: var(--color-checkmark, #ffffff);
        font-weight: bold;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        line-height: 1;
      }

      .small input:checked::before {
        font-size: 10px;
      }

      .medium input:checked::before {
        font-size: 12px;
      }

      .large input:checked::before {
        font-size: 14px;
      }

      /* Indeterminate state */
      input:indeterminate {
        background-color: var(--color-indeterminate-bg, #007bff);
        border-color: var(--color-indeterminate-border, #007bff);
      }

      input:indeterminate::before {
        content: '—';
        position: absolute;
        color: var(--color-indeterminate-mark, #ffffff);
        font-weight: bold;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        line-height: 1;
      }

      /* Focus state */
      input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-focus-ring, rgba(0, 123, 255, 0.25));
      }

      /* Disabled state */
      input:disabled {
        cursor: not-allowed;
        border-color: var(--color-disabled-border, #6d6d6d);
        background-color: var(--color-disabled-bg, #2a2a2a);
      }

      input:disabled:checked {
        background-color: var(--color-disabled-checked-bg, #6d6d6d);
      }

      /* Variants */
      .primary input {
        border-color: var(--color-primary, #007bff);
      }

      .primary input:checked {
        background-color: var(--color-primary, #007bff);
        border-color: var(--color-primary, #007bff);
      }

      .success input {
        border-color: var(--color-success, #28a745);
      }

      .success input:checked {
        background-color: var(--color-success, #28a745);
        border-color: var(--color-success, #28a745);
      }

      .error input {
        border-color: var(--color-error, #dc3545);
      }

      .error input:checked {
        background-color: var(--color-error, #dc3545);
        border-color: var(--color-error, #dc3545);
      }

      .label {
        font-size: var(--checkbox-label-font-size, 14px);
        color: var(--color-label, #ffffff);
        cursor: pointer;
      }

      .disabled .label {
        color: var(--color-disabled-text, #888888);
        cursor: not-allowed;
      }
    `
  }

  firstUpdated() {
    const input = this.shadowRoot?.querySelector('input')
    if (input) {
      input.indeterminate = this.indeterminate
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('indeterminate')) {
      const input = this.shadowRoot?.querySelector('input')
      if (input) {
        input.indeterminate = this.indeterminate
      }
    }
  }

  private _handleChange(e: Event) {
    const target = e.target as HTMLInputElement
    this.checked = target.checked

    // Clear indeterminate state when user clicks
    if (this.indeterminate) {
      this.indeterminate = false
    }

    this.dispatchEvent(
      new CustomEvent('checkbox-change', {
        bubbles: true,
        composed: true,
        detail: {
          checked: this.checked,
          value: this.value,
          name: this.name,
          originalEvent: e,
        },
      }),
    )
  }

  render() {
    return html`
      <label
        class="checkbox-container ${this.variant} ${this.size} ${this.disabled
          ? 'disabled'
          : ''}"
      >
        <div class="checkbox-wrapper">
          <input
            type="checkbox"
            .checked=${this.checked}
            ?disabled=${this.disabled}
            name=${this.name}
            value=${this.value}
            @change=${this._handleChange}
          />
        </div>
        ${this.label ? html`<span class="label">${this.label}</span>` : ''}
      </label>
    `
  }
}

customElements.define('eh-checkbox', Checkbox)
