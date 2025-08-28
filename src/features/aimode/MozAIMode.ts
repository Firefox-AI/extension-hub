import { LitElement, html, css } from 'lit'
import { getOpenAIChatResponseWithModel } from '../../services/openai'
import { LocalStorageKeys } from '../../../const'

class MozAIMode extends LitElement {
  query: string = ''
  hasOpenAIKey: boolean = false
  aiResponse: string = ''
  showSummarizeButton: boolean = false
  isProcessing: boolean = false

  static get properties() {
    return {
      query: { type: String },
      hasOpenAIKey: { type: Boolean },
      aiResponse: { type: String },
      showSummarizeButton: { type: Boolean },
      isProcessing: { type: Boolean },
    }
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
    browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
    this.checkOpenAIKey()
  }

  async checkOpenAIKey() {
    try {
      const { openai_api_key } = await browser.storage.local.get([
        LocalStorageKeys.OPENAI_API_KEY,
      ])
      this.hasOpenAIKey = !!(openai_api_key && openai_api_key.trim())
      this.requestUpdate()
    } catch (error) {
      console.error('Failed to check OpenAI key:', error)
      this.hasOpenAIKey = false
      this.requestUpdate()
    }
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'aimode_search_action') {
      if (!message.data.action) {
        // Ping message - respond with ready signal
        browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
        return
      }

      this.query = message.data.query || ''
      if (message.data.aiResponse) {
        this.aiResponse = message.data.aiResponse
        this.showSummarizeButton = true
        this.requestUpdate()
      }
    }
  }

  async handleSummarizePage() {
    if (!this.hasOpenAIKey) return

    this.isProcessing = true
    this.requestUpdate()

    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        throw new Error('No active tab found')
      }

      const results = await browser.tabs.executeScript(activeTab.id, {
        code: `
          document.body.innerText || document.body.textContent || '';
        `,
      })

      const pageContent = results[0] || ''

      const prompt = `Please provide a concise summary of the following web page content in 2-3 paragraphs:

${pageContent.slice(0, 4000)}`

      const response = await getOpenAIChatResponseWithModel(prompt, 'gpt-4o')

      if (response.content) {
        this.aiResponse = response.content
      } else {
        this.aiResponse = 'Sorry, I encountered an error summarizing this page.'
      }
    } catch (error) {
      console.error('Error summarizing page:', error)
      this.aiResponse = 'Sorry, I encountered an error summarizing this page.'
    }

    this.isProcessing = false
    this.requestUpdate()
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
            <!-- OPENAI KEY WARNING -->
            ${!this.hasOpenAIKey
              ? html`
                  <div class="openai-warning">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    OpenAI API key required for AI responses. Add key in
                    Extension Hub settings.
                  </div>
                `
              : ''}

            <!-- AI RESPONSE SECTION -->
            ${this.aiResponse || this.isProcessing
              ? html`
                  <div class="ai-response-section">
                    ${this.isProcessing
                      ? html`
                          <div class="ai-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            Processing...
                          </div>
                        `
                      : html`
                          <div class="ai-response">
                            <div class="ai-response-header">
                              <i class="fa-solid fa-robot"></i>
                              Mina's Response
                            </div>
                            <div class="ai-response-content">
                              ${this.aiResponse}
                            </div>
                          </div>
                        `}
                  </div>
                `
              : ''}

            <textarea
              .value="${this.query}"
              @input="${(e: Event) =>
                (this.query = (e.target as HTMLTextAreaElement).value)}"
              class="query-input"
              placeholder="Type your query here..."
            ></textarea>

            <div class="button-row">
              <button class="primary-button">Submit</button>
              ${this.showSummarizeButton
                ? html`
                    <button
                      class="primary-button"
                      @click="${this.handleSummarizePage}"
                      ?disabled="${!this.hasOpenAIKey || this.isProcessing}"
                    >
                      <i class="fa-solid fa-file-lines"></i>
                      Summarize Page
                    </button>
                  `
                : ''}
            </div>
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

      .primary-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .button-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .openai-warning {
        background-color: #fff3cd;
        color: #856404;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        border: 1px solid #ffeaa7;
      }

      .ai-response-section {
        margin-bottom: 12px;
      }

      .ai-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        background-color: var(--color-background);
        border-radius: 4px;
        font-size: 12px;
      }

      .ai-response {
        background-color: var(--color-background);
        border-radius: 4px;
        border: 1px solid var(--color-border-light);
      }

      .ai-response-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background-color: var(--header-background);
        border-bottom: 1px solid var(--color-border-light);
        font-size: 12px;
        font-weight: bold;
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
      }

      .ai-response-content {
        padding: 12px;
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
    `
  }
}

export default MozAIMode
