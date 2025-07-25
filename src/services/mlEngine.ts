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

    try {
      console.log('Attempting to create ML Engine')

      // Use this option if you want the user to fill out the settings page
      // consider moving this to the client service like "pageAssistant.ts" and
      // let those files choose if they want to use local configs or not.
      const localEngineMetadata: EngineMetadataT = (
        await browser.storage.local.get(LocalStorageKeys.ENGINE_METADATA)
      ).engine_metadata

      // Default to local configs if metadata is not given.
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
      // Init progress pub sub
      this.trial?.ml.onProgress.addListener(({ progress }) => {
        browser.runtime.sendMessage({
          type: 'mlEngine_download_progress',
          progress,
        })
      })

      await this.ensureEngineIsReady()

      // Response will be unique to what engine you set up.
      return await this.trial?.ml.runEngine(runEngineMetadata)
    } catch (err) {
      console.warn('Error generating response:', err)
    }
  }
}
