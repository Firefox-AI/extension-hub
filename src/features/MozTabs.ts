import { LitElement, html, css } from 'lit'
import { ContextMenuIds } from '../contextMenu'
import { marked } from 'marked'
import { LocalStorageKeys } from '../../const'

class MozTabs extends LitElement {
  prompt: string = ''
  loading: boolean = false
  response: string = ''

  static properties = {
    prompt: { type: String },
    loading: { type: Boolean },
    response: { type: String },
  }

  static styles = css`
    :host {
      --color-bg: #202020;
      --color-fg: #ffffff;
      --color-border: #007bff;
      --color-link: #1e90ff;
      --color-input-bg: #424242;
      --color-secondary-hover: #585858;
      --color-loader-bg: #424242;
      --color-response-bg: #2d2c2c;
      --color-gradient-start: #2e3133;
      --color-gradient-end: #4b4e52;
      --color-primary-hover: #0056b3;
    }

    a {
      color: var(--color-link);
    }

    p {
      line-height: 24px;
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
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .response {
      background-color: var(--color-response-bg);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      overflow-y: auto;
      flex-grow: 1;
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
  `

  constructor() {
    super()
    this.initData()
  }

  async initData() {
    const storedData = await browser.storage.local.get(
      LocalStorageKeys.LAST_TAB_SUMMARIZATION
    )
    if (storedData.last_tab_summarization) {
      this.response = storedData.last_tab_summarization
    }
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
    if (message.type !== 'tab_summarize_result') return

    const formattedResponse = await marked.parse(message.result)
    this.loading = false
    this.response = formattedResponse
      ? formattedResponse
      : 'No response received. Please try again.'
    browser.storage.local.set({
      [LocalStorageKeys.LAST_TAB_SUMMARIZATION]: this.response,
    })
  }

  handlePromptSubmit(prompt: string) {
    if (!this.prompt) {
      alert('Please enter a question to submit.')
      return
    }
    this.loading = true
    browser.runtime.sendMessage({
      type: 'tab_summarize',
      data: {
        prompt: this.prompt,
      },
    })
  }

  handleInput(event: Event) {
    const input = event.target as HTMLInputElement
    this.prompt = input.value
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Tab Summarization</h3>

          ${this.loading
            ? html`<div class="loader">
                <span>Getting your answer...</span>
              </div>`
            : ''}
          ${!this.loading && this.response
            ? html`<div class="response">
                <p .innerHTML=${this.response}></p>
              </div>`
            : ''}

          <div class="fields">
            <label class="label">Enter Prompt</label>
            <textarea
              @input="${this.handleInput}"
              class="text-input"
            ></textarea>
          </div>
          <button @click="${this.handlePromptSubmit}" class="primary-button">
            Ask
          </button>
        </div>
      </div>
    `
  }
}

export default MozTabs
