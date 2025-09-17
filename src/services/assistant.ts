import { LocalStorageKeys } from '../../const'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'
import { assistantTools, get_page_contents, get_insights, search_history, get_tabs, get_current_tab } from './assistantTools'


export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessage = {
  role: ChatRole
  content: string
  ts?: number
  tool_call_id?: string
  tool_calls?: any[]
}

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
    const { chat_history } = await browser.storage.local.get(
      LocalStorageKeys.CHAT_HISTORY,
    )
    const { chat_tokens } = await browser.storage.local.get(
      LocalStorageKeys.CHAT_TOKENS,
    )
    this.messages = chat_history || []
    this.tokenUsages = Array.isArray(chat_tokens) ? chat_tokens : []
    return this.messages
  }

  getAll() {
    return this.messages
  }

  async setAll(messages: ChatMessage[]) {
    this.messages = messages
    await browser.storage.local.set({
      [LocalStorageKeys.CHAT_HISTORY]: this.messages,
    })
  }

  async append(message: ChatMessage) {
    this.messages = [...this.messages, { ...message, ts: Date.now() }]
    await browser.storage.local.set({
      [LocalStorageKeys.CHAT_HISTORY]: this.messages,
    })
  }

  async clear() {
    this.messages = []
    this.tokenUsages = []
    await browser.storage.local.set({
      [LocalStorageKeys.CHAT_HISTORY]: [],
      [LocalStorageKeys.CHAT_TOKENS]: [],
    })
  }

  getTokenUsages() {
    return this.tokenUsages
  }

  async addTokenUsage(usage: { prompt?: number; completion?: number; total?: number }) {
    const u = {
      prompt: usage.prompt ?? 0,
      completion: usage.completion ?? 0,
      total: usage.total ?? (usage.prompt ?? 0) + (usage.completion ?? 0),
    }
    this.tokenUsages = [...this.tokenUsages, u]
    await browser.storage.local.set({ [LocalStorageKeys.CHAT_TOKENS]: this.tokenUsages })
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
    initOpenAIClient({apiKey: togetherai_api_key, baseURL: togetherai_url || "https://api.together.xyz/v1" })
  }

  async send(messages: ChatMessage[]) {
    await this.initialize()

    const TOOL_DISPATCH: any = {
      get_page_contents,
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
          tools: assistantTools as any,
          timeoutMs: 15000,
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

      // Special handling: suggest a clickable Google search instead of executing dummy search_engine
      if (name === 'search_engine') {
        const q = typeof args?.query === 'string' ? args.query : ''
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`
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
      const fn = TOOL_DISPATCH[name]
      const output = await (fn ? fn(args) : Promise.resolve({ error: `Unknown tool: ${name}` }))
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
