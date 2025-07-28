import { getOpenAIResponse } from './openai'

export const getPageQandAResponse = async (prompt: string): Promise<string> => {
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
    const content = response.choices[0]?.message?.content;
    if (content) {
      return content;
    }
  }
  return 'Error: No valid response content from AI.';
}
