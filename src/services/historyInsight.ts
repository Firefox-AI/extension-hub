import { LocalStorageKeys } from '../../const'
import { initOpenAIClient, chatComplete } from './utilsOpenAI'

export type HistoryRow = {
  url: string
  title: string
  domain: string
  visit_time: string // ISO
  visit_count: number
  url_sanitized: string
  title_sanitized: string
}

export type ProfileRow = HistoryRow & {
  weight_score: number
  weighted_visits: number
}

// Half-life decay (0.5 ** (ageDays / halfLifeDays))
export function computeWeightDecay(
  visit_timeISO: string,
  halfLifeDays = 14,
  now: Date = new Date(Date.now()),
): number {
  const t = new Date(visit_timeISO)
  const ageMs = Math.max(0, now.getTime() - t.getTime())
  const ageDays = ageMs / 86400000
  const w = Math.pow(0.5, ageDays / halfLifeDays)
  return Math.round(w * 1000) / 1000
}

export function addWeights(rows: HistoryRow[], halfLifeDays = 14, now?: Date): ProfileRow[] {
  return rows.map((r) => {
    const weight_score = computeWeightDecay(r.visit_time, halfLifeDays, now as any)
    const weighted_visits = Math.round(weight_score * (r.visit_count || 1) * 1000) / 1000
    return { ...r, weight_score, weighted_visits }
  })
}

// Group by (url, title, domain) and average weighted_visits
export function computeProfileSummary(rows: ProfileRow[]): Array<{
  url: string
  title: string
  domain: string
  weighted_visits: number
}> {
  type Key = string
  const acc = new Map<Key, { url: string; title: string; domain: string; sum: number; n: number }>()
  for (const r of rows) {
    const key = `${r.url}\u0001${r.title}\u0001${r.domain}`
    const cur = acc.get(key)
    if (cur) {
      cur.sum += r.weighted_visits
      cur.n += 1
    } else {
      acc.set(key, { url: r.url, title: r.title, domain: r.domain, sum: r.weighted_visits, n: 1 })
    }
  }
  const out = Array.from(acc.values()).map((v) => ({
    url: v.url,
    title: v.title,
    domain: v.domain,
    weighted_visits: Math.round((v.sum / v.n) * 1000) / 1000,
  }))
  out.sort((a, b) => b.weighted_visits - a.weighted_visits)
  return out
}

// Collect search titles whose URL contains "search" and average weighted_visits
export function searchTexts(rows: ProfileRow[]): Record<string, number> {
  const filt = rows.filter((r) => /search/i.test(r.url))
  const acc = new Map<string, { sum: number; n: number }>()
  for (const r of filt) {
    const key = r.title || '(untitled)'
    const cur = acc.get(key)
    if (cur) {
      cur.sum += r.weighted_visits
      cur.n += 1
    } else {
      acc.set(key, { sum: r.weighted_visits, n: 1 })
    }
  }
  const out: Record<string, number> = {}
  for (const [k, v] of acc) out[k] = Math.round((v.sum / v.n) * 1000) / 1000
  return out
}

export function generateProfileInputs(rows: ProfileRow[]) {
  return {
    profile_summarized: computeProfileSummary(rows),
    search_texts: searchTexts(rows),
  }
}

export function buildUserPrompt(profile: unknown): string {
  return [
    'Use ONLY the provided browsing profile (no external knowledge) and AVOID any PII information.',
    'Category is a concise topic name.',
    'user_attribute are mostly entities, brand names, and some useful preferences (1 or 2 words).',
    'For EACH category, include:',
    '- top_domains: top 10 {domain, visit_sum} by descending visit_sum',
    '- top_user_attributes: top 12 entities or brand names or preferences inferred from domains/titles;',
    '',
    "Let's think step by step",
    'INPUT PROFILE:',
    JSON.stringify(profile, null, 2),
  ].join('\n')
}

export const SYSTEM_MSG =
  'You are a precise data analyst. Return ONLY a single JSON object that matches the schema. No code fences, no commentary.'

export const CATEGORY_OBJ = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    top_domains: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { domain: { type: 'string' }, visit_sum: { type: 'integer' } },
        required: ['domain', 'visit_sum'],
      },
    },
    top_user_attributes: { type: 'array', maxItems: 12, items: { type: 'string' } },
  },
  required: ['name', 'top_domains', 'top_user_attributes'],
} as const

