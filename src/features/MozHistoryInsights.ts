import { LitElement, html, css } from 'lit'
import {
  getRecentHistory,
  addWeights,
  generateProfileInputs,
  buildUserPrompt,
  summarizeCategories,
  getExistingInsights,
  saveInsightsFromCategories,
  type ProfileRow,
} from '../services/historyInsight'
import {
  getUserChats,
} from '../services/chatInsight'
import { LocalStorageKeys } from '../../const'


type DurationBreakdown = {
  total_ms: number
  history_ms: number
  prepare_ms: number
  llm_ms: number
  save_ms: number
  prompt_words?: number
}

function fmtMs(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

class MozHistoryInsights extends LitElement {

    // --- add state for quick testing ---
    isLoading = false
    error: string | null = null
    insights: any = null
    togetherKey = ''

    genBreakdown: DurationBreakdown | null = null

    static properties = {
        isLoading: { type: Boolean },
        error: { type: String },
        insights: { type: Object },
        togetherKey: { type: String },
    }

    // Auto-run once the component is in the DOM
    async firstUpdated() {
        const { togetherai_api_key } = await browser.storage.local.get([
          LocalStorageKeys.TOGETHERAI_API_KEY,
        ])
        this.togetherKey = togetherai_api_key || ''
        // hydrate previously saved insights so the panel is never empty on load
        await this.loadSavedInsights()
    }

    private handleGenerateInsights = async () => {
        this.isLoading = true; this.error = null; this.insights = null
         // phase timers
         const t0 = performance.now();
         let tHistory0 = t0, tHistory1 = t0;
         let tPrep0 = t0, tPrep1 = t0;
         let tLLM0 = t0, tLLM1 = t0;
         let tSave0 = t0, tSave1 = t0;
         let promptWordCount = 0;
        try {
            // HISTORY
            tHistory0 = performance.now();
            const baseRows = await getRecentHistory({ days: 60, maxResults: 500 });
            console.debug('[MozHistory] baseRows:', baseRows.length)
            tHistory1 = performance.now();

            const chatHistory = await getUserChats({ days: 30, maxConversations: 50, halfLifeDays: 14 });
            console.debug(`[ChatHistory] ${JSON.stringify(chatHistory)}`)

            // PREP (weights, profile, prompt)
            tPrep0 = performance.now();
            const rows: ProfileRow[] = addWeights(baseRows, 14)
            const profile = generateProfileInputs(rows)
            // console.debug(`profile => ${JSON.stringify(profile)}`)
            const existing = await getExistingInsights('local')
            const prompt = buildUserPrompt(profile, existing, 'history')
            promptWordCount = countWords(prompt)
            tPrep1 = performance.now();

            // LLM
            tLLM0 = performance.now();
            const out = await summarizeCategories(prompt)
            tLLM1 = performance.now();

            this.insights = out
            console.debug(`[MozHistory] insights: ${JSON.stringify(out)}`)

            const promptChat = buildUserPrompt(chatHistory, existing, 'conversation')
            const outChat = await summarizeCategories(promptChat)

            console.debug(`[ChatHistory] insights: ${JSON.stringify(outChat)}`)

            // persistence logic
            await saveInsightsFromCategories(this.insights, 'local', 'history')
            await saveInsightsFromCategories(outChat, 'local', 'conversation')
            // refresh the cached view so reopening the panel shows latest data
            await this.loadSavedInsights()

            // SAVE
            tSave0 = tLLM1;
            tSave1 = performance.now();
        } catch (e: any) {
            this.error = e?.message ?? String(e)
        } finally {
          const tend = performance.now();
          // ensure monotonicity in case of early failures
          tHistory1 ||= tHistory0;
          tPrep1 ||= tPrep0;
          tLLM1 ||= tLLM0;
          tSave1 ||= tend;

          this.genBreakdown = {
            total_ms: tend - t0,
            history_ms: Math.max(0, tHistory1 - tHistory0),
            prepare_ms: Math.max(0, tPrep1 - tPrep0),
            llm_ms: Math.max(0, tLLM1 - tLLM0),
            save_ms: Math.max(0, tSave1 - tSave0),
            prompt_words: promptWordCount,
          };
          this.isLoading = false;
        }
    }

    private async loadSavedInsights() {
      try {
        const existing = await getExistingInsights('local')
        if (!Array.isArray(existing) || existing.length === 0) return

        const grouped = new Map<string, { name: string; attrs: { name: string; weight: number }[] }>()
        for (const record of existing) {
          const category = record.category?.trim()
          const attribute = record.user_attribute?.trim()
          if (!category || !attribute) continue
          if (!grouped.has(category)) {
            grouped.set(category, { name: category, attrs: [] })
          }
          grouped.get(category)!.attrs.push({ name: attribute, weight: record.weight ?? 0 })
        }

        const categories = Array.from(grouped.values()).map(({ name, attrs }) => {
          const sorted = attrs
            .slice()
            .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
          return {
            name,
            top_user_attributes: sorted.map((item) => item.name),
          }
        })

        this.insights = { categories }
      } catch (err) {
        console.warn('[MozHistory] failed to load saved insights', err)
      }
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

    .duration {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.9;
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
                ${this.genBreakdown ? html`
                  <div class="duration">
                    Last run: <b>${fmtMs(this.genBreakdown.total_ms)}</b>
                    <span> (history ${fmtMs(this.genBreakdown.history_ms)},
                    prep ${fmtMs(this.genBreakdown.prepare_ms)},
                    model ${fmtMs(this.genBreakdown.llm_ms)},
                    save ${fmtMs(this.genBreakdown.save_ms)})</span>
                    <span> • prompt ${this.genBreakdown.prompt_words ?? 0} words</span>
                  </div>
                ` : ''}
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
