import OpenAI from 'openai'
import { LocalStorageKeys } from '../../const'
import { get_current_tab, get_tabs, get_insights } from './assistantTools'

const TEMPLATE = `You are an expert in inferring what a browser user wants to do based on their current browser context and you are provided with the following information:

========
Current Tab:
{current_tab}

========
Opened Tabs:
{opened_tabs}

========
User Insights:
{insights}

========
You are tasked with generating {n} quick actions that can assist the user to kick start with their chat or browsing activities.
The suggested prompts should be:
- concise and maximum 8 words,
- makes logical sense,
- must be only related to current tab if presents (ignoe user insights),
- creative and diverse in content but related to user's current browsing context,
- balance the suggestions between opened tabs context and user insights if both are available.

Always respond as a list of strings strictly without any other characters.`

const formatJson = (obj: any) => {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

export async function getQuickPrompts(n: number = 2): Promise<string[]> {
  try {
    const [tab, tabs, insights] = await Promise.all([
      get_current_tab({}),
      get_tabs({}),
      get_insights({}),
    ])

    const filled = TEMPLATE
      .replace('{current_tab}', formatJson(tab))
      .replace('{opened_tabs}', formatJson(tabs))
      .replace('{insights}', formatJson(insights))
      .replace('{n}', String(n))

    const { togetherai_api_key, togetherai_model } = await browser.storage.local.get([
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
    ])

    const client = new OpenAI({
      apiKey: togetherai_api_key || '',
      dangerouslyAllowBrowser: true,
      baseURL: 'https://api.together.xyz/v1',
    })

    const result = await Promise.race([
      client.chat.completions.create({
        model: togetherai_model || "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        messages: [
          { role: 'user', content: filled }
        ],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('qp-timeout')), 10000)),
    ])

    const text = result.choices?.[0]?.message?.content?.trim() || ''
    console.log('Quick prompt raw output:', text)
    // 1) Try direct JSON array
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s)).slice(0, n)
      }
    } catch {}

    // 2) Try multiple JSON arrays present in text and flatten
    const arrays: string[] = []
    const arrayMatches = text.match(/\[[\s\S]*?\]/g) || []
    for (const m of arrayMatches) {
      try {
        const arr = JSON.parse(m)
        if (Array.isArray(arr)) arrays.push(...arr.map((s: any) => String(s)))
      } catch {}
    }
    if (arrays.length) {
      return Array.from(new Set(arrays)).slice(0, n)
    }

    // 3) Fallback: extract quoted strings per line
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    const guesses: string[] = []
    for (const line of lines) {
      const qm = line.match(/\"([^\"]+)\"/) || line.match(/'([^']+)'/)
      if (qm && qm[1]) {
        guesses.push(qm[1])
      } else {
        const cleaned = line.replace(/^[-*\d.\s]+/, '').replace(/^\[|\]$/g, '')
        if (cleaned) guesses.push(cleaned)
      }
    }
    return Array.from(new Set(guesses)).slice(0, n)
  } catch (e) {
    console.warn('[assistant][quick-prompts] failed:', e)
    return []
  }
}
