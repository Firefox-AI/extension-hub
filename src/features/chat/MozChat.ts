import { LitElement, html, css } from 'lit'
import { LocalStorageKeys } from '../../../const'
import TinyMark from '../../services/tinyMark'
import { pageRestrictionService } from '../../services/pageRestriction'
import { FeatureViewStyles } from '../FeatureViewStyles'

type ChatMessageT = {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts?: number
}

class MozChat extends LitElement {
  messages: ChatMessageT[] = []
  inputValue = ''
  loading = false
  hasSystemMessage = true // disabling this for the time being -- see not below
  tinyMark: TinyMark
  private currentUrl: string = ''
  private boundOnActivated?: () => void
  private boundOnUpdated?: (tabId: number, changeInfo: any) => void

  static get properties() {
    return {
      messages: { type: Array },
      inputValue: { type: String },
      loading: { type: Boolean },
      tinyMark: { type: Object },
    }
  }

  constructor() {
    super()
    this.messages = []
    this.inputValue = ''
    this.loading = false
    this.tinyMark = new TinyMark()
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadHistory()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
    this.boundOnActivated = () => this.onTabEvent()
    this.boundOnUpdated = (tabId: number, changeInfo: any) => this.onTabUpdated(tabId, changeInfo)
    browser.tabs.onActivated.addListener(this.boundOnActivated)
    browser.tabs.onUpdated.addListener(this.boundOnUpdated)
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'chat_message_result') {
      const response = message.result
      this.loading = false

      this.messages = [
        ...this.messages,
        { role: 'assistant', content: response },
      ]
      this.updated()
      // Scroll to bottom after new message
      this.updateComplete.then(() => {
        this.handleScrollToBottom()
      })
    }
  }

  async fetchPageContent(): Promise<{
    textContent: string
    siteName: string
  } | null> {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    const pageContent = tab?.id
      ? await browser.tabs.sendMessage(tab.id, {
          type: 'get_page_content',
          data: {},
        })
      : null

    return pageContent
  }

  // helper to get the current active tab URL
  private async getCurrentUrl(): Promise<string> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    return tab?.url || ''
  }

  // Load stored chat history from browser.storage.local
  async loadHistory() {
    try {
      const url = await this.getCurrentUrl()
      this.currentUrl = url
      const { chat_history } = await browser.storage.local.get(
        LocalStorageKeys.CHAT_HISTORY,
      ) as any
      const val = (chat_history as any)
      if (Array.isArray(val)) {
        // Backward-compat: migrate flat array to per-URL map
        this.messages = val
        try {
          await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: { [url]: val } })
        } catch (_) {}
      } else if (val && typeof val === 'object') {
        this.messages = Array.isArray(val[url]) ? val[url] : []
      } else {
        this.messages = []
      }
      this.updateComplete.then(() => {
        this.handleScrollToBottom()
      })
    } catch (e) {
      console.warn('Failed to load chat history:', e)
    }
  }

  private onTabEvent() {
    ;(async () => {
      try {
        const url = await this.getCurrentUrl()
        this.currentUrl = url
        await this.loadHistory()
      } catch (_) {}
    })()
  }

  private onTabUpdated(_tabId: number, changeInfo: any) {
    ;(async () => {
      try {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true })
        if (!active) return
        const isActiveUpdated = _tabId === active.id
        const newUrl: string | undefined = changeInfo?.url
        if (isActiveUpdated && newUrl && newUrl !== this.currentUrl) {
          const res: any = await browser.storage.local.get([
            LocalStorageKeys.CHAT_HISTORY,
            LocalStorageKeys.CHAT_TOKENS,
          ])
          let histMap = res?.[LocalStorageKeys.CHAT_HISTORY]
          let tokenMap = res?.[LocalStorageKeys.CHAT_TOKENS]
          if (!histMap || typeof histMap !== 'object' || Array.isArray(histMap)) histMap = {}
          if (!tokenMap || typeof tokenMap !== 'object' || Array.isArray(tokenMap)) tokenMap = {}

          const oldMsgs = Array.isArray(histMap[this.currentUrl]) ? histMap[this.currentUrl] : []
          const oldTokens = Array.isArray(tokenMap[this.currentUrl]) ? tokenMap[this.currentUrl] : []
          const newMsgs = Array.isArray(histMap[newUrl]) ? histMap[newUrl] : []
          const newTokens = Array.isArray(tokenMap[newUrl]) ? tokenMap[newUrl] : []

          if (oldMsgs.length && (!newMsgs.length)) {
            histMap[newUrl] = oldMsgs
            delete histMap[this.currentUrl]
          }
          if (oldTokens.length && (!newTokens.length)) {
            tokenMap[newUrl] = oldTokens
            delete tokenMap[this.currentUrl]
          }
          await browser.storage.local.set({
            [LocalStorageKeys.CHAT_HISTORY]: histMap,
            [LocalStorageKeys.CHAT_TOKENS]: tokenMap,
          })
          this.currentUrl = newUrl
          await this.loadHistory()
        } else if (changeInfo?.status === 'complete') {
          await this.loadHistory()
        }
      } catch (_) {}
    })()
  }

  // Persist chat history whenever messages change
  async updated() {
    try {
      const url = this.currentUrl || (await this.getCurrentUrl())
      const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
      let map = res?.[LocalStorageKeys.CHAT_HISTORY]
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
      map[url] = this.messages
      await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: map })
    } catch (e) {
      console.error(e)
    }
  }

  disconnectedCallback(): void {
    if (this.boundOnActivated) browser.tabs.onActivated.removeListener(this.boundOnActivated)
    if (this.boundOnUpdated) browser.tabs.onUpdated.removeListener(this.boundOnUpdated)
    super.disconnectedCallback()
  }

  // Called when the user clicks Send or presses Enter
  async handleSend(includePageContent = false) {
    const text = this.inputValue.trim()
    if (!text || this.loading) return

    // Add user bubble
    this.messages = [...this.messages, { role: 'user', content: text }]
    try {
      const url = this.currentUrl || (await this.getCurrentUrl())
      const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
      let map = res?.[LocalStorageKeys.CHAT_HISTORY]
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
      map[url] = this.messages
      await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: map })
    } catch (e) {
      console.error(e)
    }
    this.inputValue = ''
    this.loading = true

    // Scroll to bottom after new message
    this.updateComplete.then(() => {
      this.handleScrollToBottom()
    })

    const systemMessage: ChatMessageT = {
      role: 'system',
      content: 'You are a helpful assistant. You are trustworthy and helpful.',
    }

    let messagesToSend: ChatMessageT[]

    // this ended up not working well for some reason -- it seems to break cause the model to repeat itself
    if (!this.hasSystemMessage) {
      this.hasSystemMessage = true
      messagesToSend = [systemMessage, ...this.messages]
    } else {
      messagesToSend = this.messages
    }

    if (includePageContent) {
      const safetyCheck = await pageRestrictionService.checkPageRestricted()

      if (safetyCheck.isRestricted) {
        alert(`This page is restricted: ${safetyCheck.reason}`)
        this.loading = false
        return
      }
      const pageContent = await this.fetchPageContent()

      if (pageContent) {
        const lastUserIndex = messagesToSend.length - 1

        // Insert page content before the last user message
        messagesToSend.splice(lastUserIndex, 0, {
          role: 'system',
          content: `Here is the page content:\n\n${pageContent.textContent.slice(0, 1000)}`,
        })
      }
    }

    browser.runtime.sendMessage({
      type: 'chat_message',
      data: messagesToSend,
    })
  }

  handleScrollToBottom() {
    const container = this.shadowRoot?.querySelector('.chat-window')
    if (!container) return
    // turn this into a smooth scroll
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.handleSend()
    }
  }

  handleClearChat() {
    this.messages = []
    this.inputValue = ''
    ;(async () => {
      try {
        const url = this.currentUrl || (await this.getCurrentUrl())
        const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
        let map = res?.[LocalStorageKeys.CHAT_HISTORY]
        if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
        map[url] = []
        await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: map })
      } catch (e) {
        console.error(e)
      }
    })()
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Chat with AI</h3>
          <div class="chat-window">
            ${this.messages.map(
              (msg) => html`
                <div class="bubble-wrapper ${msg.role}">
                  <div class="bubble ${msg.role}">
                    <div
                      class="text"
                      .innerHTML=${this.tinyMark.parse(msg.content)}
                    ></div>
                  </div>
                </div>
              `,
            )}
            ${this.loading
              ? html`<div class="loading-indicator">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div> `
              : ''}
          </div>

          <textarea
            .value=${this.inputValue}
            @input=${(e: Event) =>
              (this.inputValue = (e.target as HTMLTextAreaElement).value)}
            @keydown=${this.onKeydown}
            placeholder="Type your message…"
            ?disabled=${this.loading}
          ></textarea>

          <div class="footer">
            <button class="secondary-button" @click=${this.handleClearChat}>
              Clear Chat
            </button>
            <button
              class="primary-button"
              @click=${this.handleSend}
              ?disabled=${!this.inputValue.trim() || this.loading}
            >
              ${this.loading ? '…' : 'Send'}
            </button>
            <button
              class="primary-button"
              @click=${() => this.handleSend(true)}
              ?disabled=${!this.inputValue.trim() || this.loading}
            >
              ${this.loading ? '…' : 'Send with page'}
            </button>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return [
      FeatureViewStyles,
      css`
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

        .chat-window {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: var(--color-response-bg);
          position: relative;
        }

        .bubble-wrapper {
          margin-bottom: 12px;
        }

        .bubble-wrapper.user {
          display: flex;
          justify-content: flex-end;
        }

        .bubble {
          max-width: 70%;
          padding: 0.6rem 1rem;
          border-radius: 1rem;
          line-height: 1.4;
          word-break: break-word;
        }

        .bubble.user {
          background: var(--color-primary);
          color: white;
          border-bottom-right-radius: 0;
        }

        .bubble.assistant {
          background: #e5e5ea;
          color: black;
          align-self: flex-start;
          border-bottom-left-radius: 0;
        }

        textarea {
          resize: none;
          padding: 8px;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          background-color: var(--color-input-bg);
          color: var(--color-fg);
          margin: 12px 0;
        }

        .footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          align-items: center;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 12px;
          margin-left: 12px;
          width: 50px;
          height: 30px;
        }

        .dot {
          width: 10px;
          height: 10px;
          background-color: var(--color-fg);
          border-radius: 50%;
          opacity: 0;
          animation: typing 2s infinite;
        }

        .dot:nth-child(1) {
          animation-delay: 0s;
        }

        .dot:nth-child(2) {
          animation-delay: 0.5s;
        }

        .dot:nth-child(3) {
          animation-delay: 1s;
        }

        @keyframes typing {
          0%,
          100% {
            opacity: 0;
          }
          25%,
          75% {
            opacity: 1;
          }
        }
      `,
    ]
  }
}

export default MozChat
