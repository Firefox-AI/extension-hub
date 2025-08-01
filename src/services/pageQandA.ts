import { getOpenAIResponse } from './openai'

const buildPrompt = (prompt: string, textContent: string) => {
  return `answer this question:${prompt}, with this data :${textContent}`
}


export const getPageQandAResponse = async (input_prompt :string, textContent: string): Promise<string> => {

  const prompt = buildPrompt(input_prompt, textContent)
  
  const response = await getOpenAIResponse({
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that answers questions based on the provided text content.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'gpt-4o',
    temperature: 0.7,
  })

  if (response && response.choices && response.choices.length > 0) {
    const content = response.choices[0]?.message.content
    return content || 'No response content available.'
  }

  return 'Error: No response from AI.'
}
