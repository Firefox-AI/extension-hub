import { getEndpointModelResponse } from './localModel'

const makeResponse = (answer: string, usedContext: string[]) => {
  const contextLines = usedContext.map((context) => `- ${context}`).join('\n')
  const response = `${answer}
  
  Relevant context: 
  ${contextLines}
  `

  return response
}

export const getPageQandAResponse = async (
  input_prompt: string,
  textContent: string,
): Promise<string> => {
  const response = await getEndpointModelResponse(input_prompt, textContent)

  if (response && response.answer) {
    const resp = makeResponse(response.answer, response.used_context)
    return resp || 'No response content available.'
  }

  return 'Error: No response from AI.'
}
