import { LitElement, html, css } from 'lit'
import { PageContentT } from '../../types'
import { getOpenAIResponse } from '../services/openai'

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
    now: Date = new Date(Date.now()) 
    ): number {
    const t = new Date(visit_timeISO)
    const ageMs = Math.max(0, now.getTime() - t.getTime())
    const ageDays = ageMs / 86400000
    const w = Math.pow(0.5, ageDays / halfLifeDays)
    return Math.round(w * 1000) / 1000
}


export function addWeights(rows: HistoryRow[], halfLifeDays = 14, now?: Date): ProfileRow[] {
    return rows.map((r) => {
        const weight_score = computeWeightDecay(r.visit_time, halfLifeDays, now)
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
            cur.sum += r.weighted_visits; cur.n += 1 
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
        'Use ONLY the provided browsing profile (no external knowledge) and AVOID any PII information, IDs and gibberish information.',
        'Category is a concise topic name.',
        'user_attribute are mostly entities, brand names, category type and meaniningful useful preferences (1 or 2 words).',
        'For EACH category, include:',
        '- top_user_attributes: top 12 entities or brand names or category type or meaniningful preferences inferred from domains/titles;',
        '',
        "Let’s think step by step",
        'INPUT PROFILE:',
        JSON.stringify(profile, null, 2),
    ].join('\n')
}

export type TogetherChatArgs = {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature?: number
    max_tokens?: number
    response_format?: unknown
}
    
    
export async function togetherChat(args: TogetherChatArgs): Promise<any> {
    const { TOGETHER_OPENAI_API_KEY } = await browser.storage.sync.get('TOGETHER_OPENAI_API_KEY') as any
    if (!TOGETHER_OPENAI_API_KEY) throw new Error('Missing Together API key in settings')

    const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOGETHER_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ ...args }),
    })
    if (!resp.ok) {
        throw new Error(`Together API error ${resp.status}: ${await resp.text()}`)
    }
    return resp.json()
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
    required: ['name', 'top_user_attributes'],
} as const


export const CATEGORY_ARRAY_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        categories: { type: 'array', minItems: 3, maxItems: 8, items: CATEGORY_OBJ },
    },
    required: ['categories'],
} as const


export async function summarizeCategories(profileText: string, model = 'Qwen/Qwen3-235B-A22B-Thinking-2507') {
    const resp = await togetherChat({
        model,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_schema', schema: CATEGORY_ARRAY_SCHEMA },
        messages: [ { role: 'system', content: SYSTEM_MSG }, { role: 'user', content: profileText } ],
    })
    const raw = resp?.choices?.[0]?.message?.content ?? ''
    const json = extractJSON(raw)
    // Retry if collapsed into one bucket
    if (!Array.isArray(json?.categories) || json.categories.length < 3) {
        const nudged = await togetherChat({
            model,
            temperature: 0.0,
            max_tokens: 4000,
            response_format: { type: 'json_schema', schema: CATEGORY_ARRAY_SCHEMA },
            messages: [
                { role: 'system', content: SYSTEM_MSG },
                { role: 'user', content: profileText },
                { role: 'user', content: 'The previous attempt merged everything into one category. Now produce 3–8 distinct categories, strictly following the schema.' },
            ],
        })
        return extractJSON(nudged?.choices?.[0]?.message?.content ?? '{}')
    }
    return json
}


