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
    const result = await trial?.ml.runEngine({ args: [prompt] })
    return result
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
