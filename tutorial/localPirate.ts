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
    const engineInfo = await trial?.ml.createEngine({
            taskName: "text-generation",
            modelId: "QuantFactory/Qwen3-0.6B-GGUF",
            modelFile: "Qwen3-0.6B.Q4_0.gguf",
            modelHubRootUrl: "https://model-hub.mozilla.org",
            modelHubUrlTemplate: "{model}/{revision}",
            modelRevision: "main",
            numContext: 2048,
            backend: "wllama"
        });
    console.log("Engine info: ", engineInfo);
    console.log("Engine successfully created for", engineMetadata);
    console.log("Trial: ", trial)
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


export const getLocalPirateAIResponse = async (articleText: string, userQuestion: string) => {
  try {
    console.log("[getLocalPirateAIResponse] called with:", { articleText, userQuestion });
    await ensureEngineIsReady()
    const trial = (browser as unknown as mlBrowserT).trial
    console.log("ENGINE READY!")

    const chatInput = [
      {
        role: "system",
        content:
          `/no_think You are a friendly pirate, who is always willing to help users navigate the difficult seas of the internet. Please examine the following web page carefully and use the information found there to answer the users question. If the question cannot be answered using the page contents alone, respond by suggesting that the user perform an internet search to find the answer to their question. Do not make anything up. Always talk like a pirate. Always. Arg!!`,
      },
      {
        role: "user",
        content: 
          `Yarr! Take a look at this page: ${articleText.slice(0,500)}. Can ye help me answer this: ${userQuestion} /no_think`,
      },
    ];

    //wllama
    const raw_result = await trial?.ml.runEngine({ prompt: chatInput, nPredict: 500, skipPrompt: true });

    console.log(raw_result);
    const final_answer = raw_result["finalOutput"].replace("<think>\n\n</think>\n\n", "");
    
    console.log("raw result:", raw_result, typeof raw_result, final_answer);

    return final_answer
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}
