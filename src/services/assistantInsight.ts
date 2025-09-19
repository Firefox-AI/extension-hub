import { LocalStorageKeys } from '../../const'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'
import { get_current_tab } from './assistantTools'
import type { ChatMessage } from './utilsOpenAI'

// Placeholder template for insight extraction.
// Placeholders:
// - {user_queries}: JSON array of strings (user-authored queries)
// - {current_tab}: JSON object with current tab context (or null)
const INSIGHT_PROMPT_TEMPLATE = `You are an expert analyst that extracts user insights from their past queries.

Inputs:
- user_queries: JSON array of user-authored queries/messages in chronological order.
- current_tab: JSON object with the user's currently active tab context (url, title, optional description). Use only if relevant.

Goal:
- Infer the user's explicitly stated interest category, notable preferences, behavior patterns, and produce a concise summary.
- Be conservative; only infer if there is strong evidence in the user queries.
- Do not include transient facts.

Return a concise JSON object following this schema:
{
  "interest_categories": string[],   // categories the user explicitly asked about repeatedly or strongly
  "notable_preferences": string[], // concrete preferences (e.g., brands, frameworks, genre, diets) if present
  "behavior_patterns": string[],   // consistent habits or patterns (e.g., compares prices, asks for tutorials)
  "summary": string                // 1-2 sentence summary synthesizing the above
}

current_tab:
{current_tab}

user_queries:
{user_queries}
`

type InsightResult = {
  interest_categories?: string[]
  notable_preferences?: string[]
  behavior_patterns?: string[]
  summary?: string
  // keep the raw content for debugging/fallback rendering
  _rawText?: string
}

function extractUserQueries(history: ChatMessage[]): string[] {
  const qs: string[] = []
  for (const m of history) {
    if (m.role === 'user' && typeof m.content === 'string') {
      const t = m.content.trim()
      if (t) qs.push(t)
    }
  }
  return qs
}

export async function generateInsightsFromConversation(history: ChatMessage[]): Promise<InsightResult> {
  try {
    const queries = extractUserQueries(history)
    const currentTab = await get_current_tab({})
    const { togetherai_url, togetherai_api_key, togetherai_model } = await browser.storage.local.get([
      LocalStorageKeys.TOGETHERAI_URL,
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
    ])

    initOpenAIClient({ apiKey: togetherai_api_key, baseURL: togetherai_url })

    const filled = INSIGHT_PROMPT_TEMPLATE
      .replace('{user_queries}', JSON.stringify(queries, null, 2))
      .replace('{current_tab}', JSON.stringify(currentTab ?? null, null, 2))

    const SCHEMA = {
      title: 'UserInsights',
      type: 'object',
      required: ['interest_categories', 'notable_preferences', 'behavior_patterns', 'summary'],
      properties: {
        interest_categories: { type: 'array', items: { type: 'string' } },
        notable_preferences: { type: 'array', items: { type: 'string' } },
        behavior_patterns: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
    }

    const result = await chatComplete({
      model: togetherai_model,
      // @ts-ignore
      messages: [
        { role: 'system', content: 'Return only valid JSON that matches the provided schema.' },
        { role: 'user', content: filled },
      ] as any,
      response_format: { type: 'json_object', schema: SCHEMA },
      timeoutMs: 15000,
    })

    const text = ((result as any).choices?.[0]?.message?.content || '').trim()
    const parsed: InsightResult = JSON.parse(text)
    return { ...parsed, _rawText: text }
  } catch (e) {
    // Fallback: return a lightweight placeholder when parsing fails
    return {
      summary:
        'Could not parse generated insights. Please try again or refine your queries.',
    }
  }
}

export function formatInsightsMarkdown(r: InsightResult): string {
  const sect = (title: string, items?: string[]) => {
    if (!items || !items.length) return ''
    return `\n**${title}**\n- ${items.join('\n- ')}`
  }
  const parts: string[] = []
  if (r.summary) parts.push(r.summary)
  parts.push(sect('Interest Categories', r.interest_categories))
  parts.push(sect('Notable Preferences', r.notable_preferences))
  parts.push(sect('Behavior Patterns', r.behavior_patterns))
  return parts.filter(Boolean).join('\n') || 'No insights found.'
}
