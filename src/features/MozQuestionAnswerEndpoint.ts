import { LitElement, html, css } from 'lit'
import { LocalStorageKeys } from '../../const'
import { marked } from 'marked'
import { pageRestrictionService } from '../services/pageRestriction'
import { FeatureViewMixin } from './FeatureViewMixin'
import { FeatureViewStyles } from './FeatureViewStyles'

class MozQuestionAnswerEndpoint extends FeatureViewMixin(LitElement) {
  prompt: string = ''
  loading: boolean = false
  response: string = ''
  queryTimer: number = 0
  intervalId: number = 0
  exampleQuestions = [
    'Can you define all the key words here?',
    'Can you summarize the content?',
  ]

  static properties = {
    prompt: { type: String },
    loading: { type: Boolean },
    response: { type: String },
    queryTimer: { type: Number },
  }

  static styles = [
    FeatureViewStyles,
    css`
      .wrapper {
        display: block;
        padding: 10px;
        color: var(--color-fg);
        background-color: var(--color-bg);
        /* override the sidebar’s default no‐select rules */
        user-select: text !important;
        -moz-user-select: text !important;
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

      .response {
        margin-bottom: 14px;
        padding: 0 12px;
        background-color: var(--color-response-bg);
        border-radius: 4px;
        color: var(--color-fg);
        overflow-y: auto;
        flex-grow: 1;
        line-height: 1.5;
        max-height: 100%;
      }
    `,
  ]

  constructor() {
    super()
    this.initData()
  }

  async initData() {
    const { last_question_answer, last_question_answer_duration } =
      await browser.storage.local.get([
        LocalStorageKeys.LAST_QUESTION_ANSWER,
        LocalStorageKeys.LAST_QUESTION_ANSWER_DURATION,
      ])
    if (last_question_answer) {
      this.response = last_question_answer
    }
    if (last_question_answer_duration) {
      this.queryTimer = last_question_answer_duration
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
    if (message.type !== 'page_qa_result') return
    const formattedResponse = await marked.parse(message.result)
    this.loading = false
    this.response = formattedResponse
      ? formattedResponse
      : 'No response received. Please try again.'
    browser.storage.local.set({
      [LocalStorageKeys.LAST_QUESTION_ANSWER]: this.response,
      [LocalStorageKeys.LAST_QUESTION_ANSWER_DURATION]: this.queryTimer,
    })
    this.setQueryTimer('stop')
  }

  handleInput(event: Event) {
    const input = event.target as HTMLInputElement
    this.prompt = input.value
  }

  async handlePromptSubmit(prompt: string) {
    const safetyCheck = await pageRestrictionService.checkPageRestricted()

    if (safetyCheck.isRestricted) {
      alert(`This page is restricted: ${safetyCheck.reason}`)
      return
    }

    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, {
          type: 'user_prompt_endpoint',
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
    this.setQueryTimer('start')
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
              `,
            )}
          </div>

          ${this.loading
            ? html`<div class="loader">
                <div>Getting your answer...</div>
                <div>${this.millToSeconds(this.queryTimer)}s</div>
              </div>`
            : this.response
              ? html`<div class="response">
                    <p .innerHTML=${this.response}></p>
                  </div>
                  <div>
                    Query Duration: <b></b>${this.millToSeconds(this.queryTimer)}</b> seconds.
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

export default MozQuestionAnswerEndpoint