export const CATEGORY_ARRAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: { type: 'array', minItems: 3, maxItems: 8, items: CATEGORY_OBJ },
  },
  required: ['categories'],
} as const

export async function summarizeCategories(profileText: string) {
  const { togetherai_url, togetherai_api_key, togetherai_model } = await browser.storage.local.get([
    LocalStorageKeys.TOGETHERAI_URL,
    LocalStorageKeys.TOGETHERAI_API_KEY,
    LocalStorageKeys.TOGETHERAI_MODEL,
  ])

  if (!togetherai_api_key || !togetherai_model) {
    throw new Error('Together AI configuration missing')
  }

  initOpenAIClient({ apiKey: togetherai_api_key, baseURL: togetherai_url })

  const request = await chatComplete({
    model: togetherai_model,
    // @ts-ignore
    messages: [
      { role: 'system', content: SYSTEM_MSG },
      { role: 'user', content: profileText },
    ] as any,
    // Prefer json_object for consistency with other services
    response_format: { type: 'json_object', schema: CATEGORY_ARRAY_SCHEMA },
    timeoutMs: 20000,
  })

  const raw = (request as any)?.choices?.[0]?.message?.content ?? ''
  let json = extractJSON(raw)

  // Retry if collapsed into one bucket
  if (!Array.isArray(json?.categories) || json.categories.length < 3) {
    const nudged = await chatComplete({
      model: togetherai_model,
      // @ts-ignore
      messages: [
        { role: 'system', content: SYSTEM_MSG },
        { role: 'user', content: profileText },
        { role: 'user', content: 'The previous attempt merged everything into one category. Now produce 3–8 distinct categories, strictly following the schema.' },
      ] as any,
      response_format: { type: 'json_object', schema: CATEGORY_ARRAY_SCHEMA },
      timeoutMs: 20000,
    })
    const nudgedRaw = (nudged as any)?.choices?.[0]?.message?.content ?? ''
    json = extractJSON(nudgedRaw)
  }

  return json
}

export function extractJSON(text: string): any {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const payload = m ? m[1] : text
  try {
    return JSON.parse(payload)
  } catch {
    return {}
  }
}

// -- email-only helpers --
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const EMAIL_KEYS_RE = /\b(email|e-mail|e_mail|mail)\b/i

function redactEmails(text?: string | null): string {
  if (!text) return ''
  return text.replace(EMAIL_RE, '[REDACTED_EMAIL]')
}

function sanitizeUrlEmailOnly(u?: string | null): string {
  if (!u) return ''
  try {
    const url = new URL(u)
    // strip userinfo
    url.username = ''
    url.password = ''
    // redact email-like query values
    const params = new URLSearchParams(url.search)
    for (const [k, v] of params.entries()) {
      if (EMAIL_KEYS_RE.test(k) || EMAIL_RE.test(decodeURIComponent(v))) {
        params.set(k, 'REDACTED_EMAIL')
      }
    }
    url.search = params.toString() ? `?${params.toString()}` : ''
    // final pass for path/fragment/mailto:
    return redactEmails(url.toString())
  } catch {
    return redactEmails(u)
  }
}

function getDomain(u?: string | null): string {
  try {
    return new URL(u ?? '').hostname
  } catch {
    return ''
  }
}

export async function getRecentHistory(opts?: {
  days?: number
  text?: string
  maxResults?: number
}): Promise<HistoryRow[]> {
  const days = opts?.days ?? 30
  const text = opts?.text ?? ''
  const maxResults = opts?.maxResults ?? 1000
  const startTime = Date.now() - days * 86400 * 1000

  const items = await browser.history.search({ text, startTime, maxResults })

  const rows: HistoryRow[] = items.map((it) => {
    const url = it.url ?? ''
    const title = it.title ?? ''
    return {
      url,
      title,
      domain: getDomain(url),
      visit_time: new Date(it.lastVisitTime ?? Date.now()).toISOString(),
      visit_count: (it as any).visitCount ?? 1,
      url_sanitized: sanitizeUrlEmailOnly(url),
      title_sanitized: redactEmails(title),
    }
  })

  return rows
}

