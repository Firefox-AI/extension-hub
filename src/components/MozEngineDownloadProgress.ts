import { LitElement, html } from 'lit'

export class MozEngineDownloadProgress extends LitElement {
  isVisible: boolean = false
  progress: number = 0
  closedByUser: boolean = false

  static properties = {
    isVisible: { type: Boolean },
    progress: { type: Number },
    closedByUser: { type: Boolean },
  }

  constructor() {
    super()
  }

  createRenderRoot() {
    return this
  }

  connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
  }

  disconnectedCallback() {
    browser.runtime.onMessage.removeListener(this.handleIncomingMessage)
    super.disconnectedCallback()
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type !== 'mlEngine_download_progress') return

    this.isVisible = this.closedByUser ? false : true
    this.progress = message.progress
    // Adding a buffer to 100 with 99 because it does not always reach exactly 100%
    if (this.progress >= 99) {
      this.remove()
    }
  }

  render() {
    if (!this.isVisible || this.closedByUser) {
      return html``
    }

    return html`
      <button
        class="progress-close-button"
        @click="${() => (this.closedByUser = true)}"
      >
        <span class="fa fa-close"></span>
      </button>
      <div class="progress-container">
        ML Engine Download Progress: ${Math.floor(this.progress)}%
      </div>
    `
  }
}

customElements.define('moz-engine-download-progress', MozEngineDownloadProgress)
