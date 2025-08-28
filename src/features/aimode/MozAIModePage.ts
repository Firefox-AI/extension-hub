import { LitElement, html } from 'lit'
import aiModeLogo from '../../../assets/ai-mode-logo.png'
import { getOpenAIChatResponseWithModel } from '../../services/openai'
import { LocalStorageKeys } from '../../../const'

class MozAIModePage extends LitElement {
  query: string = ''
  hasOpenAIKey: boolean = false
  aiResponse: string = ''
  showSearchFallback: boolean = false
  isProcessing: boolean = false

  static get properties() {
    return {
      query: { type: String },
      hasOpenAIKey: { type: Boolean },
      aiResponse: { type: String },
      showSearchFallback: { type: Boolean },
      isProcessing: { type: Boolean },
    }
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
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

  createRenderRoot() {
    return this
  }

  async ensureSidebarReady() {
    await browser.sidebarAction.open()

    // Send ping message to trigger ready response
    await browser.runtime.sendMessage({
      type: 'aimode_search_action',
      data: {},
    })

    await new Promise((resolve) => {
      function onMessage(message: any) {
        if (message && message.type === 'aimode_sidebar_ready') {
          browser.runtime.onMessage.removeListener(onMessage)
          resolve(undefined)
        }
      }
      browser.runtime.onMessage.addListener(onMessage)
    })
  }

  async handleSearchAction(action: string) {
    if (action === 'search' && this.query.trim() && this.hasOpenAIKey) {
      await this.handleAIResponse()
      return
    }

    try {
      await this.ensureSidebarReady()
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

  async handleAIResponse() {
    this.isProcessing = true
    this.aiResponse = ''
    this.showSearchFallback = false
    this.requestUpdate()

    try {
      const prompt = `The user asked: "${this.query}"

Please help the user to the best of your ability. However, if you cannot provide a complete or accurate answer due to:
- Need for real-time information (current news, live data, recent events)
- Specific product searches or current prices
- Local business information or hours
- Current website content or services
- Any information that would benefit from a web search

Then provide what helpful information you can, but end your response with [SEARCH_FALLBACK] to indicate that a web search would be beneficial for more complete information.

Examples:
- For "What's the weather today?" → Respond with general weather advice and end with [SEARCH_FALLBACK]
- For "What is photosynthesis?" → Respond fully without [SEARCH_FALLBACK]
- For "Latest iPhone price?" → Respond with general info and end with [SEARCH_FALLBACK]`

      const response = await getOpenAIChatResponseWithModel(prompt, 'gpt-4o')

      if (response.content) {
        this.parseAIResponse(response.content)
      } else {
        this.aiResponse =
          'Sorry, I encountered an error processing your request.'
        this.showSearchFallback = true
      }
    } catch (error) {
      console.error('Error getting AI response:', error)
      this.aiResponse = 'Sorry, I encountered an error processing your request.'
      this.showSearchFallback = true
    }

    this.isProcessing = false
    this.requestUpdate()
  }

  parseAIResponse(content: string) {
    if (content.includes('[SEARCH_FALLBACK]')) {
      this.aiResponse = content.replace('[SEARCH_FALLBACK]', '').trim()
      this.showSearchFallback = true
    } else {
      this.aiResponse = content
      this.showSearchFallback = false
    }
  }

  async handleSearchGoogle() {
    const searchUrl = `https://www.google.com/search?client=firefox-b-1-d&q=${encodeURIComponent(this.query)}`
    window.open(searchUrl, '_blank')

    try {
      await this.ensureSidebarReady()
      await browser.runtime.sendMessage({
        type: 'aimode_search_action',
        data: {
          action: 'search_google',
          query: this.query,
          aiResponse: this.aiResponse,
          timestamp: Date.now(),
        },
      })
    } catch (error) {
      console.error('Error opening sidebar and sending AI response:', error)
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
                <img
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
                  @keydown="${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      this.handleSearchAction('search')
                    }
                  }}"
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
                              Thinking...
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
                              ${this.showSearchFallback
                                ? html`
                                    <button
                                      class="search-google-button"
                                      @click="${this.handleSearchGoogle}"
                                    >
                                      <i class="fa-solid fa-search"></i>
                                      Search Google for more info
                                    </button>
                                  `
                                : ''}
                            </div>
                          `}
                    </div>
                  `
                : ''}

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