export function extractJSON(text: string): any {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const payload = m ? m[1] : text
    try { return JSON.parse(payload) } catch { return {} }
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
    console.debug("getRecentHistory");
    const days = opts?.days ?? 30
    const text = opts?.text ?? ''
    const maxResults = opts?.maxResults ?? 1000
    const startTime = Date.now() - days * 86400 * 1000
  
    const items = await browser.history.search({ text, startTime, maxResults })
    console.debug(`items = ${items.length}`);
  
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


class MozHistoryInsights extends LitElement {

        // --- add state for quick testing ---
    isLoading = false
    error: string | null = null
    historyPreview: HistoryRow[] = []
    insights: any = null
    togetherKey = ''

    static properties = {
        isLoading: { type: Boolean },
        error: { type: String },
        historyPreview: { type: Array },
        insights: { type: Object },
        togetherKey: { type: String },
    }

    // Auto-run once the component is in the DOM
    async firstUpdated() {
        console.debug('[MozHistory] firstUpdated -> calling getRecentHistory()')
        await this.handleLoadHistory(1, 5)   // 1 day, 5 rows for a super-fast test
        const { TOGETHER_OPENAI_API_KEY } = await browser.storage.sync.get('TOGETHER_OPENAI_API_KEY') as any
        this.togetherKey = TOGETHER_OPENAI_API_KEY || ''
    }

    // private saveKey = async () => {
    //     await browser.storage.sync.set({ TOGETHER_OPENAI_API_KEY: this.togetherKey })
    // }

    // Clickable test hook
    private handleLoadHistory = async (days = 60, maxResults = 200) => {
        console.debug("handleLoadHistory")
        this.isLoading = true
        this.error = null
        try {
            const rows = await getRecentHistory({ days, maxResults })
            this.historyPreview = rows.slice(0, 50)
            console.debug('[MozHistory] rows:', rows.length)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally { this.isLoading = false }
    }

    private handleGenerateInsights = async () => {
        this.isLoading = true; this.error = null; this.insights = null
        try {
            const baseRows = await getRecentHistory({ days: 60, maxResults: 500 })
            const rows: ProfileRow[] = addWeights(baseRows, 14)
            const profile = generateProfileInputs(rows)
            console.debug(`profile => ${JSON.stringify(profile)}`)
            const prompt = buildUserPrompt(profile)
            const out = await summarizeCategories(prompt)
            this.insights = out
            console.debug(`[MozHistory] insights: ${JSON.stringify(out)}`)
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally { this.isLoading = false }
    }

    static styles = css`
    :host {
      --color-bg: #202020;
      --color-link: #1e90ff;
      --color-fg: #ffffff;
      --color-border: #007bff;
      --color-input-bg: #424242;
      --color-secondary-hover: #585858;
      --color-loader-bg: #424242;
      --color-response-bg: #2d2c2c;
      --color-gradient-start: #2e3133;
      --color-gradient-end: #4b4e52;
      --color-primary-disabled: #6d6d6d;
      --color-error: #ff4d4d;
    }

    a {
      color: var(--color-link);
    }

    .wrapper {
      display: block;
      color: var(--color-fg);
      background-color: var(--color-bg);
      padding: 10px;
      user-select: text !important;
      -moz-user-select: text !important;
    }

    .container {
      min-height: calc(100vh - 140px);
      display: flex;
      padding: 10px 14px;
      background: linear-gradient(
        135deg,
        var(--color-gradient-start) 0%,
        var(--color-gradient-end) 100%
      );
      flex-direction: column;
      border-radius: 8px;
      font-size: 14px;
    }

    .text-area {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      min-height: 120px;
      width: 100%;
      box-sizing: border-box;
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;
    }

    .primary-button:disabled {
      background-color: var(--color-primary-disabled);
      cursor: not-allowed;
    }

    .label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      font-size: 14px;
    }

    .field {
      margin-bottom: 12px;
    }

    @keyframes pulse {
      0% {
        background-color: var(--color-loader-bg);
      }
      50% {
        background-color: var(--color-secondary-hover);
      }
      100% {
        background-color: var(--color-loader-bg);
      }
    }

    .loader {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      background-color: var(--color-loader-bg);
      border-radius: 4px;
      color: var(--color-fg);
      animation: pulse 1.5s infinite;
      margin: 10px 0;
    }

    .response {
      padding: 12px;
      background-color: var(--color-response-bg);
      border-radius: 4px;
      color: var(--color-fg);
      overflow-y: auto;
      flex-grow: 1;
      line-height: 1.5;
      margin: 10px 0;
    }

    .error-message {
      padding: 12px;
      background-color: var(--color-error);
      border-radius: 4px;
      color: var(--color-fg);
      margin: 10px 0;
    }

    .controls-section {
      margin-bottom: 15px;
      flex-shrink: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th,
    td {
      border: 1px solid var(--color-secondary-hover);
      padding: 8px;
      text-align: left;
    }

    th {
      background-color: var(--color-input-bg);
    }

    .category-card {
        border: 1px solid var(--color-secondary-hover);
        background: var(--color-response-bg);
        border-radius: 14px;
        padding: 12px;
        margin: 12px 0 16px;
        box-shadow: 0 1px 6px rgba(0,0,0,0.15);
      }
    
      .category-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 9999px;
        border: 1.5px solid var(--accent, var(--color-border));
        background:
          radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.0) 60%),
          linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end));
        color: var(--color-fg);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.1) inset;
      }
      .chip-dot {
        width: 10px;
        height: 10px;
        border-radius: 9999px;
        background: var(--accent, var(--color-border));
        box-shadow: 0 0 0 2px rgba(0,0,0,0.25);
      }
    
      .group-title {
        margin: 10px 0 6px;
        font-size: 12px;
        opacity: 0.85;
      }
    
      .pill-group {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
    
      .pill-attr {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 9999px;
        border: 1px solid var(--color-secondary-hover);
        background: var(--color-input-bg);
        color: var(--color-fg);
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset;
      }
    `;
    
    render() {
        const cats = this.insights?.categories ?? [];
        const accents = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#a78bfa', '#14b8a6', '#ef4444'];
      
        return html`
          <div class="wrapper">
            <div class="container">
              <div class="controls-section">
                <button class="primary-button"
                  @click=${this.handleGenerateInsights}
                  ?disabled=${this.isLoading || !this.togetherKey}>
                  ${this.isLoading ? 'Analyzing...' : 'Generate Insights'}
                </button>
              </div>
      
              ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      
              ${cats.length ? html`
                <div class="response">
                  <h3>Categories</h3>
                  ${cats.map((c: any, i: number) => html`
                    <div class="category-card" style=${`--accent:${accents[i % accents.length]}`}>
                      <div class="category-chip">
                        <span class="chip-dot"></span>
                        <span>${c.name}</span>
                      </div>
      
                      <div class="group-title">Attributes</div>
                      <div class="pill-group">
                        ${(Array.isArray(c.top_user_attributes) ? c.top_user_attributes : [])
                          .map((attr: string) => html`<span class="pill-attr">${attr}</span>`)}
                      </div>
                    </div>
                  `)}
                </div>
              ` : ''}
            </div>
          </div>
        `;
    }
}

export default MozHistoryInsights
