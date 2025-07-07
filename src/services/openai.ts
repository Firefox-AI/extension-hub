import { LocalStorageKeys } from '../../const'

export const getOpenAIResponse = async (prompt: string) => {
  try {
    const { openai_api_key, openai_ai_model } = await browser.storage.local.get(
      [LocalStorageKeys.OPENAI_API_KEY, LocalStorageKeys.OPENAI_AI_MODEL]
    )
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openai_api_key || ''}`,
      },
      body: JSON.stringify({
        model: openai_ai_model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Answering this question to the best of your ability, try and only used the context provided with the question. If the information is not present in the context say you do not know. If you are asked to define words it is ok to user other data you know.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    return content
  } catch (error) {
    console.error('Error fetching OpenAI response:', error)
  }
}
