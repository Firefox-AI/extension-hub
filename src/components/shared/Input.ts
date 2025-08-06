import { LitElement, html, css } from 'lit'

export class Input extends LitElement {
  type: 'text' | 'password' | 'email' | 'number' | 'search' = 'text'
  placeholder = ''
  value = ''
  disabled = false
  required = false
  size: 'small' | 'medium' | 'large' = 'medium'
  variant: 'default' | 'error' | 'success' = 'default'
  label = ''
  helperText = ''

  static get properties() {
    return {
      type: { type: String },
      placeholder: { type: String },
      value: { type: String },
      disabled: { type: Boolean },
      required: { type: Boolean },
      size: { type: String },
      variant: { type: String },
      label: { type: String },
      helperText: { type: String },
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
      }

      .input-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .label {
        font-size: var(--input-label-font-size, 14px);
        font-weight: 500;
        color: var(--color-label, #ffffff);
        margin-bottom: 4px;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      input {
        width: 100%;
        font-family: inherit;
        font-size: var(--input-font-size, 14px);
        border: 1px solid var(--color-border, #007bff);
        border-radius: var(--input-border-radius, 4px);
        background-color: var(--color-input-bg, #424242);
        color: var(--color-input-text, #ffffff);
        outline: none;
        transition: all 0.2s ease;
      }

      /* Sizes */
      .small input {
        padding: 6px 8px;
        font-size: 12px;
      }

      .medium input {
        padding: 8px 12px;
        font-size: 14px;
      }

      .large input {
        padding: 12px 16px;
        font-size: 16px;
      }

      /* States */
      input:focus {
        border-color: var(--color-focus-border, #007bff);
        box-shadow: 0 0 0 2px var(--color-focus-ring, rgba(0, 123, 255, 0.25));
      }

      input:disabled {
        background-color: var(--color-disabled-bg, #2a2a2a);
        color: var(--color-disabled-text, #888888);
        cursor: not-allowed;
        opacity: 0.6;
      }

      input::placeholder {
        color: var(--color-placeholder, #b0b0b0);
        opacity: 1;
      }

      /* Variants */
      .error input {
        border-color: var(--color-error, #dc3545);
      }

      .error input:focus {
        border-color: var(--color-error, #dc3545);
        box-shadow: 0 0 0 2px var(--color-error-ring, rgba(220, 53, 69, 0.25));
      }

      .success input {
        border-color: var(--color-success, #28a745);
      }

      .success input:focus {
        border-color: var(--color-success, #28a745);
        box-shadow: 0 0 0 2px var(--color-success-ring, rgba(40, 167, 69, 0.25));
      }

      .helper-text {
        font-size: var(--input-helper-font-size, 12px);
        color: var(--color-helper-text, #b0b0b0);
        margin-top: 4px;
      }

      .error .helper-text {
        color: var(--color-error, #dc3545);
      }

      .success .helper-text {
        color: var(--color-success, #28a745);
      }
    `
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    this.value = target.value

    this.dispatchEvent(
      new CustomEvent('input-change', {
        bubbles: true,
        composed: true,
        detail: {
          value: this.value,
          originalEvent: e,
        },
      }),
    )
  }

  private _handleChange(e: Event) {
    this.dispatchEvent(
      new CustomEvent('input-changed', {
        bubbles: true,
        composed: true,
        detail: {
          value: this.value,
          originalEvent: e,
        },
      }),
    )
  }

  private _handleFocus(e: Event) {
    this.dispatchEvent(
      new CustomEvent('input-focus', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }

  private _handleBlur(e: Event) {
    this.dispatchEvent(
      new CustomEvent('input-blur', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }

  render() {
    return html`
      <div class="input-container ${this.variant} ${this.size}">
        ${this.label ? html`<label class="label">${this.label}</label>` : ''}
        <div class="input-wrapper">
          <input
            type=${this.type}
            placeholder=${this.placeholder}
            .value=${this.value}
            ?disabled=${this.disabled}
            ?required=${this.required}
            @input=${this._handleInput}
            @change=${this._handleChange}
            @focus=${this._handleFocus}
            @blur=${this._handleBlur}
          />
        </div>
        ${this.helperText
          ? html`<div class="helper-text">${this.helperText}</div>`
          : ''}
      </div>
    `
  }
}

customElements.define('eh-input', Input)
