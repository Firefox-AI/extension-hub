import { LitElement, html } from 'lit'
import aiModeLogo from '../../../assets/ai-mode-logo.png'

class MozAIModePage extends LitElement {
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
  }

  createRenderRoot() {
    return this
  }

  async handleSearchAction(action: string) {
    try {
      await browser.sidebarAction.open()
      // Set a slight delay to ensure the sidebar is fully open
      await new Promise((resolve) => setTimeout(resolve, 300))
      await browser.runtime.sendMessage({
        type: 'aimode_search_action',
        data: {
          action,
          query: this.query,
          timestamp: Date.now(),
        },
      })
      console.log('Homepage search action:', action)
    } catch (error) {
      console.error('Error sending homepage search message:', error)
    }
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="browser-frame">
          <div class="main-content">
            <div class="background-gradient"></div>

            <div class="content-wrapper">
              <!-- LOGO -->
              <div class="branding" data-fa-i2svg="disabled">
                <image
                  data-fa-i2svg="disabled"
                  src=${aiModeLogo}
                  alt="AI Mode Logo"
                />
              </div>

              <!-- SEARCH BAR -->
              <div class="search-bar">
                <input
                  @input="${(e: Event) =>
                    (this.query = (e.target as HTMLInputElement).value)}"
                  .value="${this.query}"
                  type="text"
                  class="search-input"
                  placeholder=" Mina, what do you want to do today?"
                />
                <div class="search-controls">
                  <button
                    class="clear-button"
                    @click="${() => this.handleSearchAction('add_files')}"
                  >
                    + Add image, tabs or files
                  </button>

                  <div class="flex items-center gap-4">
                    <button
                      class="clear-button"
                      @click="${() => this.handleSearchAction('voice_input')}"
                    >
                      <i class="fa-solid fa-microphone"></i>
                    </button>
                    <button
                      class="primary-button"
                      @click="${() => this.handleSearchAction('search')}"
                    >
                      <i class="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- ACTION BUTTONS -->
              <div class="action-buttons">
                <button class="primary-button">
                  <i class="fa-solid fa-file-lines"></i>
                  <span>Summarize</span>
                </button>
                <button class="primary-button">
                  <i class="fa-solid fa-image"></i>
                  <span>Generate Image</span>
                </button>
                <button class="primary-button">
                  <i class="fa-solid fa-code"></i>
                  <span>Write Code</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }
}

export default MozAIModePage
