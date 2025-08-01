import { EngineMetadataT, mlBrowserT, RunEngineMetadataT } from '../../types'
import { LocalStorageKeys, SessionStorageKeys } from '../../const'

/**
 * Service for interacting with the ML Engine.
 * Ensures the engine is initialized and provides a method to get AI responses.
 */
export class MlEngineService {
  private trial = (browser as unknown as mlBrowserT).trial
  private engineCreated = false

  constructor(private engineMetadata?: EngineMetadataT) {}

  /**
   * Ensures the engine is ready. Since there is no way to know whether an engine
   * has been created, and we are limited to just 1 engine per extension, we
   * store a boolean in session storage.
   */
  private async ensureEngineIsReady() {
    if (this.engineCreated) return

    const { engine_created } = await browser.storage.session.get(
      SessionStorageKeys.ENGINE_CREATED
    )

    console.log('Trying to creating ML Engine...')
    console.log('Engine has already been created:', Boolean(engine_created))

    if (engine_created) {
      this.engineCreated = true
      return
    }

    // Init progress pub sub
    this.trial?.ml.onProgress.addListener(({ progress }) => {
      browser.runtime.sendMessage({
        type: 'mlEngine_download_progress',
        progress,
      })
    })

    try {
      console.log('Attempting to create ML Engine')

      // Use this option if you want the user to fill out the settings page
      // consider moving this to the client service like "pageAssistant.ts" and
      // let those files choose if they want to use local configs or not.
      const localEngineMetadata: EngineMetadataT = (
        await browser.storage.local.get(LocalStorageKeys.ENGINE_METADATA)
      ).engine_metadata

      // Default to local configs if meta data is not given.
      await this.trial?.ml.createEngine(
        this.engineMetadata ?? localEngineMetadata
      )

      // Set the engineCreated flag to true
      await browser.storage.session.set({
        [SessionStorageKeys.ENGINE_CREATED]: true,
      })

      this.engineCreated = true
    } catch (err) {
      console.error('Error creating ML Engin:', err)
    }
  }

  /**
   * This is a reusable function to get the AI response from the ML Engine.
   * Do not add custom logic here; this is a generic function to get the ML Engine response.
   */
  async getAIResponse<T = unknown>(
    runEngineMetadata: RunEngineMetadataT
  ): Promise<T | undefined> {
    try {
      await this.ensureEngineIsReady()

      // Response will be unique to what engine you set up.
      return await this.trial?.ml.runEngine(runEngineMetadata)
    } catch (err) {
      console.warn('Error generating response:', err)
    }
  }
}


/** Embedding model
 */
const ensureEmbeddingEngineReady = async () => {
  const { embeddingEngineCreated } = await browser.storage.session.get(
    SessionStorageKeys.EMBEDDING_ENGINE_CREATED
  )

  if (embeddingEngineCreated) return

  console.log('[Embedding] Creating smart-tab-embedding engine...')
  try {
    const trial = (browser as unknown as mlBrowserT).trial

    await trial?.ml.createEngine({
      taskName: 'feature-extraction',
      modelHub: 'huggingface',
      modelId: 'Mozilla/smart-tab-embedding',
      // featureId: 'smart-tab-embedding',
      dtype: 'q8',
      backend: 'onnx-native',
      timeoutMS: 2 * 60 * 1000,
    })

    await browser.storage.session.set({
      [SessionStorageKeys.EMBEDDING_ENGINE_CREATED]: true,
    })
    console.log('[embedding] engine created successfully')

  } catch (err) {
    console.warn('Error creating embedding engine:', err)
  }
}

export const getEmbedding = async (text: string): Promise<number[] | undefined> => {
  await ensureEmbeddingEngineReady()

  try {
    const trial = (browser as unknown as mlBrowserT).trial
    const result = await trial?.ml.runEngine({
      // featureId: 'smart-tab-embedding',
      args: [[text]],
      options: {
        pooling: 'mean',
        normalize: true,
      },
    })

    if (!result) {
      console.warn('[embedding] runEngine returned undefined or null')
      return undefined
    }

    if (!Array.isArray(result[0])) {
      console.warn('[embedding] result[0] is not an array:', result[0])
      return undefined
    }

    return result[0] as number[]
  } catch (err) {
    console.error('[embedding] Failed to get embedding:', err)
    return undefined
  }
}