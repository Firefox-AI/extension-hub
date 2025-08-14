/**
 * This Service is dedicated to be an abstraction layer for the Page Assist AKA Page Buddy
 * It will handle the communication with different AI services to get the response for the page content.
 */
import { MlEngineService } from './mlEngine'
import {
  RunEngineMetadataT,
  EngineMetadataT,
  MessagePageAssistT,
} from '../../types'

export const getPageAssistResponse = async (
  pageAssistantData: MessagePageAssistT,
) => {
  const { prompt, textContent } = pageAssistantData
  // Note there is also the option to use local storage inputs from preferences page
  // if you want to make this dynamic
  const engineMetadata: EngineMetadataT = {
    taskName: 'text-generation',
    modelId: 'QuantFactory/Qwen3-0.6B-GGUF',
    modelFile: 'Qwen3-0.6B.Q4_0.gguf',
    modelHubRootUrl: 'https://model-hub.mozilla.org',
    modelHubUrlTemplate: '{model}/{revision}',
    modelRevision: 'main',
    numContext: 2048,
    backend: 'wllama',
  }

  const formattedPrompt = `answer this question:${prompt}, with this data :${textContent}`

  const promptThread = [
    {
      role: 'system',
      content:
        '/no_think Your role is to summarize the provided content as succinctly as possible while retaining the most important information /no_think',
    },
    {
      role: 'user',
      content: `/no_think ${formattedPrompt.slice(0, 4000)} /no_think`, // Limit prompt length to avoid errors
    },
  ]

  const runEngineMetadata: RunEngineMetadataT = {
    prompt: promptThread,
    nPredict: 500,
    skipPrompt: true,
  }

  const mlEngineService = new MlEngineService(engineMetadata)
  const response = await mlEngineService.getAIResponse<{
    finalOutput: string
  }>(runEngineMetadata)

  const final_answer = response
    ? response.finalOutput.replace('<think>\n\n</think>\n\n', '')
    : 'No response from AI engine'

  console.log(
    'Page Assistant response:',
    response,
    typeof response,
    final_answer,
  )

  return final_answer
}
