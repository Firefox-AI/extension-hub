import { LitElement, html, css } from 'lit'

class MozAIMode extends LitElement {
  query: string = ''

  static get properties() {
    return {
      query: { type: String },
    }
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
    browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'aimode_search_action') {
      this.query = message.data.query || ''
    }
  }

  handleCloseClick() {
    browser.runtime.sendMessage({
      type: 'pages_open',
      data: { page: 'aiModePage.html' },
    })
    browser.sidebarAction.close()
  }

  handleMenuClick() {
    // Implement menu functionality if needed
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <button class="header-button" @click=${this.handleMenuClick}>
              <slot name="menu-icon">Menu</slot>
            </button>

            <img
              src="../assets/ai-mode-logo.png"
              alt="AI Mode Logo"
              data-fa-i2svg="disabled"
              height="32"
            />
            <button class="header-button" @click=${this.handleCloseClick}>
              <slot name="expand-icon">Expand</slot>
            </button>
          </div>

          <div class="content">
            <textarea
              .value="${this.query}"
              @input="${(e: Event) =>
                (this.query = (e.target as HTMLTextAreaElement).value)}"
              class="query-input"
              placeholder="Type your query here..."
            ></textarea>
            <button class="primary-button">Submit</button>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        /* Primary colors */
        --color-backdrop: #ffa2f7;
        --color-background: #fff;
        --color-text: #000;
        --header-background: #f7ecf8;

        /* Gradient colors */
        --color-gradient-start: #efe2f2;
        --color-gradient-end: #fbecf2;

        /* Border colors */
        --color-border-light: rgba(21, 20, 26, 0.1);

        /* Shadow colors */
        --color-shadow-dark: rgba(0, 0, 0, 0.15);
        --color-shadow-darker: rgba(0, 0, 0, 0.35);

        /* button colors */
        --color-button-bg: #dcbde6;
        --color-button-bg-hover: #d8b5e1;
        --color-button-text: #343434;

        --color-button-clear-bg-hover: #e3e3e3;
        --color-button-clear-bg: transparent;
        --color-button-clear-text: #000000;

        font-family: Arial, sans-serif;
        background-color: var(--color-background);
        color: var(--color-text);
      }

      .wrapper {
        display: block;
        padding: 10px;
        color: var(--color-text);
        background-color: var(--color-backdrop);
        user-select: text !important;
        -moz-user-select: text !important;
      }

      .container {
        box-shadow:
          0 0 20px var(--color-shadow-dark),
          0 25px 30px var(--color-shadow-darker);
        height: calc(100vh - 100px);
        max-height: calc(100vh - 100px);
        display: flex;
        flex-direction: column;
        border-radius: 8px;
        font-size: 14px;
        background: linear-gradient(
          to bottom right,
          var(--color-gradient-start),
          var(--color-gradient-end)
        );
      }

      .header {
        display: flex;
        align-items: center;
        padding: 10px;
        justify-content: space-between;
        border-bottom: 1px solid var(--color-border-light);
        background-color: var(--header-background);
        border-top-right-radius: 8px;
        border-top-left-radius: 8px;
      }

      .header-button {
        padding: 6px 12px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 16px;
      }

      .header-button:hover {
        background-color: var(--color-border-light);
        border-radius: 4px;
      }

      .content {
        display: flex;
        flex-direction: column;
        padding: 10px;
      }

      .query-input {
        flex: 1;
        resize: none;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-input-bg);
        color: var(--color-fg);
        margin: 12px 0;
      }

      /**
      * Buttons
      */
      .clear-button {
        border: none;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        background-color: var(--color-button-clear-bg);
        color: var(--color-button-clear-text);
        padding: 8px 12px;
      }

      .clear-button:hover {
        background-color: var(--color-button-clear-bg-hover);
      }

      .primary-button {
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
        border: none;
        padding: 14px 18px;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s ease;
      }

      .primary-button:hover {
        background-color: var(--color-button-bg-hover);
      }
    `
  }
}

export default MozAIMode
