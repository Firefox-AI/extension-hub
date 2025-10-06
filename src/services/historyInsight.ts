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

export type InsightRecord = {
    id: string               // category + "_" + user_attribute
    category: string         // short name
    user_attribute: string   // entity / attribute
    weight: number           // 0..1
    created_at: string       // ISO timestamp
    source: 'history' | 'conversation' | 'dashboard' | string
    is_blocked: boolean
}
  
const STORAGE_KEY = 'moz_insight_records_v1'

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
}

function recKey(c: string, a: string): string {
  return `${norm(c)}|${norm(a)}`
}

async function getStore(storageType: 'local' | 'sync' = 'local') {
  return browser.storage[storageType]
}

export async function listInsights(
  storageType: 'local' | 'sync' = 'local'
): Promise<InsightRecord[]> {
  const store = await getStore(storageType)
  const obj = await store.get(STORAGE_KEY)
  return (obj[STORAGE_KEY] as InsightRecord[] | undefined) ?? []
}

export async function setInsightBlocked(
  id: string,
  isBlocked: boolean,
  storageType: 'local' | 'sync' = 'local'
) {
  const store = await getStore(storageType)
  const current = await listInsights(storageType)
  const next = current.map(r => (r.id === id ? { ...r, is_blocked: isBlocked } : r))
  await store.set({ [STORAGE_KEY]: next })
}

export async function clearInsights(storageType: 'local' | 'sync' = 'local') {
  const store = await getStore(storageType)
  await store.set({ [STORAGE_KEY]: [] })
}

function scoreToUnit(score: unknown): number {
  // clamp to [1,5], then scale by 0.2 → [0.2, 1.0]
  const n = Number(score);
  const clamped = Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3; // default mid if NaN
  const scaled = clamped * 0.2;
  return Math.round(scaled * 1000) / 1000; // 3 decimals
}

/**
 * get existing insights
 */
export async function getExistingInsights(
  storageType: 'local' | 'sync' = 'local',
) {
  const existing = await listInsights(storageType)
  return existing
}


function blendCoeffs(source: string): { prev: number; next: number } {
  switch (source) {
    case 'dashboard':    return { prev: 0.01, next: 0.99 }; // dashboard: 1% prev, 99% new
    case 'conversation':
    case 'chat':         return { prev: 0.6, next: 0.4 }; // chat:      60% prev, 40% new
    case 'history':
    default:             return { prev: 0.8, next: 0.2 }; // history:   80% prev, 20% new
  }
}

/**
 * Persist categories -> attributes with weights.
 * If model didn’t return scores, we fall back to equal weights.
 */
