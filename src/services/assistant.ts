// No tokenizer needed

import { LocalStorageKeys } from '../../const'
import OpenAI from 'openai'
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
    this.messages = chat_history || []
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
    await browser.storage.local.set({
      [LocalStorageKeys.CHAT_HISTORY]: [],
    })
  }
}

// Removed applyChatTemplate: we pass raw chat messages to the engine.

export class AssistantService {
  private client?: OpenAI
  private modelId: string = "Qwen/Qwen3-235B-A22B-Instruct-2507-tput"

  async initialize() {
    const { togetherai_api_key, togetherai_model } = await browser.storage.local.get([
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
    ])

    this.modelId = togetherai_model || this.modelId
    this.client = new OpenAI({
      apiKey: togetherai_api_key || '',
      dangerouslyAllowBrowser: true,
      baseURL: 'https://api.together.xyz/v1'
    })
  }

  async send(messages: ChatMessage[]) {
    if (!this.client) await this.initialize()

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
      const request = this.client!.chat.completions.create({
        model: this.modelId,
        // @ts-ignore
        messages: convo as any,
        tools: assistantTools as any,
      })
      const result = await Promise.race([
        request,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('request-timeout')), 15000)),
      ]).catch((err) => {
        console.warn('[assistant] Together request failed:', err)
        return undefined
      })

      if (!result) return 'The AI request failed or timed out. Please try again.'

      const first = (result as any).choices?.[0]
      const toolCalls: any[] = first?.message?.tool_calls || []

      if (!toolCalls.length) {
        const out = first?.message?.content || first?.text || 'No content returned.'
        console.log('[assistant] final response length', out?.length || 0)
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

    return 'No content returned.'
  }
}

export const assistantStore = AssistantStore.getInstance()
export const assistantService = new AssistantService()
// Eagerly initialize engine (non-blocking)
void assistantService.initialize()
