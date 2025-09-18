import { LocalStorageKeys } from '../../const'
import { get_current_tab, get_tabs, get_insights } from './assistantTools'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'
import type { ChatMessage } from './utilsOpenAI'

const QUICK_PROMPT_TEMPLATE = `You are an expert in suggesting a conversaton starter and you are provided with the following user context:

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
The following tools are available to the brower assistant:
- @get_page_content(url): retrieve raw page content for the given url, which can then be used to summarize the page or perform Q&A
- @get_tabs(): retrieve user's opened tabs for more context

========
You are tasked with generating {n} quick suggestions that can help the user kick start a chat with the browser assistant.
You must follow the following rules:
- be concise but specific, and limit to maximum 8 words for each action,
- items in insights are independent to each other,
- if current tab context is available (new tab == no context), only use that context and ignore user insights,
- else if both opened tabs and insights are available, balance the suggestions between them,
- suggestions should be common and must make logical sense,
- do not suggest actions like share or save (not exhaustive) that will require additional actions,
- do not suggest anything that will result in opening a new web page or requiring extra information to answer.`

const QUICK_PROMPT_IN_CONVO_TEMPLATE = `You are an expert suggesting next actions for a browser assistant user during a conversation.

========
Current Tab:
{current_tab}

========
Conversation History (latest last):
{conversation}

========
Generate {n} suggested next queries that the user might ask next.
- Keep each under 8 words and conversational.
- Stay relevant to the current tab and recent assistant replies.
- Do not repeat earlier user queries verbatim.
- Provide diverse and helpful directions based on the above.`

const formatJson = (obj: any) => {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

async function generateQuickPromptsFromPrompt(filled: string, n: number): Promise<string[]> {
  const { togetherai_url, togetherai_api_key, togetherai_model } = await browser.storage.local.get([
    LocalStorageKeys.TOGETHERAI_URL,
    LocalStorageKeys.TOGETHERAI_API_KEY,
    LocalStorageKeys.TOGETHERAI_MODEL,
  ])

  initOpenAIClient({ apiKey: togetherai_api_key, baseURL: togetherai_url })

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

  const result = await chatComplete({
    model: togetherai_model,
    // @ts-ignore
    messages: [
      { role: 'system', content: 'Return only valid JSON that matches the provided schema.' },
      { role: 'user', content: filled },
    ] as any,
    response_format: { type: 'json_object', schema: QUICK_PROMPTS_SCHEMA },
    timeoutMs: 15000,
  })

  const text = ((result as any).choices?.[0]?.message?.content || '').trim()
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
  // 3) Try multiple arrays present in text and flatten
  const arrays: string[] = []
  const arrayMatches = text.match(/\[[\s\S]*?\]/g) || []
  for (const m of arrayMatches) {
    try {
      const arr = JSON.parse(m)
      if (Array.isArray(arr)) arrays.push(...arr.map((s: any) => String(s)))
    } catch {}
  }
  if (arrays.length) return Array.from(new Set(arrays)).slice(0, n)
  // 4) Fallback: extract quoted strings per line
  const lines: string[] = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean)
  const guesses: string[] = []
  for (const line of lines) {
    const qm = line.match(/\"([^\"]+)\"/) || line.match(/'([^']+)'/)
    if (qm && qm[1]) guesses.push(qm[1])
    else {
      const cleaned = line.replace(/^[-*\d.\s]+/, '').replace(/^\[|\]$/g, '')
      if (cleaned) guesses.push(cleaned)
    }
  }
  return Array.from(new Set(guesses)).slice(0, n)
}

function trimConversation(history: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Keep only natural user/assistant messages; drop tool calls and tool outputs.
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history) {
    if ((m.role === 'user' || m.role === 'assistant') && m.content && m.content.trim()) {
      // skip assistant messages that only carry tool_calls and have empty content
      if (m.role === 'assistant' && (!m.content.trim() || m.content.trim() === '')) continue
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
  // Optionally cap the context to last ~10 messages for brevity
  // return out.slice(-10)
}

export async function getQuickPrompts(n: number = 2): Promise<string[]> {
  try {
    const [tab, tabs, insights] = await Promise.all([
      get_current_tab({}),
      get_tabs({}),
      get_insights({}),
    ])

    const filled = QUICK_PROMPT_TEMPLATE
      .replace('{current_tab}', formatJson(tab))
      .replace('{opened_tabs}', formatJson(tabs))
      .replace('{insights}', formatJson(insights))
      .replace('{n}', String(n))

    return await generateQuickPromptsFromPrompt(filled, n)
  } catch (e) {
    console.warn('[assistant][quick-prompts] failed:', e)
    return []
  }
}

export async function getQuickPromptsInConversation(history: ChatMessage[], n: number = 2): Promise<string[]> {
  try {
    const tab = await get_current_tab({})
    const convo = trimConversation(history)

    const filled = QUICK_PROMPT_IN_CONVO_TEMPLATE
      .replace('{current_tab}', JSON.stringify(tab))
      .replace('{conversation}', JSON.stringify(convo))
      .replace('{n}', String(n))
    return await generateQuickPromptsFromPrompt(filled, n)
  } catch (e) {
    console.warn('[assistant][quick-prompts][in-convo] failed:', e)
    return []
  }
}
