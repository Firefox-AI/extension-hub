import Together from 'together-ai'
import { LocalStorageKeys } from '../../const'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { mlBrowserT } from '../../types'

enum TogetherAITools {
  OPEN_TABS_FROM_HISTORY = 'openTabsFromHistory',
  GROUP_TABS_BY_URLS = 'groupTabsByUrls',
}

const openTabsTool = {
  type: 'function',
  function: {
    name: TogetherAITools.OPEN_TABS_FROM_HISTORY,
    description:
      'Opens relevant tabs based on browser history and a given prompt',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: {
            type: 'string',
            description: 'A list of URLs to open in the browser',
          },
        },
      },
      required: ['urls'],
    },
  },
}

const groupTabsByUrls = {
  type: 'function',
  function: {
    name: TogetherAITools.GROUP_TABS_BY_URLS,
    description:
      'Groups a list of browser tabs into a tab group based on the provided URLs.',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          description:
            'A list of URLs to group into a single browser tab group.',
        },
      },
      required: ['urls'],
    },
  },
}

export const getTogeatherAIResponse = async (prompt: string) => {
  try {
    const { togetherai_api_key, togetherai_model = 'deepseek-ai/DeepSeek-V3' } =
      await browser.storage.local.get([
        LocalStorageKeys.TOGETHERAI_API_KEY,
        LocalStorageKeys.TOGETHERAI_MODEL,
      ])

    const together = new Together({ apiKey: togetherai_api_key || '' })

    const response = await together.chat.completions.create({
      model: togetherai_model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Use available tools to access browser history and open relevant tabs.',
        },
        { role: 'user', content: prompt },
      ],
      tools: [openTabsTool, groupTabsByUrls],
    })

    const toolCalls = response.choices[0].message?.tool_calls
    if (!toolCalls?.length) {
      return response.choices?.[0]?.message?.content ?? ''
    }

    for (const call of toolCalls) {
      const args = JSON.parse(call.function.arguments)

      if (call.function.name === TogetherAITools.OPEN_TABS_FROM_HISTORY) {
        return await handleOpenTabs(args.urls)
      }

      if (call.function.name === TogetherAITools.GROUP_TABS_BY_URLS) {
        return await handleGroupTabs(args.urls)
      }
    }

    return response.choices?.[0]?.message?.content ?? ''
  } catch (error) {
    console.error('Error fetching TogetherAI response:', error)
    return 'An unexpected error occurred while contacting TogetherAI.'
  }
}

const handleOpenTabs = async (urls: string[]): Promise<string> => {
  // Open URLs and return custome message
  for (const url of urls) {
    try {
      await browser.tabs.create({ url })
    } catch (error) {
      console.error('Error opening URL:', url, error)
    }
  }

  return `You got it! I've opened ${urls.length} tabs:<br/>${urls
    .map((u, i) => `#${i + 1}. <a href="${u}" target="_blank">${u}</a>`)
    .join('<br/>')}`
}

// Note: this does not work like intended yet. This only works if the tabs are in the history and
// are currently open in the browser. I would like to make this look at the open tabs only and give
// a more realisctic use case here.
const handleGroupTabs = async (urls: string[]): Promise<string> => {
  try {
    const tabs = await (browser as unknown as mlBrowserT).tabs.query({
      currentWindow: true,
    })

    const tabIdsToGroup = tabs
      .filter((tab) => tab.url && urls.includes(tab.url))
      .map((tab) => tab.id!)

    if (!tabIdsToGroup.length) {
      return 'No matching tabs found to group.'
    }

    const groupId = await (browser as unknown as mlBrowserT).tabs.group({
      tabIds: tabIdsToGroup,
    })

    await (browser as unknown as mlBrowserT).tabGroups.update(groupId, {
      title: 'AI Generated Group',
      color: 'blue',
    })

    return `Grouped ${tabIdsToGroup.length} tabs into a new tab group.`
  } catch (error) {
    console.error('Error grouping tabs:', error)
    return 'There was an error grouping the tabs.'
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
