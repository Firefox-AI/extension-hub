import { LitElement, html, css } from 'lit'
import { FeatureViewStyles } from '../FeatureViewStyles'
import { assistantStore } from '../../services/assistant'
import { sendAndStream } from '../../services/assistantConversation'
import TinyMark from '../../services/tinyMark'
import type { ChatMessage } from '../../services/utilsOpenAI'
import { getQuickPrompts, getQuickPromptsInConversation } from '../../services/assistantQuickPrompts'
import { formatInsightsMarkdown } from '../../services/assistantInsight'
import { readInsights } from '../../services/historyInsight'
import { LocalStorageKeys } from '../../../const'

class MozAssistantChat extends LitElement {
  messages: ChatMessage[] = []
  inputValue: string = ''
  loading: boolean = false
  tinyMark: TinyMark
  quickPrompts: string[] = []
  insightText: string = ''
  insightLoading: boolean = false
  private boundOnActivated?: () => void
  private boundOnUpdated?: (tabId: number, changeInfo: any) => void
  autoSearchSummarize: boolean = false
  private currentTabId?: number
  private currentUrl: string = ''
  private messageInsights: Record<number, Array<{ tag: string; value: string }>> = {}
  conversationTitle: string = 'Assistant'

  static properties = {
    messages: { type: Array },
    inputValue: { type: String },
    loading: { type: Boolean },
    tinyMark: { type: Object },
    quickPrompts: { type: Array },
    insightText: { type: String },
    insightLoading: { type: Boolean },
    autoSearchSummarize: { type: Boolean },
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
    this.messageInsights = {}
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      this.currentTabId = tab?.id
      this.currentUrl = tab?.url || ''
    } catch (_) {}
    try {
      const { assistant_auto_search_summarize } = await browser.storage.local.get(
        LocalStorageKeys.ASSISTANT_AUTO_SEARCH_SUMMARIZE,
      )
      this.autoSearchSummarize = !!assistant_auto_search_summarize
    } catch (_) {}
    // Preload up to 2 suggestions only if no conversation yet
    if (this.messages.length === 0) {
      this.quickPrompts = await getQuickPrompts(2)
    }
  }

  async handleSend(textOverride?: unknown) {
    const overrideStr = typeof textOverride === 'string' ? textOverride : undefined
    const text = (overrideStr ?? this.inputValue).trim()
    if (!text || this.loading) return
    // Optimistically render the user's message immediately
    this.messages = [...this.messages, { role: 'user', content: text }]
    this.loading = true
    if (!textOverride) this.inputValue = ''
    // Hide suggestions once the user starts typing/sending
    if (this.messages.length > 0) this.quickPrompts = []
    try {
      // Insert placeholder assistant message for streaming
      const assistantIndex = this.messages.length
      this.messages = [...this.messages, { role: 'assistant', content: '' }]

      let insideTag = false
      let tagBuffer = ''
      let visible = ''
      const insights: Array<{ tag: string; value: string }> = []
      let capturedTitle: string | null = null

      const onDelta = (delta: string) => {
        for (let i = 0; i < delta.length; i++) {
          const ch = delta[i]
          if (ch === '§') {
            if (!insideTag) {
              insideTag = true
              tagBuffer = ''
            } else {
              const raw = tagBuffer.trim()
              const insightMatch = /^\s*insight\s*:\s*(.+)$/i.exec(raw)
              const titleMatch = /^\s*title\s*:\s*(.+)$/i.exec(raw)
              
              if (insightMatch && insightMatch[1]) {
                insights.push({ tag: 'insight', value: insightMatch[1].trim() })
              } else if (titleMatch && titleMatch[1] && !capturedTitle) {
                // Capture title but don't add to visible content
                capturedTitle = titleMatch[1].trim()
                this.conversationTitle = capturedTitle
                console.log('[assistant] captured title:', capturedTitle)
              }
              
              insideTag = false
              tagBuffer = ''
            }
            continue
          }
          if (insideTag) tagBuffer += ch
          else visible += ch
        }
        const updated = [...this.messages]
        updated[assistantIndex] = { ...updated[assistantIndex], content: visible }
        this.messages = updated
        this.requestUpdate()
        this.updateComplete.then(() => this.scrollToBottom())
      }

      const onEnd = async (_final: string) => {
        this.messageInsights[assistantIndex] = insights
        try {
          await assistantStore.append({ role: 'assistant', content: visible })
        } catch (e) {
          console.warn('[assistant][stream] persist failed:', e)
        }
        try {
          const last = [...this.messages].reverse().find((m) => m.role === 'assistant')
          const isSearchButton = last && typeof last.content === 'string' && last.content.startsWith('SEARCH_BUTTON:')
          if (!isSearchButton) {
            const next = await getQuickPromptsInConversation(this.messages, 2)
            this.quickPrompts = next
          }
        } catch (e) {
          console.warn('[assistant][quick-prompts] in-convo generation failed:', e)
        }
        this.loading = false
        this.requestUpdate()
        this.updateComplete.then(() => this.scrollToBottom())
      }

      await sendAndStream(text, { onDelta, onEnd })
    } catch (err) {
      console.error('[assistant] send stream failed:', err)
      this.messages = [...this.messages, { role: 'assistant', content: 'Sorry, the request was aborted. Please try again.' }]
      this.loading = false
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
    this.messageInsights = {}
    this.conversationTitle = 'Assistant'
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
          <div class="header">
            <h3 class="title">${this.conversationTitle}</h3>
            <label class="toggle">
              <input
                type="checkbox"
                .checked=${this.autoSearchSummarize}
                @change=${async (e: Event) => {
                  const checked = (e.target as HTMLInputElement).checked
                  this.autoSearchSummarize = checked
                  try {
                    await browser.storage.local.set({
                      [LocalStorageKeys.ASSISTANT_AUTO_SEARCH_SUMMARIZE]: checked,
                    })
                  } catch (_) {}
                }}
              />
              <span>Auto open search and summarize</span>
            </label>
          </div>
          <div class="chat-window">
            ${this.messages.map(
              (m, idx) => html`
                <div class="bubble-wrapper ${m.role}">
                  <div class="bubble ${m.role}">
                    ${renderAssistantContent(m.content)}
                    ${m.role === 'assistant' && this.messageInsights[idx] && this.messageInsights[idx].length
                      ? html`<div class="inline-insights">
                          ${this.messageInsights[idx].map((ins) => html`<span class="chip">${ins.tag}: ${ins.value}</span>`)}
                        </div>`
                      : ''}
                  </div>
                </div>`,
            )}
            ${this.loading
              ? html`<div class="loading">Thinking…</div>`
              : ''}
          </div>

          ${this.insightLoading || this.insightText
            ? html`<div class="insight-section">
                <div class="insight-header">
                  <strong>User Insights</strong>
                  <div class="insight-actions">
                    <button class="icon-button" title="Close" @click=${() => this.handleCloseInsight()}>✕</button>
                  </div>
                </div>
                <div class="insight-body">
                  ${this.insightLoading
                    ? html`<div class="loading">Generating insights…</div>`
                    : html`<div class="text" .innerHTML=${this.tinyMark.parse(this.insightText)}></div>`}
                </div>
              </div>`
            : ''}

          ${this.quickPrompts.length
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
            <div class="footer-left">
              <button class="secondary-button" @click=${() => this.handleLoadSavedInsight()} ?disabled=${this.insightLoading}>
                Load insights
              </button>
              <button class="secondary-button" @click=${() => this.handleClearInsights()} ?disabled=${this.insightLoading}>
                Clear insights
              </button>
            </div>
            <div class="footer-right">
              <button class="secondary-button" @click=${this.handleClear}>
                Clear chat
              </button>
              <button
                class="primary-button"
                @click=${() => this.handleSend()}
                ?disabled=${!this.inputValue.trim() || this.loading}
              >
                ${this.loading ? '…' : 'Send'}
              </button>
            </div>
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
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .chat-window { flex: 1; overflow-y: auto; padding: 1rem; background: var(--color-response-bg); }
      .bubble-wrapper { margin-bottom: 12px; }
      .bubble-wrapper.user { display: flex; justify-content: flex-end; }
      .bubble { max-width: 70%; padding: 0.6rem 1rem; border-radius: 1rem; line-height: 1.4; }
      .bubble.user { background: var(--color-primary); color: #fff; border-bottom-right-radius: 0; }
      .bubble.assistant { background: #e5e5ea; color: #000; border-bottom-left-radius: 0; }
      textarea { resize: none; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-input-bg); color: var(--color-fg); margin: 12px 0; }
      .footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .footer-left, .footer-right { display: flex; gap: 8px; align-items: center; }
      .toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-fg-subtle); }
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
      .insight-section {
        margin-top: 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-response-bg);
      }
      .insight-header {
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border);
        font-size: 13px;
        color: var(--color-fg);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .insight-body {
        padding: 10px 12px;
      }
      .inline-insights { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
      .chip { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 9999px; padding: 2px 8px; font-size: 12px; }
      .icon-button {
        background: transparent;
        border: none;
        color: var(--color-fg-subtle);
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .icon-button:hover {
        background: rgba(0,0,0,0.05);
      }
    `,
  ]
  

  private onTabEvent() {
    ;(async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
        this.currentTabId = tab?.id
        this.currentUrl = tab?.url || ''
        await assistantStore.load()
        this.messages = assistantStore.getAll()
        this.messageInsights = {}
      } catch (_) {}
      this.refreshQuickPrompts()
      this.updateComplete.then(() => this.scrollToBottom())
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
          // Migrate stored keys from old URL -> new URL
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
          await assistantStore.load()
          this.messages = assistantStore.getAll()
          this.messageInsights = {}
        } else if (changeInfo?.status === 'complete') {
          // Just refresh to reflect any page-derived context changes
          await assistantStore.load()
          this.messages = assistantStore.getAll()
          this.messageInsights = {}
        }
      } catch (_) {}
      this.refreshQuickPrompts()
      this.updateComplete.then(() => this.scrollToBottom())
    })()
  }

  private async refreshQuickPrompts() {
    if (this.messages.length === 0) {
      this.quickPrompts = await getQuickPrompts(2)
    }
  }

  private handleCloseInsight() {
    this.insightText = ''
    this.insightLoading = false
  }

  private async handleClearInsights() {
    try {
      await browser.storage.local.set({
        [LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS]: [],
        [LocalStorageKeys.HISTORY_INSIGHTS]: [],
      })
      this.insightText = ''
      this.insightLoading = false
    } catch (e) {
      console.warn('[assistant][insight] clear failed:', e)
    }
  }

  private async handleLoadSavedInsight() {
    if (this.insightLoading) return
    this.insightLoading = true
    try {
      const json = await readInsights()
      // Convert to display map
      const cats = Array.isArray(json?.categories) ? json.categories : []
      const map: Record<string, string[]> = {}
      for (const c of cats) {
        const name = (c?.name ?? '').toString()
        if (!name) continue
        const attrs = Array.isArray(c?.top_user_attributes) ? c.top_user_attributes.map((x: any) => String(x)) : []
        if (attrs.length) map[name] = Array.from(new Set(attrs))
      }
      this.insightText = formatInsightsMarkdown(map)
    } catch (e) {
      console.warn('[assistant][insight-history] generation failed:', e)
      this.insightText = 'Failed to generate history insights.'
    } finally {
      this.insightLoading = false
      this.updateComplete.then(() => this.scrollToBottom())
    }
  }

  disconnectedCallback(): void {
    if (this.boundOnActivated) browser.tabs.onActivated.removeListener(this.boundOnActivated)
    if (this.boundOnUpdated) browser.tabs.onUpdated.removeListener(this.boundOnUpdated)
    super.disconnectedCallback()
  }
}

export default MozAssistantChat
