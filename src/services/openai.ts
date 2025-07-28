import { LocalStorageKeys } from '../../const'
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions'
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