export async function saveInsightsFromCategories(
  insights: any,
  storageType: 'local' | 'sync' = 'local',
  source: 'history' | 'conversation' | 'dashboard' | string = 'history'
) {
  const store = await getStore(storageType)
  const existing = await listInsights(storageType)
  console.debug(`existing = ${JSON.stringify(existing)}`)

  // Build a map for dedupe
  const map = new Map<string, InsightRecord>()
  for (const r of existing) map.set(recKey(r.category, r.user_attribute), r)

  const categories: any[] = Array.isArray(insights?.categories) ? insights.categories : []
  const nowISO = new Date().toISOString()
  const { prev: W_PREV, next: W_NEW } = blendCoeffs(source)

  for (const c of categories) {
    const catName = String(c?.name ?? '').trim()
    if (!catName) continue

    const attrs: string[] = Array.isArray(c.top_user_attributes) ? c.top_user_attributes : []
    const rawScores: unknown[] = Array.isArray(c.scores) ? c.scores : []

    // If scores missing/misaligned, fallback to equal weights across attributes
    const useScores = rawScores.length === attrs.length && attrs.length > 0;

    attrs.forEach((attr, i) => {
      // new weight from model: 1..5 → 0..1 via *0.2 (with clamp)
      const newWeight = useScores
        ? scoreToUnit(rawScores[i])
        : (attrs.length ? Math.round((1 / attrs.length) * 1000) / 1000 : 0);

      const key = recKey(catName, attr)
      const prev = map.get(key)
      const keepBlocked = prev?.is_blocked ?? false

      // EMA by source
      const prevWeight = typeof prev?.weight === 'number' ? prev.weight : 0
      const blended = prev ? (W_PREV * prevWeight + W_NEW * newWeight) : newWeight

      const finalWeight = Math.max(0, Math.min(1, Math.round(blended * 1000) / 1000))

      const next: InsightRecord = {
        id: prev?.id ?? `${catName}_${attr}`,
        category: catName,
        user_attribute: attr,
        weight: finalWeight,
        created_at: nowISO,   // last updated time; rename to updated_at if you prefer
        source,
        is_blocked: keepBlocked,
      }

      map.set(key, next)
    })
  }

  const toSave = Array.from(map.values())
  await store.set({ [STORAGE_KEY]: toSave })
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

export function nounFor(source?: string): 'browsing' | 'conversation' | 'dashboard' {
  if (source === 'history') return 'browsing';
  if (source === 'conversation' || source === 'dashboard') return source;
  return 'browsing';
}

export function buildUserPrompt(profile: unknown, existing: unknown, source: string = 'history'): string {
  const source_string = nounFor(source);
  return [
    '### Task',
    `Summarize ${source_string} interests into high-quality categories and attributes using ONLY the provided profile and previous insights. Do not invent facts or rely on outside knowledge.`,
    '',
    '### Category rules',
    '- Name must be a concise, human-readable topic (1–4 words).',
    '- If a category already exists in the previous insights (case-insensitive), reuse it instead of creating a variation.',
    '- Do not create sensitive categories (e.g., health, politics, personal identifiers).',
    '- Do not miss genuine categories excluding the sensitive categories',
    '',
    '### Attribute rules',
    `- Each attribute must be a meaningful entity, brand, product type, or preference phrase clearly supported by the ${source_string} evidence.`,
    '- Attributes must be between 1 and 2 words, and cannot be generic stopwords (the, and, shop, search, etc.).',
    '- Avoid single letters, random tokens, or vague terms such as "Baby", "Babies", "The", "Sale".',
    '- Normalize duplicates: treat singular/plural/case variants as the same attribute and keep only the best phrasing.',
    '- Limit to at most 10 attributes per category, ordered by relevance and diverisify the attributes.',
    '- Never emit PII, IDs, or gibberish strings; skip anything that cannot be safely anonymized.',
    '',
    '### Scoring rules',
    '- Provide a parallel `scores` array with values in [1,2,3,4,5].',
    '- Scores must align with the attributes list (same order and length).',
    '- Use higher scores when there is strong, repeated evidence in the profile.',
    '',
    '### Output format',
    '- Return ONLY JSON matching the supplied schema.',
    '- Exclude attributes or categories that cannot be justified from the profile.',
    '',
    '### Previous insights for this user:',
    JSON.stringify(existing, null, 2),
    '',
    '### Instructions',
    '- Do not repeat categories or attributes already present unless you are updating their scores.',
    '- Think step by step to choose the most representative categories and attributes before producing the final JSON.',
    '',
    '### Input profile:',
    JSON.stringify(profile, null, 2),
  ].join('\n')
}

export const SYSTEM_MSG =
  `You are a precise data analyst.
    Return ONLY a single JSON object that matches the schema.
    Do NOT use object keys as category names; each category MUST be an object with a "name" string.
    Example:
    {"categories":[{"name":"Sports","top_user_attributes":["Cleats", "Sportscheck", "Adidas", "soccer", "shoesize 6" ], "scores":[5, 2, 3, 5, 3 ]}]}`


export const CATEGORY_OBJ = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    top_user_attributes: { type: 'array', maxItems: 12, items: { type: 'string' } },
    scores: { type: 'array', maxItems: 12, items: { type: 'number' } },
  },
  required: ['name', 'top_user_attributes', 'scores'],
} as const

export const CATEGORY_ARRAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: { type: 'array', minItems: 3, maxItems: 8, items: CATEGORY_OBJ },
  },
  required: ['categories'],
} as const

export async function summarizeCategories(profileText: string,
                                          model = 'mistralai/Mistral-Small-24B-Instruct-2501') {
  const { togetherai_url, togetherai_api_key } = await browser.storage.local.get([
    LocalStorageKeys.TOGETHERAI_URL,
    LocalStorageKeys.TOGETHERAI_API_KEY,
  ])

  if (!togetherai_api_key) {
    throw new Error('Together AI configuration missing')
  }

  initOpenAIClient({ apiKey: togetherai_api_key, baseURL: togetherai_url })

  const request = await chatComplete({
    model: model,
    // @ts-ignore
    messages: [
      { role: 'system', content: SYSTEM_MSG },
      { role: 'user', content: profileText },
    ] as any,
    // Prefer json_object for consistency with other services
    response_format: { type: 'json_object', schema: CATEGORY_ARRAY_SCHEMA, strict: true },
    timeoutMs: 20000,
  })

  const raw = (request as any)?.choices?.[0]?.message?.content ?? ''
  let json = extractJSON(raw)

  // Retry if collapsed into one bucket
  if (!Array.isArray(json?.categories) || json.categories.length < 3) {
    const nudged = await chatComplete({
      model: model,
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

export async function readInsights(): Promise<any> {
  const maxAttrs = 10;

  const existing = await getExistingInsights('local')
  // console.debug(`existing = ${JSON.stringify(existing)}`)
  const catMap = new Map<string, Map<string, number>>();

  for (const r of existing || []) {
    if (!r || r.is_blocked) continue;
    const cat = (r.category || '').trim();
    const attr = (r.user_attribute || '').trim();
    if (!cat || !attr) continue;

    const attrs = catMap.get(cat) ?? new Map<string, number>();
    attrs.set(attr, Math.max(attrs.get(attr) ?? 0, Number(r.weight) || 0));
    if (!catMap.has(cat)) catMap.set(cat, attrs);
  }

  const categories = Array.from(catMap.entries()).map(([name, attrs]) => {
    const top = Array.from(attrs.entries())
      .sort((a, b) => b[1] - a[1])        // sort by weight desc
      .slice(0, maxAttrs)                 // take top N
      .map(([attr]) => attr);             // return names only
    return { name, top_user_attributes: top };
  });

  return { categories };

}
