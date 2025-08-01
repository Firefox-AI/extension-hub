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

  async handlePageClick() {
    browser.runtime.sendMessage({
      type: 'pages_open',
      data: 'open_pages',
    })
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Extension Hub Dashboard</h3>
          <button class="settings-button" @click="${this.handlePageClick}">
            Open page
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
      }
    `
  }
}

export default MozExtensionHubDash
