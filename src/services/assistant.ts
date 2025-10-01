import { LocalStorageKeys } from '../../const'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'
import type { ChatMessage } from './utilsOpenAI'
import { assistantTools, get_page_content, get_insights, search_history, get_tabs, get_current_tab } from './assistantTools'


export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export class AssistantStore {
  private static instance: AssistantStore | null = null
  private messages: ChatMessage[] = []
  private tokenUsages: Array<{ prompt: number; completion: number; total: number }> = []

  static getInstance() {
    if (!AssistantStore.instance) {
      AssistantStore.instance = new AssistantStore()
    }
    return AssistantStore.instance
  }

  async load() {
    const tab = await get_current_tab({})
    const url = (tab?.url || '') as string

    const resHist: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
    let histVal: any = resHist?.[LocalStorageKeys.CHAT_HISTORY]

    let migratedHistory = false
    let historyMap: Record<string, ChatMessage[]> = {}
    if (Array.isArray(histVal)) {
      // Backward-compat: old format was a flat array for a single conversation
      historyMap = { [url]: histVal as ChatMessage[] }
      migratedHistory = true
    } else if (histVal && typeof histVal === 'object') {
      historyMap = histVal as Record<string, ChatMessage[]>
    }

    const resTokens: any = await browser.storage.local.get(LocalStorageKeys.CHAT_TOKENS)
    let tokenVal: any = resTokens?.[LocalStorageKeys.CHAT_TOKENS]
    let migratedTokens = false
    let tokenMap: Record<string, Array<{ prompt: number; completion: number; total: number }>> = {}
    if (Array.isArray(tokenVal)) {
      tokenMap = { [url]: tokenVal as Array<{ prompt: number; completion: number; total: number }> }
      migratedTokens = true
    } else if (tokenVal && typeof tokenVal === 'object') {
      tokenMap = tokenVal as Record<string, Array<{ prompt: number; completion: number; total: number }>>
    }

    this.messages = Array.isArray(historyMap[url]) ? historyMap[url] : []
    this.tokenUsages = Array.isArray(tokenMap[url]) ? tokenMap[url] : []

    if (migratedHistory || migratedTokens) {
      const payload: any = {}
      if (migratedHistory) payload[LocalStorageKeys.CHAT_HISTORY] = historyMap
      if (migratedTokens) payload[LocalStorageKeys.CHAT_TOKENS] = tokenMap
      try { await browser.storage.local.set(payload) } catch (_) {}
    }
    return this.messages
  }

  getAll() {
    return this.messages
  }

  async setAll(messages: ChatMessage[]) {
    const tab = await get_current_tab({})
    const url = (tab?.url || '') as string
    this.messages = messages
    const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
    let map = res?.[LocalStorageKeys.CHAT_HISTORY]
    if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
    map[url] = this.messages
    await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: map })
  }

  async append(message: ChatMessage) {
    const tab = await get_current_tab({})
    const url = (tab?.url || '') as string
    this.messages = [...this.messages, { ...message, ts: Date.now() }]
    const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_HISTORY)
    let map = res?.[LocalStorageKeys.CHAT_HISTORY]
    if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
    map[url] = this.messages
    await browser.storage.local.set({ [LocalStorageKeys.CHAT_HISTORY]: map })
  }

  async clear() {
    const tab = await get_current_tab({})
    const url = (tab?.url || '') as string
    this.messages = []
    this.tokenUsages = []

    const res: any = await browser.storage.local.get([
      LocalStorageKeys.CHAT_HISTORY,
      LocalStorageKeys.CHAT_TOKENS,
    ])
    let histMap = res?.[LocalStorageKeys.CHAT_HISTORY]
    let tokenMap = res?.[LocalStorageKeys.CHAT_TOKENS]
    if (!histMap || typeof histMap !== 'object' || Array.isArray(histMap)) histMap = {}
    if (!tokenMap || typeof tokenMap !== 'object' || Array.isArray(tokenMap)) tokenMap = {}
    histMap[url] = []
    tokenMap[url] = []
    await browser.storage.local.set({
      [LocalStorageKeys.CHAT_HISTORY]: histMap,
      [LocalStorageKeys.CHAT_TOKENS]: tokenMap,
    })
  }

  getTokenUsages() {
    return this.tokenUsages
  }

  async addTokenUsage(usage: { prompt?: number; completion?: number; total?: number }) {
    const tab = await get_current_tab({})
    const url = (tab?.url || '') as string
    const u = {
      prompt: usage.prompt ?? 0,
      completion: usage.completion ?? 0,
      total: usage.total ?? (usage.prompt ?? 0) + (usage.completion ?? 0),
    }
    this.tokenUsages = [...this.tokenUsages, u]
    const res: any = await browser.storage.local.get(LocalStorageKeys.CHAT_TOKENS)
    let map = res?.[LocalStorageKeys.CHAT_TOKENS]
    if (!map || typeof map !== 'object' || Array.isArray(map)) map = {}
    map[url] = this.tokenUsages
    await browser.storage.local.set({ [LocalStorageKeys.CHAT_TOKENS]: map })
  }
}

