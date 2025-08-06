import { LitElement, html, css } from 'lit'

export class Button extends LitElement {
  variant: 'primary' | 'outline' | 'secondary' = 'primary'
  disabled = false
  size: 'small' | 'medium' | 'large' = 'medium'
  wide = false

  static get properties() {
    return {
      variant: { type: String },
      disabled: { type: Boolean },
      size: { type: String },
      wide: { type: Boolean },
    }
  }

  static get styles() {
    return css`
      :host {
        display: inline-block;
      }

      button {
        font-family: inherit;
        font-size: var(--button-font-size, 14px);
        border-radius: var(--button-border-radius, 4px);
        border: 1px solid;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
        user-select: none;
      }

      /* Sizes */
      .small {
        padding: 4px 8px;
        font-size: 12px;
      }

      .medium {
        padding: 8px 12px;
        font-size: 14px;
      }

      .large {
        padding: 12px 16px;
        font-size: 16px;
      }

      /* Variants */
      .primary {
        background-color: var(--color-primary, #007bff);
        color: var(--color-primary-text, #ffffff);
        border-color: var(--color-primary, #007bff);
      }

      .primary:hover:not(:disabled) {
        background-color: var(--color-primary-hover, #0056b3);
        border-color: var(--color-primary-hover, #0056b3);
      }

      .outline {
        background-color: transparent;
        color: var(--color-outline-text, #ffffff);
        border-color: var(--color-outline-border, #ffffff);
      }

      .outline:hover:not(:disabled) {
        background-color: var(
          --color-outline-hover-bg,
          rgba(255, 255, 255, 0.1)
        );
      }

      .secondary {
        background-color: var(--color-secondary-bg, #6c757d);
        color: var(--color-secondary-text, #ffffff);
        border-color: var(--color-secondary-bg, #6c757d);
      }

      .secondary:hover:not(:disabled) {
        background-color: var(--color-secondary-hover, #5a6268);
        border-color: var(--color-secondary-hover, #5a6268);
      }

      .wide {
        width: 100%;
        display: flex;
        justify-content: center;
      }

      /* Disabled state */
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background-color: var(--color-disabled-bg, #6d6d6d) !important;
        border-color: var(--color-disabled-border, #6d6d6d) !important;
        color: var(--color-disabled-text, #ffffff) !important;
      }

      button:focus {
        box-shadow: 0 0 0 2px var(--color-focus-ring, rgba(0, 123, 255, 0.25));
      }

      button {
        pointer-events: auto;
      }
    `
  }

  private _handleClick(e: Event) {
    if (this.disabled) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    this.dispatchEvent(
      new CustomEvent('button-click', {
        bubbles: true,
        composed: true,
        detail: { originalEvent: e },
      }),
    )
  }

  render() {
    return html`
      <button
        class="${this.variant} ${this.size} ${this.wide ? 'wide' : ''}"
        ?disabled=${this.disabled}
        @click=${this._handleClick}
      >
        <slot></slot>
      </button>
    `
  }
}

customElements.define('eh-button', Button)
