import { LocalStorageKeys } from '../../const'
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions'

export class OpenAIKeyManager {
  private static hasKeyCache: boolean | null = null
  private static listeners: Set<(hasKey: boolean) => void> = new Set()
  private static storageListenerInitialized = false

  /**
   * Initialize storage listener (called automatically when first listener is added)
   */
  private static initializeStorageListener() {
    if (this.storageListenerInitialized) return

    browser.storage.local.onChanged.addListener((changes) => {
      if (changes[LocalStorageKeys.OPENAI_API_KEY]) {
        // Key was changed in storage, update our cache and notify listeners
        this.checkOpenAIKey()
      }
    })

    this.storageListenerInitialized = true
  }

  /**
   * Check if OpenAI API key is available
   */
  static async checkOpenAIKey(): Promise<boolean> {
    try {
      const { openai_api_key } = await browser.storage.local.get([
        LocalStorageKeys.OPENAI_API_KEY,
      ])
      const hasKey = !!(openai_api_key && openai_api_key.trim())

      // Update cache and notify listeners if changed
      if (this.hasKeyCache !== hasKey) {
        this.hasKeyCache = hasKey
        this.notifyListeners(hasKey)
      }

      return hasKey
    } catch (error) {
      console.error('Failed to check OpenAI key:', error)
      const hasKey = false

      if (this.hasKeyCache !== hasKey) {
        this.hasKeyCache = hasKey
        this.notifyListeners(hasKey)
      }

      return hasKey
    }
  }

  /**
   * Get cached key status (synchronous)
   */
  static getCachedKeyStatus(): boolean | null {
    return this.hasKeyCache
  }

  /**
   * Add listener for key status changes
   */
  static addListener(callback: (hasKey: boolean) => void): () => void {
    // Initialize storage listener if this is the first listener
    this.initializeStorageListener()

    this.listeners.add(callback)

    // Return cleanup function
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Force refresh key status
   */
  static async refreshKeyStatus(): Promise<boolean> {
    this.hasKeyCache = null // Clear cache to force refresh
    return this.checkOpenAIKey()
  }

  private static notifyListeners(hasKey: boolean): void {
    this.listeners.forEach((callback) => {
      try {
        callback(hasKey)
      } catch (error) {
        console.error('Error in OpenAI key status listener:', error)
      }
    })
  }
}
type PartialChatParams = Omit<
  ChatCompletionCreateParams,
  'model' | 'temperature'
> & {
  model?: string
  temperature?: number
}
export const getOpenAIResponse = async (config: PartialChatParams) => {
  try {
    const { openai_api_key } = await browser.storage.local.get([
      LocalStorageKeys.OPENAI_API_KEY,
    ])
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openai_api_key || ''}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages: config.messages,
        temperature: config.temperature || 0.7,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching OpenAI response:', error)
  }
}

export const getOpenAIChatResponseWithModel = async (
  prompt: string,
  model: string,
) => {
  try {
    const { openai_api_key } = await browser.storage.local.get([
      LocalStorageKeys.OPENAI_API_KEY,
    ])

    const requestBody: any = {
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Answering this question to the best of your ability, try and only used the context provided with the question. If the information is not present in the context say you do not know.',
        },
        { role: 'user', content: prompt },
      ],
    }
    if (model !== 'o4-mini') {
      requestBody.temperature = 0.7
    }
    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openai_api_key}`,
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    console.log(`[OpenAI] Response data: ${JSON.stringify(data)}`)
    const content = data.choices[0].message.content
    return {
      content: content,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    }
  } catch (error) {
    console.error('Error fetching OpenAI response:', error)
    return { content: undefined, usage: { input_tokens: 0, output_tokens: 0 } }
  }
}

export const getOpenAIResponseWithModel = async (
  prompt: string,
  model: string,
) => {
  try {
    const { openai_api_key } = await browser.storage.local.get('openai_api_key')

    const requestBody: any = {
      model: model,
      input: prompt,
    }
    if (model !== 'o4-mini') {
      requestBody.temperature = 0.7
    }
    const response = await fetch(`https://api.openai.com/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openai_api_key}`,
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    console.log(`[OpenAI] Response data: ${JSON.stringify(data)}`)
    const content = data.output
      ?.filter((entry: any) =>
        entry.content?.some((c: any) => c.type === 'output_text'),
      )
      ?.flatMap((entry: any) => entry.content)
      ?.filter((c: any) => c.type === 'output_text')
      ?.map((c: any) => c.text)
      ?.join('\n')
      ?.trim()

    return {
      content: content,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      },
    }
  } catch (error) {
    console.error('Error fetching OpenAI response:', error)
    return { content: undefined, usage: { input_tokens: 0, output_tokens: 0 } }
  }
}

export const getOpenAIWebSearchResponse = async (
  input: string,
  model: string,
) => {
  try {
    const { openai_api_key } = await browser.storage.local.get('openai_api_key')

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openai_api_key}`,
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search_preview', search_context_size: 'high' }],
        input,
      }),
    })

    const data = await response.json()
    // console.log('[OpenAI] Raw /responses data:', data)
    const text = data.output
      ?.flatMap((entry: any) => entry.content || [entry])
      .filter((c: any) => typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('\n')
      .trim()

    if (!text) throw new Error('No valid content returned')

    return {
      content: text,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      },
    }
  } catch (error) {
    console.error('Error in getOpenAIWebSearchResponse:', error)
    return { content: undefined, usage: { input_tokens: 0, output_tokens: 0 } }
  }
}
