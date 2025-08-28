import { LitElement, html, css } from 'lit'

class MozExtensionHubDash extends LitElement {
  static get properties() {
    return {}
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
  }

  async handlePageClick(page: string) {
    browser.runtime.sendMessage({
      type: 'pages_open',
      data: { page },
    })
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Extension Hub Dashboard</h3>
          <button
            class="settings-button"
            @click="${() => this.handlePageClick('chat.html')}"
          >
            Open chat page
          </button>
          <button
            class="settings-button"
            @click="${() => this.handlePageClick('onboarding.html')}"
          >
            Open onboarding page
          </button>
          <button
            class="settings-button"
            @click="${() => this.handlePageClick('semantic-search.html')}"
          > 
            Open semantic search page
          </button>
          <button
            Open AI Mode Page
            @click="${() => this.handlePageClick('aiModePage.html')}"
          >
            Open AI Mode
          </button>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        --color-bg: #202020;
        --color-fg: #ffffff;
        --color-gradient-start: #2e3133;
        --color-gradient-end: #4b4e52;
      }

      .wrapper {
        display: block;
        padding: 10px;
        color: var(--color-fg);
        background-color: var(--color-bg);
        /* override the sidebar’s default no‐select rules */
        user-select: text !important;
        -moz-user-select: text !important;
      }

      .container {
        height: calc(100vh - 100px);
        max-height: calc(100vh - 100px);
        display: flex;
        padding: 10px 14px;
        background: linear-gradient(
          135deg,
          var(--color-gradient-start) 0%,
          var(--color-gradient-end) 100%
        );
        flex-direction: column;
        border-radius: 8px;
        font-size: 14px;
        gap: 10px;
      }

      .title {
        margin: 0;
      }

      .settings-button {
        background-color: transparent;
        border: 1px solid var(--color-fg);
        color: var(--color-fg);
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .settings-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    `
  }
}

export default MozExtensionHubDash
