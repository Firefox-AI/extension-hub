import { LitElement, html, css } from 'lit'
import { ContextMenuIds } from '../../contextMenu'
import { marked } from 'marked'
import { LocalStorageKeys } from '../../../const'
import './MozPageSummaryHistory'
import { CurrentSummaryT, SummaryHistoryItemT } from '../../../types'

const PROMPT_OPTIONS = [
  'Can you summarize this page?',
  'What are the key points of this article?',
  'Can you explain the main concepts in simple terms?',
  "What is the author's main argument?",
  'Can you provide a brief overview of this content?',
  'What are the most important details in this text?',
  'Can you highlight the main findings of this research?',
  'What are the key takeaways from this document?',
]

class MozPageSummarization extends LitElement {
  prompt: string = 'Can you summarize this page?'
  loading: boolean = false
  response: string = ''
  currentSummary: CurrentSummaryT = {
    result: '',
    prompt: '',
    url: '',
    siteName: '',
  }
  showHistory: boolean = false
  showSaveButton: boolean = false
  history: SummaryHistoryItemT[] = []
  showBank: boolean = false

  static properties = {
    prompt: { type: String },
    loading: { type: Boolean },
    response: { type: String },
    currentSummary: { type: Object },
    showHistory: { type: Boolean },
    history: { type: Array },
    showSaveButton: { type: Boolean },
    showBank: { type: Boolean },
  }

  static styles = css`
    :host {
      --color-bg: #202020;
      --color-fg: #ffffff;
      --color-fg-subtle: #b0b0b0;
      --color-border: #007bff;
      --color-input-bg: #424242;
      --color-secondary-hover: #585858;
      --color-loader-bg: #424242;
      --color-response-bg: #2d2c2c;
      --color-gradient-start: #2e3133;
      --color-gradient-end: #4b4e52;
      --color-primary-hover: #0056b3;
      --color-primary-disabled: #6d6d6d;
      --color-pos-bg: #1f8766;
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
    .fields {
      display: flex;
      flex-direction: column;
    }

    .text-input {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
    }

    .label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      margin-top: 10px;
    }

    .pos-button {
      background-color: var(--color-pos-bg);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      margin-top: 10px;
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;

      &:disabled {
        background-color: var(--color-primary-disabled);
        cursor: not-allowed;
      }
    }

    .outline-button {
      padding: 8px 12px;
      color: var(--color-fg);
      border: 1px solid var(--color-fg);
      border-radius: 4px;
      cursor: pointer;
      background-color: transparent;
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
      margin-bottom: 10px;
    }

    .bank-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
      max-height: 30vh;
      overflow-y: auto;
    }

    .bank-actions-wrapper {
      display: flex;
      justify-content: flex-end;
      padding: 12px 0;
      border-top: 1px solid var(--color-fg-subtle);
    }

    .bank-actions-container {
      display: flex;
      gap: 8px;
    }

    .mb-10 {
      margin-bottom: 10px;
    }
  `

  constructor() {
    super()
    this.initData()
  }

  async initData() {
    const {
      last_page_summarization,
      mock_summary_database,
      last_page_summarization_prompt,
    } = await browser.storage.local.get([
      LocalStorageKeys.LAST_PAGE_SUMMARIZATION,
      LocalStorageKeys.MOCK_SUMMARY_DATABASE,
      LocalStorageKeys.LAST_PAGE_SUMMARIZATION_PROMPT,
    ])

    last_page_summarization ? (this.response = last_page_summarization) : ''

    this.history = mock_summary_database || []
    this.showSaveButton = false
    this.prompt = last_page_summarization_prompt || PROMPT_OPTIONS[0]
  }

  connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)

    // TODO summarize selected text
    browser.menus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId !== ContextMenuIds.TEXT_SELECTION_SUMMARIZATION)
        return
      console.log(
        `Context menu clicked:${info.selectionText} in tab ${tab?.url}`
      )
    })
  }

  disconnectedCallback() {
    browser.runtime.onMessage.removeListener(this.handleIncomingMessage)
    super.disconnectedCallback()
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'page_summarize_result') {
      const formattedResponse = await marked.parse(message.result)
      this.loading = false
      this.response = formattedResponse
        ? formattedResponse
        : 'No response received. Please try again.'
      this.showSaveButton = true
      browser.storage.local.set({
        [LocalStorageKeys.LAST_PAGE_SUMMARIZATION]: this.response,
      })
      this.currentSummary = {
        result: formattedResponse,
        prompt: message.prompt,
        url: message.url,
        siteName: message.siteName,
      }
    }
  }

  handlePromptSubmit() {
    if (!this.prompt) {
      this.prompt = PROMPT_OPTIONS[0]
    }
    this.loading = true
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, {
          type: 'page_summarize_prompt',
          prompt: this.prompt,
        })
      }
    })
    browser.storage.local.set({
      [LocalStorageKeys.LAST_PAGE_SUMMARIZATION_PROMPT]: this.prompt,
    })
  }

  handleInput(event: Event) {
    const input = event.target as HTMLInputElement
    this.prompt = input.value
  }

  async handleSaveSummary() {
    if (!this.currentSummary.result) {
      alert('No summary available to save.')
      return
    }

    const { mock_summary_database } = await browser.storage.local.get(
      LocalStorageKeys.MOCK_SUMMARY_DATABASE
    )

    const newSummary: SummaryHistoryItemT = {
      ...this.currentSummary,
      date: new Date().toISOString(),
      id: Date.now().toString(), // Unique ID for the summary
    }

    const updatedSummaries = [...(mock_summary_database || []), newSummary]

    // Save the summary data to local storage
    await browser.storage.local.set({
      [LocalStorageKeys.MOCK_SUMMARY_DATABASE]: updatedSummaries,
    })

    this.showSaveButton = false

    alert('Summary saved successfully.')
  }

  async handleToggleHistory() {
    this.showHistory = !this.showHistory
    if (this.showHistory) {
      const { mock_summary_database } = await browser.storage.local.get(
        LocalStorageKeys.MOCK_SUMMARY_DATABASE
      )
      this.history = mock_summary_database || []
    }
  }

  handleOpenPromptBank() {
    this.showBank = true
  }

  handleClosePromptBank() {
    this.showBank = false
  }

  render() {
    const showResponse = !this.loading && !this.showHistory && this.response
    const showPromptInput = !this.showHistory

    return html`
      <div class="wrapper">
        <div class="container">
          <div class="heading-wrapper">
            <h3 class="title">Page Summarization</h3>
            <button class="primary-button" @click="${this.handleToggleHistory}">
              ${this.showHistory ? '- History' : '+ History'}
            </button>
          </div>

          ${this.loading
            ? html`<div class="loader">
                <span>Getting your answer...</span>
              </div>`
            : null}
          ${this.showHistory
            ? html`
                <div class="history">
                  ${this.history.length === 0
                    ? html`<p>No summaries found.</p>`
                    : html`<moz-page-summary-history></moz-page-summary-history>`}
                </div>
              `
            : null}
          ${showResponse
            ? html`
                <div class="response">
                  <p .innerHTML=${this.response}></p>
                </div>
                ${this.showSaveButton
                  ? html`
                      <button
                        class="pos-button"
                        @click="${this.handleSaveSummary}"
                      >
                        Save Summary
                      </button>
                    `
                  : null}
              `
            : null}
          ${showPromptInput
            ? html`
                <div class="fields">
                  <label class="label">Enter Prompt</label>
                  <textarea
                    class="text-input"
                    .value=${this.prompt}
                    .disabled=${this.loading}
                    rows="4"
                    @input=${this.handleInput}
                  ></textarea>
                </div>

                ${!this.showBank
                  ? html`
                      <button
                        class="outline-button mb-10"
                        @click=${this.handleOpenPromptBank}
                      >
                        Select Prompt From Bank
                      </button>
                    `
                  : html` <section>
                      <div class="bank-container">
                        ${PROMPT_OPTIONS.map(
                          (option) => html`
                            <button
                              class="outline-button"
                              @click=${() => {
                                this.prompt = option
                                this.handleClosePromptBank()
                                this.handlePromptSubmit()
                              }}
                            >
                              ${option}
                            </button>
                          `
                        )}
                      </div>
                      <div class="bank-actions-wrapper">
                        <div class="bank-actions-container">
                          <button
                            class="primary-button"
                            @click=${() => {
                              alert(
                                'Custom prompt functionality not implemented yet. - NG'
                              )
                            }}
                          >
                            + Add Custom Prompt
                          </button>
                          <button
                            class="outline-button"
                            @click=${this.handleClosePromptBank}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </section>`}

                <button
                  class="primary-button"
                  @click=${this.handlePromptSubmit}
                  .disabled=${this.loading}
                >
                  ${this.loading ? 'Loading...' : 'Ask'}
                </button>
              `
            : null}
        </div>
      </div>
    `
  }
}

export default MozPageSummarization
