import { LitElement, html, css } from 'lit'
import { LocalStorageKeys } from '../../const'
import { marked } from 'marked'

class MozQuestionAnswer extends LitElement {
  prompt: string = ''
  loading: boolean = false
  response: string = ''
  exampleQuestions = [
    'Can you define all the key words here?',
    'Can you summarize the content?',
  ]

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
      --color-input-bg: #424242;
      --color-secondary-hover: #585858;
      --color-loader-bg: #424242;
      --color-response-bg: #2d2c2c;
      --color-gradient-start: #2e3133;
      --color-gradient-end: #4b4e52;
      --color-primary-disabled: #6d6d6d;
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

    .title {
      font-size: 16px;
      font-weight: 300;
      margin-bottom: 0;
    }

    .text-input {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
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

    .secondary-button {
      padding: 8px 12px;
      color: var(--color-fg);
      border: 1px solid var(--color-fg);
      border-radius: 4px;
      cursor: pointer;
      background-color: transparent;
    }

    .secondary-button:hover {
      background-color: var(--color-secondary-hover);
    }

    .example-buttons {
      display: flex;
      gap: 8px;
      flex-direction: column;
      margin-bottom: 20px;
    }

    .label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
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
    }

    .response {
      margin-bottom: 10px;
      padding: 0 12px;
      background-color: var(--color-response-bg);
      border-radius: 4px;
      color: var(--color-fg);
      overflow-y: auto;
      flex-grow: 1;
      line-height: 1.5;
      max-height: 100%;
    }

    hr {
      border: none;
      border-top: 1px solid var(--color-secondary-hover);
      margin: 20px 0;
    }
  `

  constructor() {
    super()
    this.initData()
  }

  async initData() {
    const storedData = await browser.storage.local.get(
      LocalStorageKeys.LAST_QUESTION_ANSWER
    )
    if (storedData.last_question_answer) {
      this.response = storedData.last_question_answer
    }
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
    if (message.type !== 'ai_result') return
    const formattedResponse = await marked.parse(message.result)
    this.loading = false
    this.response = formattedResponse
      ? formattedResponse
      : 'No response received. Please try again.'
    browser.storage.local.set({
      [LocalStorageKeys.LAST_QUESTION_ANSWER]: this.response,
    })
  }

  handleInput(event: Event) {
    const input = event.target as HTMLInputElement
    this.prompt = input.value
  }

  handlePromptSubmit(prompt: string) {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, {
          type: 'user_prompt',
          prompt,
        })
      }
    })
  }

  handleSubmit() {
    if (!this.prompt) {
      alert('Please enter a question to submit.')
      return
    }
    this.loading = true
    this.handlePromptSubmit(this.prompt)
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h3 class="title">Ask a question about this page</h3>
          <hr />
          <div class="example-buttons">
            ${this.exampleQuestions.map(
              (question) => html`
                <button
                  class="secondary-button"
                  @click="${() => {
                    this.prompt = question
                    this.handleSubmit()
                  }}"
                >
                  ${question}
                </button>
              `
            )}
          </div>
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

          <hr />
          <input
            class="text-input"
            type="text"
            placeholder="what do you want to know?"
            @input="${this.handleInput}"
            .value="${this.prompt}"
          />
          <button
            @click="${this.handleSubmit}"
            class="primary-button"
            .disabled="${this.loading}"
          >
            ${this.loading ? 'Loading...' : 'Ask'}
          </button>
        </div>
      </div>
    `
  }
}

export default MozQuestionAnswer
