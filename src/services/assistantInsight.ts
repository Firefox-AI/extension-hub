import { LocalStorageKeys } from '../../const'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'
import { get_current_tab } from './assistantTools'
import type { ChatMessage } from './utilsOpenAI'

// Placeholder template for insight extraction.
// Placeholders:
// - {user_queries}: JSON array of strings (user-authored queries)
// - {current_tab}: JSON object with current tab context (or null)
const INSIGHT_PROMPT_TEMPLATE = `You are an expert analyst that extracts user insights from their past queries (conversations) with the browser assistant.

Inputs:
- user_queries: JSON array of user-authored queries/messages in chronological order.
- current_tab: JSON object with the user's currently active tab context (url, title, optional description). Use only if relevant.

Goal:
- Identify stable, explicit categories and their attributes/factual information mentioned by the user (e.g., categories like dietary, brands, frameworks, hobbies; attributes are detailed entities under that category including polarity if essential).
- Be conservative; only include categories/attributes with strong evidence from the user queries.

For example, category can be "Diet Preferences" and one of the values can be "avoid broccoli" where avoid is polarity and broccoli is the entity.

Return ONLY a concise JSON object of key-value pairs:
{
  "<category1>": ["<attribute>", "<attribute>", ...],
  "<category2>": ["..."]
}
where:
- Keys are category names.
- Values are non-empty arrays of unique attributes + optional polarity that are a few words each.

current_tab:
{current_tab}

user_queries:
{user_queries}
`

type InsightMap = { [category: string]: string[] }
type InsightResult = InsightMap & { _rawText?: string }

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
    // If there are no user-authored queries, skip generation and persistence.
    if (!queries.length) {
      return {}
    }
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
      title: 'UserInsightsMap',
      description: 'A flat object mapping category to an array of strings.',
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
    }

    const result = await chatComplete({
      model: togetherai_model,
      // @ts-ignore
      messages: [
        { role: 'system', content: 'Return only valid JSON that matches the provided schema.' },
        { role: 'user', content: filled },
      ] as any,
      response_format: { type: 'json_object', schema: SCHEMA }
    })

    const text = ((result as any).choices?.[0]?.message?.content || '').trim()
    const parsed: InsightMap = JSON.parse(text)
    // Persist: append to list under ASSISTANT_CONVERSATION_INSIGHTS
    try {
      const existing = await browser.storage.local.get(LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS)
      const prev = (existing as any)?.[LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS]
      let list: InsightMap[] = []
      if (Array.isArray(prev)) list = prev as InsightMap[]
      else if (prev && typeof prev === 'object') list = [prev as InsightMap]
      // Append new item
      list = [...list, parsed]
      await browser.storage.local.set({
        [LocalStorageKeys.ASSISTANT_CONVERSATION_INSIGHTS]: list,
      })
    } catch (_) {
      // Non-fatal if persistence fails
    }
    return { ...(parsed as any), _rawText: text }
  } catch (e) {
    // Fallback: do not append any failure message to storage; surface empty result
    return {}
  }
}

export function formatInsightsMarkdown(r: InsightMap | InsightResult | InsightMap[]): string {
  if (!r) return 'No insights found.'
  // If array, merge categories with unique items
  const toArray = Array.isArray(r) ? r as InsightMap[] : [r as InsightMap]
  const merged: Record<string, string[]> = {}
  for (const m of toArray) {
    if (!m || typeof m !== 'object') continue
    for (const [cat, items] of Object.entries(m)) {
      if (cat === '_rawText') continue
      const arr = Array.isArray(items) ? items.map((v) => String(v)) : []
      if (!arr.length) continue
      merged[cat] = Array.from(new Set([...(merged[cat] || []), ...arr]))
    }
  }
  const parts: string[] = []
  for (const [cat, items] of Object.entries(merged)) {
    if (!items || !items.length) continue
    const title = cat.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
    parts.push(`\n**${title}**\n- ${items.join('\n- ')}`)
  }
  return parts.join('\n') || 'No insights found.'
}