// Removed applyChatTemplate: we pass raw chat messages to the engine.

export class AssistantService {
  private modelId: string = 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput'

  async initialize() {
    const { togetherai_url, togetherai_api_key, togetherai_model } = await browser.storage.local.get([
      LocalStorageKeys.TOGETHERAI_URL,
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
    ])

    this.modelId = togetherai_model || this.modelId
    initOpenAIClient({apiKey: togetherai_api_key, baseURL: togetherai_url })
  }

  async send(messages: ChatMessage[]) {
    await this.initialize()

    const TOOL_DISPATCH: any = {
      get_page_content,
      search_history,
      get_insights,
      get_tabs,
      get_current_tab,
    }

    let convo: ChatMessage[] = [...messages]
    // Keep invoking tools until the model returns a natural-language reply.
    // Safety guard: break if iterations exceed a high threshold.
    let iterations = 0
    while (true) {
      console.log('[assistant] request iteration', { iterations, messagesCount: convo.length })
      let result: any
      try {
        result = await chatComplete({
          model: this.modelId,
          // @ts-ignore
          messages: convo as any,
          tools: assistantTools as any
        })
      } catch (err) {
        console.warn('[assistant] Together request failed:', err)
        result = undefined
      }

      if (!result) return 'The AI request failed or timed out. Please try again.'

      const resAny = result as any
      // Track token usage if provided (raw OpenAI-style usage)
      const usage = resAny?.usage
      if (usage) {
        try {
          await assistantStore.addTokenUsage({
            prompt: usage.prompt_tokens ?? 0,
            completion: usage.completion_tokens ?? 0,
            total: usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)),
          })
        } catch (_) {}
      }

      const first = resAny?.choices?.[0]
      const toolCalls: any[] = first?.message?.tool_calls || []

      if (!toolCalls.length) {
        const out = first?.message?.content || first?.text || 'No content returned.'
        // Log cumulative token usage
        try {
          const usages = assistantStore.getTokenUsages()
          const totals = usages.reduce(
            (acc, u) => ({
              prompt: acc.prompt + (u.prompt || 0),
              completion: acc.completion + (u.completion || 0),
              total: acc.total + (u.total || 0),
            }),
            { prompt: 0, completion: 0, total: 0 },
          )
          console.log('[assistant][tokens] prompt=%d completion=%d total=%d', totals.prompt, totals.completion, totals.total)
        } catch (_) {}
        return out
      }

