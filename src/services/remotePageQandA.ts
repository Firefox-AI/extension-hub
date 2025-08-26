import { getEndpointModelResponse } from './localModel'

function makeResponse(answer: string, used_context: string[]) {
  const contextLines = used_context.map(c => `- ${c}`).join("\n");
  const ans = `${answer}
  
  Relevant context: 
  ${contextLines}
  `

  return ans
}

export const getEndpointPageQandAResponse = async (input_prompt :string, textContent: string): Promise<string> => {

  // const prompt = buildPrompt(input_prompt, textContent)

  const response = await getEndpointModelResponse(input_prompt, textContent)

  if (response && response.answer) {
    const resp = makeResponse(response.answer, response.used_context)
    return resp || 'No response content available.'
  }

  return 'Error: No response from AI.'
}
