import { LitElement, html, css } from 'lit'
import { LocalStorageKeys } from '../../../const'
import { SummaryHistoryItemT } from '../../../types'

export class MozPageSummaryHistory extends LitElement {
  historyDetails: SummaryHistoryItemT | null = null
  history: SummaryHistoryItemT[] = []

  static properties = {
    history: { type: Array },
    historyDetails: { type: Object },
  }

  static styles = css`
    :host {
      --color-bg: #202020;
      --color-fg: #ffffff;
      --color-border: #007bff;
      --color-link: #1e90ff;
      --color-input-bg: #424242;
      --color-response-bg: #2d2c2c;
    }

    .wrapper {
      display: block;
      padding: 10px;
      color: var(--color-fg);
      background-color: var(--color-bg);
    }

    .container {
      height: calc(100vh - 100px);
      max-height: calc(100vh - 100px);
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

    .heading-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .label {
      display: block;
      margin-bottom: 0px;
      font-weight: bold;
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .clear-button {
      padding: 8px 12px;
      background-color: var(--color-bg);
      color: var(--color-fg);
      border: 1px solid var(--color-fg);
      border-radius: 4px;
      cursor: pointer;
    }

    .history {
      background-color: var(--color-response-bg);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      overflow-y: auto;
      flex-grow: 1;
      line-height: 24px;
    }

    .response {
      background-color: var(--color-response-bg);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      overflow-y: auto;
      flex-grow: 1;
      line-height: 24px;
    }

    .history-details-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .history-items {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .history-item {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .history-item-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
      gap: 10px;
    }

    hr {
      border: none;
      border-top: 1px solid var(--color-secondary-hover);
      margin: 10px 0;
    }

    a {
      color: var(--color-link);
      text-decoration: none;
    }

    .details-wrapper {
      position: relative;
    }

    .details-heading-wrapper {
      pointer-events: none;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 10px;
      position: sticky;
      top: 0;
      z-index: 1;

      button {
        pointer-events: auto;
      }
    }

    .italic {
      font-style: italic;
    }
  `

  constructor() {
    super()
    this.initData()
  }

  async initData() {
    const { mock_summary_database } = await browser.storage.local.get([
      LocalStorageKeys.MOCK_SUMMARY_DATABASE,
    ])

    this.history = mock_summary_database || []
  }

  connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
  }

  disconnectedCallback() {
    browser.runtime.onMessage.removeListener(this.handleIncomingMessage)
    super.disconnectedCallback()
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'todo') {
    }
  }

  convertDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  historyDeleteHistoryItem = async (id: string) => {
    this.history = this.history.filter((item) => item.id !== id)
    await browser.storage.local.set({
      [LocalStorageKeys.MOCK_SUMMARY_DATABASE]: this.history,
    })
  }

  render() {
    return html`
      <div>
        ${this.historyDetails
          ? html`<div class="details-wrapper">
              <div class="details-heading-wrapper">
                <button
                  class="clear-button"
                  @click=${() => {
                    this.historyDetails = null
                  }}
                >
                  Back To History
                </button>
              </div>
              <h2>History Details</h2>
              <div class="history-details-container">
                <div>
                  <label class="label">Site Name:</label>
                  <div>${this.historyDetails.siteName || 'No Site name'}</div>
                </div>
                <div>
                  <label class="label">Prompt:</label>
                  <div class="italic">"${this.historyDetails.prompt}"</div>
                </div>

                <div>
                  <label class="label">Date Created:</label>
                  <div>${this.convertDate(this.historyDetails.date)}</div>
                </div>

                <div>
                  <a href="${this.historyDetails.url}" target="_blank"
                    >View Page</a
                  >
                </div>
              </div>
              <hr />
              <p .innerHTML=${this.historyDetails.result}></p>
            </div>`
          : html`<div class="history-items">
              ${this.history.map(
                (item) => html`
                  <div class="history-item">
                    <div>
                      <label class="label">Site Name:</label>
                      <div>${item.siteName || 'No Site name'}</div>
                    </div>

                    <div>
                      <label class="label">Site URL:</label>
                      <a href="${item.url}">${item.url}</a>
                    </div>

                    <div class="history-item-actions">
                      <button
                        class="clear-button"
                        @click=${() => {
                          this.historyDeleteHistoryItem(item.id)
                        }}
                      >
                        Delete
                      </button>
                      <button
                        class="primary-button"
                        @click=${() => {
                          this.historyDetails = item
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                  <hr />
                `
              )}
            </div>`}
      </div>
    `
  }
}

customElements.define('moz-page-summary-history', MozPageSummaryHistory)
