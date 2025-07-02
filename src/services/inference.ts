import { mlBrowserT, PromptDataT } from '../../types'
import { LocalStorageKeys } from '../../const'

export const getOpenAIResponse = async (prompt: string) => {
  try {
    const localData = await browser.storage.local.get(
      LocalStorageKeys.OPENAI_API_KEY
    )
    const OPENAI_API_KEY = localData.openai_api_key || ''
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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

/**
 * Ensures the engine is ready. Since there is no way to know whether an engine
 * has been created, and we are limited to just 1 engine per extension, we
 * store a boolean in session storage.
 */
const ensureEngineIsReady = async () => {
  const { engineCreated } = await browser.storage.session.get({
    engineCreated: false,
  })
  console.log('trying to Creating engine...')

  if (engineCreated) return
  console.log('Creating engine...')
  try {
    const trial = (browser as unknown as mlBrowserT).trial

    await trial?.ml.createEngine({
      taskName: 'summarization',
      modelHub: 'huggingface',
      modelId: 'Xenova/distilbart-cnn-6-6',
    })
    await browser.storage.session.set({ engineCreated: true })
  } catch (err) {
    console.warn('Error creating engine:', err)
  }
}

export const generateLocalAIResponse = async (prompt: string) => {
  try {
    await ensureEngineIsReady()
    const trial = (browser as unknown as mlBrowserT).trial
    const result = await trial?.ml.runEngine({ args: [prompt] })
    return result
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
