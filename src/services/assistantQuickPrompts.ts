import OpenAI from 'openai'
import { LocalStorageKeys } from '../../const'
import { get_current_tab, get_tabs, get_insights } from './assistantTools'

const QUICK_PROMPT_SUGGEST_TEMPLATE = `You are an expert in inferring what a browser user wants to do based on their current browser context and you are provided with the following:

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
You are tasked with generating {n} quick suggestions that can help the user kick start a chat with the browser assistant.
You must follow the following rules:
- be concise, no ending punctuations and limit to maximum 8 words for each action,
- use verbs like recommend/suggest more often,
- if current tab context is available, only use that context and ignore user insights,
- else if both opened tabs and insights are available, balance the suggestions between them,
- suggestions should be common and must make logical sense,
- do not suggest actions like share or save (not exhaustive) that will require additional actions,
- do not suggest anything that will result in opening a new web page or requiring extra information to answer.
`

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

    const filled = QUICK_PROMPT_SUGGEST_TEMPLATE
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

    const QUICK_PROMPTS_SCHEMA = {
      title: 'QuickPrompts',
      type: 'object',
      required: ['prompts'],
      properties: {
        prompts: {
          title: 'Prompts',
          description: 'A list of suggested quick prompts for browsing.',
          type: 'array',
          items: { type: 'string' },
        },
      },
    }

    const result = await Promise.race([
      client.chat.completions.create({
        model: togetherai_model || 'qwen3-235b-a22b-instruct',
        messages: [
          { role: 'system', content: 'Return only valid JSON that matches the provided schema.' },
          { role: 'user', content: filled },
        ],
        // @ts-ignore Together supports json schema
        response_format: { type: 'json_object', schema: QUICK_PROMPTS_SCHEMA },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('qp-timeout')), 15000)),
    ])

    const text = result.choices?.[0]?.message?.content?.trim() || ''
    console.log('Quick prompt raw output:', text)
    // 1) Try schema-compliant object
    try {
      const obj = JSON.parse(text)
      if (obj && Array.isArray(obj.prompts)) {
        return obj.prompts.map((s: any) => String(s)).slice(0, n)
      }
    } catch {}

    // 2) Try direct JSON array
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s)).slice(0, n)
      }
    } catch {}

    // 3) Try multiple JSON arrays present in text and flatten
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
