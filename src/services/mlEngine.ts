import { EngineMetadataT, mlBrowserT, RunEngineMetadataT } from '../../types'
import { LocalStorageKeys, SessionStorageKeys } from '../../const'

/**
 * Ensures the engine is ready. Since there is no way to know whether an engine
 * has been created, and we are limited to just 1 engine per extension, we
 * store a boolean in session storage.
 */
const ensureEngineIsReady = async (engineMetadata: EngineMetadataT) => {
  const { engine_created } = await browser.storage.session.get(
    SessionStorageKeys.ENGINE_CREATED
  )

  // Use this option if you want the user to fill out the settinqs page
  // consider moving this to the client service like "pageAssistant.ts" and
  // let those files choose if they want to use local configs or not.
  const localEngineMetadata: EngineMetadataT = (
    await browser.storage.local.get(LocalStorageKeys.ENGINE_METADATA)
  ).engine_metadata

  console.log('Trying to creating ML Engine...')
  console.log('Engine has already been created:', Boolean(engine_created))

  if (engine_created) return

  try {
    console.log('Attempting to create ML Engine')
    const trial = (browser as unknown as mlBrowserT).trial

    // Defualt to local congfigs if metat data is not given.
    await trial?.ml.createEngine(
      engineMetadata ? engineMetadata : localEngineMetadata
    )
    // Set the engineCreated flag to true
    await browser.storage.session.set({
      [SessionStorageKeys.ENGINE_CREATED]: true,
    })
  } catch (err) {
    console.error('Error creating ML Engin:', err)
  }
}

/**
 * This is a reusable function to get the AI response from the ML Engine.
 * do not add customer logic here, this is a generic function to get the AI response.
 * @param runEngineMetadata
 * @param engineMetadata
 * @returns ML Engine AI response
 */
export const getMlEngineAIResponse = async (
  runEngineMetadata: RunEngineMetadataT,
  engineMetadata: EngineMetadataT
) => {
  try {
    const trial = (browser as unknown as mlBrowserT).trial

    // Init progress pub sub
    trial?.ml.onProgress.addListener((data) => {
      const { progress } = data
      browser.runtime.sendMessage({
        type: 'mlEngine_download_progress',
        progress,
      })
    })

    await ensureEngineIsReady(engineMetadata)

    // Response will be unique to what engine you set up.
    const response = await trial?.ml.runEngine(runEngineMetadata)
    return response
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
