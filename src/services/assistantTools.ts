// Minimal tool abstracts and simple dummy handlers.
// Tools are described with OpenAI-compatible function schemas.
import { ToolDefinition } from '../../types'
import { LocalStorageKeys } from '../../const'


export const assistantTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Returns the text content of a web page given the url. Only applicable to pages that are opened in a tab.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of website to read'
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_history',
      description:
        'Returns the most relevant history items related to search term with each containing url, title, visited time and a description of the page if available.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'The term to use to search for relevant history.',
          },
        },
        required: ['search_term'],
      },
    },
  },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'get_insights',
  //     description:
  //       "Retrieve the user's saved insights (shopping, brands, dietary, hobbies, interests, etc.) which could help in personalizing the response. If a query is provided, it will be used to filter for relevant insights.",
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         query: {
  //           type: 'string',
  //           description:
  //             'The user query to filter for relevant insights if provided.',
  //         },
  //       },
  //     },
  //   },
  // },
  {
    type: 'function',
    function: {
      name: 'get_tabs',
      description:
        'Returns a list of opened tabs with each including url, title and a flag indicating if the tab is currently active to the user.',
      parameters: {
        type: 'object',
        properties: {} 
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_engine',
      description:
        'Only use this when the request is asking for real time information or up-to-date facts which can ONLY be obtained from a web search.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The optimized query to search for on the web.',
          },
        },
        required: ['query'],
      },
    },
  },
]

// Standalone tool functions

export async function get_page_content(args: { url: string }) {
  const { url } = args

  // Validate URL and ensure it is currently open in a tab
  if (!url || typeof url !== 'string') {
    return { error: 'A valid url string is required.' }
  }

  // Check across all windows for an exact URL match
  const allTabs = await browser.tabs.query({})
  const tab = allTabs.find((t) => t.url === url)
  if (!tab?.id) {
    return { error: 'The specified URL is not currently open in any tab.' }
  }

  try {
    const res = await browser.tabs.sendMessage(tab.id, {
      type: 'get_page_content',
      data: {},
    })
    return res
  } catch (e) {
    return { error: 'Failed to retrieve page content from the open tab.' }
  }
}

export async function get_insights(args: { query?: string } = {}) {
  const { query } = args
  const res = await browser.storage.local.get(LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS)
  const saved = (res as any)?.[LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS]
  const entries: any[] = Array.isArray(saved) ? saved : []

  if (!query || typeof query !== 'string' || !query.trim()) {
    return entries
  }

  const q = query.toLowerCase()
  const filteredEntries: any[] = []
  for (const insight of entries) {
    const filtered: any = {}
    for (const [cat, arr] of Object.entries(insight || {})) {
      if (cat === '_rawText') continue
      const items = Array.isArray(arr) ? (arr as any[]).map((v) => String(v)) : []
      const catMatch = cat.toLowerCase().includes(q)
      const itemMatches = items.filter((s) => s.toLowerCase().includes(q))
      if (catMatch) filtered[cat] = items
      else if (itemMatches.length) filtered[cat] = itemMatches
    }
    if (Object.keys(filtered).length) filteredEntries.push(filtered)
  }

  return filteredEntries.length ? filteredEntries : entries
}

export async function search_history(args: { search_term: string }) {
  const { search_term } = args
  // TODO
  return []
}

async function getDescriptionForTab(tabId?: number) {
  if (!tabId) return ''
  try {
    // Prefer metadata description from the page
    const meta = await browser.tabs.sendMessage(tabId, {
      type: 'get_page_metadata',
      data: {},
    })
    const desc: string = meta?.description || ''
    if (desc) return desc
  } catch (_) {
    return ''
  }
}

export async function get_tabs(_args: {} = {}) {
  const tabs = await browser.tabs.query({ currentWindow: true })
  const withDescriptions = await Promise.all(
    tabs.map(async (t) => ({
      url: t.url || '',
      title: t.title || '',
      active: !!(t as any).active,
      description: await getDescriptionForTab(t.id),
    })),
  )
  return withDescriptions
}

export async function get_current_tab(_args: {} = {}) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab) return null
  return {
    url: tab.url || '',
    title: tab.title || '',
    active: true,
    description: await getDescriptionForTab(tab.id),
  }
}
