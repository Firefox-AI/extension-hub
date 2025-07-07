import Together from 'together-ai'
import { LocalStorageKeys } from '../../const'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export const getTogeatherAIResponse = async (prompt: string) => {
  try {
    const { togetherai_api_key, togetherai_model } =
      await browser.storage.local.get([
        LocalStorageKeys.TOGETHERAI_API_KEY,
        LocalStorageKeys.TOGETHERAI_MODEL,
      ])
    const together = new Together({ apiKey: togetherai_api_key || '' })
    console.log('Using TogetherAI model:', togetherai_api_key)
    const response = await together.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: togetherai_model || 'deepseek-ai/DeepSeek-V3',
    })
    console.log('TogetherAI response:', response)
    return response.choices?.[0]?.message?.content ?? ''
  } catch (error) {
    console.error('Error fetching TogetherAI response:', error)
  }
}

export const getStructuredTabHistoryData = async (
  prompt: string,
  tabHistory: string
) => {
  try {
    const { togetherai_api_key, togetherai_model } =
      await browser.storage.local.get([
        LocalStorageKeys.TOGETHERAI_API_KEY,
        LocalStorageKeys.TOGETHERAI_MODEL,
      ])
    const together = new Together({ apiKey: togetherai_api_key || '' })

    // Defining the schema we want our data in
    const voiceNoteSchema = z.object({
      tabs: z
        .array(
          z.object({
            title: z.string().min(1).max(100).describe('Title of the webpage'),
            url: z.string().url().describe('URL of the webpage'),
            visitDate: z
              .string()
              .describe('Date and time when the page was visited'),
            summary: z
              .string()
              .min(1)
              .max(500)
              .describe('Brief summary of the webpage content'),
            keywords: z
              .array(z.string())
              .max(10)
              .describe('List of relevant keywords or tags'),
          })
        )
        .describe('Array of tab history objects'),
    })
    const jsonSchema = zodToJsonSchema(voiceNoteSchema, { target: 'openAi' })
    const extract = await together.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'The following data about a users browser hisotory. Only answer in JSON.',
        },
        {
          role: 'user',
          content: `Here is the users browser history data: ${tabHistory}.  Please extract the relevant information based on the following request: ${prompt}.  Ensure your response is valid JSON and adheres to the provided schema.`,
        },
      ],
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      response_format: { type: 'json_object', schema: jsonSchema },
    })

    if (extract?.choices?.[0]?.message?.content) {
      const output = JSON.parse(extract?.choices?.[0]?.message?.content)
      console.log(output)
      return output
    }
    return 'No output.'
  } catch (error) {
    console.error('Error fetching TogetherAI response:', error)
  }
}
