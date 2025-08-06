import { LitElement, html, css } from 'lit'

export class Textarea extends LitElement {
  placeholder = ''
  value = ''
  disabled = false
  required = false
  resize: 'none' | 'vertical' | 'horizontal' | 'both' = 'vertical'
  rows = 3
  cols: number = 20
  size: 'small' | 'medium' | 'large' = 'medium'
  variant: 'default' | 'error' | 'success' = 'default'
  label = ''
  helperText = ''

  static get properties() {
    return {
      placeholder: { type: String },
      value: { type: String },
      disabled: { type: Boolean },
      required: { type: Boolean },
      resize: { type: String },
      rows: { type: Number },
      cols: { type: Number },
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

      .textarea-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .label {
        font-size: var(--textarea-label-font-size, 14px);
        font-weight: 500;
        color: var(--color-label, #ffffff);
        margin-bottom: 4px;
      }

      .textarea-wrapper {
        position: relative;
        display: flex;
        align-items: flex-start;
      }

      textarea {
        width: 100%;
        font-family: inherit;
        font-size: var(--textarea-font-size, 14px);
        border: 1px solid var(--color-border, #007bff);
        border-radius: var(--textarea-border-radius, 4px);
        background-color: var(--color-input-bg, #424242);
        color: var(--color-input-text, #ffffff);
        outline: none;
        transition: all 0.2s ease;
        resize: var(--textarea-resize, vertical);
      }

      /* Sizes */
      .small textarea {
        padding: 6px 8px;
        font-size: 12px;
      }

      .medium textarea {
        padding: 8px 12px;
        font-size: 14px;
      }

      .large textarea {
        padding: 12px 16px;
        font-size: 16px;
      }

      /* Resize options */
      .resize-none textarea {
        resize: none;
      }

      .resize-vertical textarea {
        resize: vertical;
      }

      .resize-horizontal textarea {
        resize: horizontal;
      }

      .resize-both textarea {
        resize: both;
      }

      /* States */
      textarea:focus {
        border-color: var(--color-focus-border, #007bff);
        box-shadow: 0 0 0 2px var(--color-focus-ring, rgba(0, 123, 255, 0.25));
      }

      textarea:disabled {
        background-color: var(--color-disabled-bg, #2a2a2a);
        color: var(--color-disabled-text, #888888);
        cursor: not-allowed;
        opacity: 0.6;
      }

      textarea::placeholder {
        color: var(--color-placeholder, #b0b0b0);
        opacity: 1;
      }

      /* Variants */
      .error textarea {
        border-color: var(--color-error, #dc3545);
      }

      .error textarea:focus {
        border-color: var(--color-error, #dc3545);
        box-shadow: 0 0 0 2px var(--color-error-ring, rgba(220, 53, 69, 0.25));
      }

      .success textarea {
        border-color: var(--color-success, #28a745);
      }

      .success textarea:focus {
        border-color: var(--color-success, #28a745);
        box-shadow: 0 0 0 2px var(--color-success-ring, rgba(40, 167, 69, 0.25));
      }

      .helper-text {
        font-size: var(--textarea-helper-font-size, 12px);
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

  render() {
    return html`
      <div
        class="textarea-container ${this.variant} ${this.size} resize-${this
          .resize}"
      >
        ${this.label ? html`<label class="label">${this.label}</label>` : ''}
        <div class="textarea-wrapper">
          <textarea
            placeholder=${this.placeholder}
            .value=${this.value}
            ?disabled=${this.disabled}
            ?required=${this.required}
            rows=${this.rows}
            cols=${this.cols || ''}
            @input=${this._handleInput}
            @change=${this._handleChange}
            @focus=${this._handleFocus}
            @blur=${this._handleBlur}
            @keydown=${this._handleKeydown}
          ></textarea>
        </div>
        ${this.helperText
          ? html`<div class="helper-text">${this.helperText}</div>`
          : ''}
      </div>
    `
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement
    this.value = target.value

    this.dispatchEvent(
      new CustomEvent('textarea-input', {
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
      new CustomEvent('textarea-change', {
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
      new CustomEvent('textarea-focus', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }

  private _handleBlur(e: Event) {
    this.dispatchEvent(
      new CustomEvent('textarea-blur', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }

  private _handleKeydown(e: Event) {
    this.dispatchEvent(
      new CustomEvent('textarea-keydown', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }
}

customElements.define('eh-textarea', Textarea)
