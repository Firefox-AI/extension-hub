import OpenAI from 'openai'

// Lightweight wrapper around the OpenAI JS client to keep all usage in one place.
// Outside of this module, do not import or use the OpenAI client directly.

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  ts?: number
  // Optional tool calling metadata passthrough
  tool_calls?: any[]
  tool_call_id?: string
}

export type ChatToolsLite = any[] | undefined

export type ChatResultLite = any

let clientSingleton: OpenAI | null = null

export function initOpenAIClient(
  opts: { apiKey: string; baseURL?: string },
  options?: { force?: boolean },
) {
  if (clientSingleton && !options?.force) {}
  clientSingleton = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    dangerouslyAllowBrowser: true,
  })
}

export function resetOpenAIClient() {
  clientSingleton = null
}

export function getOpenAIClient(): OpenAI {
  if (!clientSingleton) {
    throw new Error('OpenAI client is not initialized. Call initOpenAIClient first.')
  }
  return clientSingleton
}

export async function chatComplete(params: {
  model: string
  messages: ChatMessage[]
  tools?: ChatToolsLite
  response_format?: any
  timeoutMs?: number
  includeRaw?: boolean
}): Promise<ChatResultLite> {
  const client = getOpenAIClient()
  const request = client.chat.completions.create({
    model: params.model,
    // @ts-ignore We keep messages shape permissive
    messages: params.messages as any,
    tools: params.tools as any,
    // @ts-ignore expose schema if provided
    response_format: params.response_format,
  })

  const result: any = await Promise.race([
    request,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('request-timeout')), params.timeoutMs ?? 15000),
    ),
  ])
  return result
}
