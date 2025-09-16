import { LitElement, html, css } from 'lit'
import { FeatureViewStyles } from '../FeatureViewStyles'
import { assistantStore } from '../../services/assistant'
import { sendAndAppend } from '../../services/assistantConversation'
import TinyMark from '../../services/tinyMark'
import { getQuickPrompts } from '../../services/assistantQuickPrompts'

class MozAssistantChat extends LitElement {
  messages: { role: string; content: string }[] = []
  inputValue: string = ''
  loading: boolean = false
  tinyMark: TinyMark
  quickPrompts: string[] = []
  private boundOnActivated?: () => void
  private boundOnUpdated?: (tabId: number, changeInfo: any) => void

  static properties = {
    messages: { type: Array },
    inputValue: { type: String },
    loading: { type: Boolean },
    tinyMark: { type: Object },
    quickPrompts: { type: Array },
  }

  connectedCallback() {
    super.connectedCallback()
    this.init()
    this.boundOnActivated = () => this.onTabEvent()
    this.boundOnUpdated = (tabId: number, changeInfo: any) => this.onTabUpdated(tabId, changeInfo)
    browser.tabs.onActivated.addListener(this.boundOnActivated)
    browser.tabs.onUpdated.addListener(this.boundOnUpdated)
  }

  constructor() {
    super()
    this.tinyMark = new TinyMark()
  }

  async init() {
    await assistantStore.load()
    this.messages = assistantStore.getAll()
    // Preload up to 2 suggestions only if no conversation yet
    if (this.messages.length === 0) {
      this.quickPrompts = await getQuickPrompts(2)
    }
  }

  async handleSend(textOverride?: string) {
    const text = (textOverride ?? this.inputValue).trim()
    if (!text || this.loading) return
    // Optimistically render the user's message immediately
    this.messages = [...this.messages, { role: 'user', content: text }]
    this.loading = true
    if (!textOverride) this.inputValue = ''
    // Hide suggestions once the user starts typing/sending
    if (this.messages.length > 0) this.quickPrompts = []
    try {
      await sendAndAppend(text)
    } catch (err) {
      console.error('[assistant] send failed:', err)
      // surface an error message in the thread for visibility
      this.messages = [
        ...assistantStore.getAll(),
        { role: 'assistant', content: 'Sorry, the request was aborted. Please try again.' },
      ]
    } finally {
      this.messages = assistantStore.getAll()
      if (this.messages.length > 0) this.quickPrompts = []
      this.loading = false
      this.updateComplete.then(() => this.scrollToBottom())
    }
  }

  scrollToBottom() {
    const el = this.renderRoot?.querySelector('.chat-window') as HTMLElement
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.handleSend()
    }
  }

  handleClear() {
    this.messages = []
    this.inputValue = ''
    assistantStore.clear()
    this.refreshQuickPrompts()
  }

  render() {
    const renderAssistantContent = (text: string) => {
      if (text.startsWith('SEARCH_BUTTON:')) {
        const payload = text.substring('SEARCH_BUTTON:'.length)
        const [href, label] = payload.split('|')
        return html`<button class="link-button" @click=${() => browser.tabs.create({ url: href })}>${label || 'Open search'}</button>`
      }
      return html`<div class="text" .innerHTML=${this.tinyMark.parse(text)}></div>`
    }
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Assistant</h3>
          <div class="chat-window">
            ${this.messages.map(
              (m) => html`
                <div class="bubble-wrapper ${m.role}">
                  <div class="bubble ${m.role}">
                    ${renderAssistantContent(m.content)}
                  </div>
                </div>`,
            )}
            ${this.loading
              ? html`<div class="loading">Thinking…</div>`
              : ''}
          </div>

          ${this.quickPrompts.length && this.messages.length === 0
            ? html`<div class="suggestions">
                ${this.quickPrompts.map(
                  (s) =>
                    html`<button
                      class="suggestion"
                      title=${s}
                      @click=${() => this.handleSend(s)}
                    >
                      ${s}
                    </button>`,
                )}
              </div>`
            : ''}

          <textarea
            .value=${this.inputValue}
            @input=${(e: Event) =>
              (this.inputValue = (e.target as HTMLTextAreaElement).value)}
            @keydown=${this.onKeydown}
            placeholder="Type your message…"
            ?disabled=${this.loading}
          ></textarea>

          <div class="footer">
            <button class="secondary-button" @click=${this.handleClear}>
              Clear
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

  static styles = [
    FeatureViewStyles,
    css`
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
        background: linear-gradient(135deg, var(--color-gradient-start) 0%, var(--color-gradient-end) 100%);
        flex-direction: column;
        border-radius: 8px;
        font-size: 14px;
      }
      .chat-window { flex: 1; overflow-y: auto; padding: 1rem; background: var(--color-response-bg); }
      .bubble-wrapper { margin-bottom: 12px; }
      .bubble-wrapper.user { display: flex; justify-content: flex-end; }
      .bubble { max-width: 70%; padding: 0.6rem 1rem; border-radius: 1rem; line-height: 1.4; }
      .bubble.user { background: var(--color-primary); color: #fff; border-bottom-right-radius: 0; }
      .bubble.assistant { background: #e5e5ea; color: #000; border-bottom-left-radius: 0; }
      textarea { resize: none; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-input-bg); color: var(--color-fg); margin: 12px 0; }
      .footer { display: flex; justify-content: flex-end; gap: 8px; }
      .loading { color: var(--color-fg-subtle); font-style: italic; }
      .suggestions { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
      .suggestion {
        max-width: 100%;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        cursor: pointer;
        background: #0ea5e9;
        color: #fff;
        border: 1px solid #0284c7;
        border-radius: 9999px;
        padding: 6px 10px;
      }
      .suggestion:hover { background: #0284c7; }
      .link-button {
        cursor: pointer;
        border: 1px solid #15803d; /* dark green */
        background: #16a34a; /* green */
        color: #fff; /* white text for contrast */
        padding: 6px 10px;
        border-radius: 8px;
      }
      .link-button:hover {
        background: #15803d; /* darker on hover */
        border-color: #166534;
      }
    `,
  ]
  

  private onTabEvent() {
    this.refreshQuickPrompts()
  }

  private onTabUpdated(_tabId: number, changeInfo: any) {
    if (changeInfo?.status === 'complete' || changeInfo?.url) {
      this.refreshQuickPrompts()
    }
  }

  private async refreshQuickPrompts() {
    if (this.messages.length === 0) {
      this.quickPrompts = await getQuickPrompts(2)
    }
  }

  disconnectedCallback(): void {
    if (this.boundOnActivated) browser.tabs.onActivated.removeListener(this.boundOnActivated)
    if (this.boundOnUpdated) browser.tabs.onUpdated.removeListener(this.boundOnUpdated)
    super.disconnectedCallback()
  }
}

export default MozAssistantChat