      // append assistant tool call message (not shown in UI)
      const assistantCallMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        // @ts-ignore
        tool_calls: toolCalls,
      }
      convo = [...convo, assistantCallMessage]

      // execute ONLY the first tool call (log name and args for debugging)
      const call = toolCalls[0]
      const name = call.function?.name
      let args: any = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch (_) {}
      console.log('[assistant][tool-call]', name, args)

      // Special handling for search_engine: either suggest a button (default)
      // or auto-open and summarize the SERP based on user toggle.
      let output: any
      if (name === 'search_engine') {
        const q = typeof args?.query === 'string' ? args.query : ''
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`

        // Read user preference (default: false => keep button behavior)
        let autoSummarize = false
        try {
          const { assistant_auto_search_summarize } = await browser.storage.local.get(
            LocalStorageKeys.ASSISTANT_AUTO_SEARCH_SUMMARIZE,
          )
          autoSummarize = !!assistant_auto_search_summarize
        } catch (_) {}

        if (!autoSummarize) {
          // Return a special marker for the UI to render a button
          try {
            const usages = assistantStore.getTokenUsages()
            const totals = usages.reduce(
              (acc, u) => ({
                prompt: acc.prompt + (u.prompt || 0),
                completion: acc.completion + (u.completion || 0),
                total: acc.total + (u.total || 0),
              }),
              { prompt: 0, completion: 0, total: 0 },
            )
            console.log('[assistant][tokens] prompt=%d completion=%d total=%d', totals.prompt, totals.completion, totals.total)
          } catch (_) {}
          return `SEARCH_BUTTON:${url}|Search the web for \"${q}\"`
        }

        // Auto open SERP in background, wait for load, then fetch page content
        const waitForComplete = (tabId: number, timeoutMs = 10000) =>
          new Promise<void>((resolve) => {
            let done = false
            const timer = setTimeout(() => {
              if (done) return
              done = true
              try { browser.tabs.onUpdated.removeListener(listener) } catch (_) {}
              resolve()
            }, timeoutMs)
            const listener = (updatedTabId: number, changeInfo: any) => {
              if (updatedTabId === tabId && changeInfo.status === 'complete') {
                if (done) return
                done = true
                clearTimeout(timer)
                try { browser.tabs.onUpdated.removeListener(listener) } catch (_) {}
                resolve()
              }
            }
            browser.tabs.onUpdated.addListener(listener)
          })

        try {
          const tab = await browser.tabs.create({ url, active: false })
          if (tab.id) await waitForComplete(tab.id, 5000)
        } catch (e) {
          console.warn('[assistant][search_engine] failed to open SERP:', e)
        }

        // Fetch content from the opened SERP
        try {
          const page = await get_page_content({ url })
          output = { url, page }
        } catch (e) {
          output = { url, error: 'Failed to retrieve SERP content.' }
        }
      } else {
        const fn = TOOL_DISPATCH[name]
        output = await (fn ? fn(args) : Promise.resolve({ error: `Unknown tool: ${name}` }))
      }
      const toolMessage: ChatMessage = {
        role: 'tool',
        content: typeof output === 'string' ? output : JSON.stringify(output),
        // @ts-ignore
        tool_call_id: call.id,
      }
      convo = [...convo, toolMessage]

      iterations += 1
      if (iterations > 20) {
        console.warn('[assistant] breaking after too many tool iterations')
        break
      }
    }

    try {
      const usages = assistantStore.getTokenUsages()
      const totals = usages.reduce(
        (acc, u) => ({
          prompt: acc.prompt + (u.prompt || 0),
          completion: acc.completion + (u.completion || 0),
          total: acc.total + (u.total || 0),
        }),
        { prompt: 0, completion: 0, total: 0 },
      )
      console.log('[assistant][tokens] prompt=%d completion=%d total=%d', totals.prompt, totals.completion, totals.total)
    } catch (_) {}
    return 'No content returned.'
  }
}

export const assistantStore = AssistantStore.getInstance()
export const assistantService = new AssistantService()
// Eagerly initialize engine (non-blocking)
void assistantService.initialize()
