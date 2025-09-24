import { LitElement, html, css } from 'lit'
import {
  getRecentHistory,
  addWeights,
  generateProfileInputs,
  buildUserPrompt,
  summarizeCategories,
  type HistoryRow,
  type ProfileRow,
} from '../services/historyInsight'
import { LocalStorageKeys } from '../../const'


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
        const { togetherai_api_key } = await browser.storage.local.get([
          LocalStorageKeys.TOGETHERAI_API_KEY,
        ])
        this.togetherKey = togetherai_api_key || ''
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
            const prompt = buildUserPrompt(profile)
            const out = await summarizeCategories(prompt)
            this.insights = out
            console.debug('[MozHistory] insights:', out)
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
