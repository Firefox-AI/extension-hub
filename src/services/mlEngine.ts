import { EngineMetadataT, mlBrowserT } from '../../types'
import { LocalStorageKeys, SessionStorageKeys } from '../../const'

/**
 * Ensures the engine is ready. Since there is no way to know whether an engine
 * has been created, and we are limited to just 1 engine per extension, we
 * store a boolean in session storage.
 */
const ensureEngineIsReady = async () => {
  const { engineCreated } = await browser.storage.session.get(
    SessionStorageKeys.ENGINE_CREATED
  )
  const engineMetadata: EngineMetadataT = (
    await browser.storage.local.get(LocalStorageKeys.ENGINE_METADATA)
  ).engine_metadata

  console.log('trying to Creating engine...')
  if (engineCreated) return
  console.log('Creating engine...')
  try {
    const trial = (browser as unknown as mlBrowserT).trial

    // TODO consider better defaults
    await trial?.ml.createEngine({
      taskName: engineMetadata.taskName || 'summarization',
      modelHub: engineMetadata.modelHub || 'huggingface',
      modelId: engineMetadata.modelId || 'Xenova/distilbart-cnn-6-6',
      backend: 'onnx',
    })
    // Set the engineCreated flag to true
    await browser.storage.session.set({
      [SessionStorageKeys.ENGINE_CREATED]: true,
    })
  } catch (err) {
    console.warn('Error creating engine:', err)
  }
}

export const getMlEngineAIResponse = async (prompt: string) => {
  try {
    await ensureEngineIsReady()
    const trial = (browser as unknown as mlBrowserT).trial
    const chatInput = [
      {
        role: 'system',
        content:
          '/no_think Your role is to summarize the provided content as succinctly as possible while retaining the most important information /no_think',
      },
      {
        role: 'user',
        content: `/no_think ${prompt.slice(0, 2000)} /no_think`, // Limit prompt length to avoid errors
      },
    ]
    let requestOptions = {
      max_new_tokens: 100,
      min_new_tokens: 10,
      return_full_text: true,
      return_tensors: false,
      do_sample: false,
    }
    console.log('ML Engine request options:', chatInput)
    const raw_result = await trial?.ml.runEngine({
      args: [chatInput],
      options: requestOptions,
    })
    const final_answer = raw_result[0]['generated_text'][2]['content']
    return final_answer
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
