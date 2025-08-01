import { LitElement, html, css } from 'lit'
import { marked } from 'marked'

class MozPlanner extends LitElement {
  goal: string = ''
  loading: boolean = false
  plan: string = ''
  planType: string = ''
  conversation: string[] = []
  followupInput: string = ''

  static properties = {
    goal: { type: String },
    loading: { type: Boolean },
    plan: { type: String },
    planType: { type: String },
    conversation: { type: Array },
    followupInput: { type: String }
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

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .primary-button:disabled {
      background-color: var(--color-primary-disabled);
      cursor: not-allowed;
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

    .response {
      background-color: var(--color-response-bg);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      overflow-y: auto;
      flex-grow: 1;
      line-height: 24px;
    }
  `

  constructor() {
    super()
    this.initData()
  }

  async initData() {
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
    if (message.type !== 'planner_result') return
    const formatted = await marked.parse(message.result || '')
    this.loading = false
    this.conversation = [...this.conversation, formatted]

    if (!this.plan) {
      this.plan = formatted
    }
  }

  handleInput(event: Event) {
    const input = event.target as HTMLTextAreaElement
    this.goal = input.value
  }

  handlePlanTypeChange(event: Event) {
    const select = event.target as HTMLSelectElement
    this.planType = select.value
  }


  handlePromptSubmit() {
    if (!this.goal) {
      alert('Please enter your planning goal.')
      return
    }
    this.loading = true
    this.plan = ''
    this.conversation = []
    browser.runtime.sendMessage({
      type: 'planner',
      data: {
        type: this.planType,
        goal: this.goal
      }
    })
  }

  handleFollowupInput(event: Event) {
    const input = event.target as HTMLInputElement
    this.followupInput = input.value
  }

  handleFollowupSubmit() {
    if (!this.followupInput) return
    this.loading = true

    // ⬇️ Show user's message as part of the conversation thread
    this.conversation = [...this.conversation, `<strong>You:</strong> ${this.followupInput}`]

    browser.runtime.sendMessage({
      type: 'planner_followup',
      data: {
        type: this.planType,
        followup: this.followupInput
      }
    })

    this.followupInput = ''
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <h2 class="label">Planning Assistant</h2>
          <h3 class="label">What kind of plan do you want to create based on your browsing history?</h3>

          <label class="label">Select plan type ...</label>
          <select
            class="text-input"
            .value=${this.planType}
            .disabled=${this.loading || this.plan !== ''}
            @change=${this.handlePlanTypeChange}
          >
            <option value="trip">Trip</option>
            <option value="event">Event</option>
            <option value="learning">Learning</option>
            <option value="project">Project</option>
            <option value="generic">Generic</option>
          </select>

          <label class="label">I want to create a plan about ...</label>
          <textarea
            class="text-input"
            rows="3"
            placeholder="e.g. 7-day trip to Tokyo (family of 3 with a 5-year-old boy)"
            .value=${this.goal}
            .disabled=${this.loading || this.plan !== ''}
            @input=${this.handleInput}
          ></textarea>

          ${!this.plan
            ? html`<button
                class="primary-button"
                .disabled=${this.loading}
                @click=${this.handlePromptSubmit}
              >
                ${this.loading ? 'Planning...' : 'Generate Plan'}
              </button>`
            : ''}

          ${this.loading
            ? html`<div class="loader">Working on your plan...</div>`
            : ''}

          ${this.conversation.map(
            response => html`<div class="response"><p .innerHTML=${response}></p></div>`
          )}

          ${this.plan
            ? html`
                <label class="label">Ask a follow-up question</label>
                <input
                  class="text-input"
                  type="text"
                  .value=${this.followupInput}
                  .disabled=${this.loading}
                  @input=${this.handleFollowupInput}
                />
                <button
                  class="primary-button"
                  .disabled=${this.loading}
                  @click=${this.handleFollowupSubmit}
                >
                  ${this.loading ? 'Working...' : 'Send'}
                </button>
              `
            : ''}
        </div>
      </div>
    `
  }
}

export default MozPlanner
