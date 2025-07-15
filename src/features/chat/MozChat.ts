import { LitElement, html, css } from 'lit'
import { LocalStorageKeys } from '../../../const'

type ChatMessageT = {
  role: 'user' | 'assistant' | "system"
  content: string
  ts?: number
}

class MozChat extends LitElement {
  messages: ChatMessageT[] = []
  inputValue = ''
  loading = false
  hasSystemMessage = false

  static get properties() {
    return {
      messages: { type: Array },
      inputValue: { type: String },
      loading: { type: Boolean },
    }
  }

  constructor() {
    super()
    this.messages = []
    this.inputValue = ''
    this.loading = false
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadHistory()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'chat_message_result') {
      console.log("[handleIncomingMessage]", message)
      const response = message.result
      this.loading = false

      this.messages = [...this.messages, { role: 'assistant', content: response }]
      this.updated()
      // Scroll to bottom after new message
      this.updateComplete.then(() => {
        this.handleScrollToBottom()
      })
    }
  }

  // Load stored chat history from browser.storage.local
  async loadHistory() {
    try {
      const { chat_history } = await browser.storage.local.get(
        LocalStorageKeys.CHAT_HISTORY
      )
      this.messages = chat_history ? chat_history : []
      this.updateComplete.then(() => {
        this.handleScrollToBottom()
      })
    } catch (e) {
      console.warn('Failed to load chat history:', e)
    }
  }

  // Persist chat history whenever messages change
  updated() {
    browser.storage.local
      .set({ [LocalStorageKeys.CHAT_HISTORY]: this.messages })
      .catch(console.error)
  }

  // Called when the user clicks Send or presses Enter
  async handleSend() {
    const text = this.inputValue.trim()
    if (!text || this.loading) return

    // Add user bubble
    this.messages = [...this.messages, { role: 'user', content: text }]
    browser.storage.local
      .set({ [LocalStorageKeys.CHAT_HISTORY]: this.messages })
      .catch(console.error)
    this.inputValue = ''
    this.loading = true

    // Scroll to bottom after new message
    this.updateComplete.then(() => {
      this.handleScrollToBottom()
    })

    const systemMessage: ChatMessageT = {
      role: "system",
      content: "You are a helpful assistant. You are trustworthy and helpful."
    }

    let messagesToSend: ChatMessageT[]
    
    if (!this.hasSystemMessage) {
      this.hasSystemMessage = true
      messagesToSend = [systemMessage, ...this.messages]
    } else {
      messagesToSend = this.messages
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
    browser.storage.local
      .set({ [LocalStorageKeys.CHAT_HISTORY]: [] })
      .catch(console.error)
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
                    <div class="text">${msg.content}</div>
                  </div>
                </div>
              `
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
            <button class="outline-button" @click=${this.handleClearChat}>
              Clear Chat
            </button>
            <button
              class="primary-button"
              @click=${this.handleSend}
              ?disabled=${!this.inputValue.trim() || this.loading}
            >
              ${this.loading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        --color-bg: #202020;
        --color-fg: #ffffff;
        --color-fg-subtle: #b0b0b0;
        --color-border: #007bff;
        --color-input-bg: #424242;
        --color-secondary-hover: #585858;
        --color-loader-bg: #424242;
        --color-response-bg: #2d2c2c;
        --color-primary: #007bff;
        --color-primary-disabled: #6d6d6d;
      }

      .wrapper {
        display: block;
        padding: 10px;
        color: var(--color-fg);
        background-color: var(--color-bg);
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

      .bubble.ai {
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

      .primary-button {
        padding: 8px 12px;
        background-color: var(--color-border);
        color: var(--color-fg);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        cursor: pointer;

        &:disabled {
          background-color: var(--color-primary-disabled);
          border-color: var(--color-primary-disabled);
          cursor: not-allowed;
        }
      }

      .outline-button {
        padding: 8px 12px;
        color: var(--color-fg);
        border: 1px solid var(--color-fg);
        border-radius: 4px;
        cursor: pointer;
        background-color: transparent;
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
    `
  }
}

export default MozChat
