import { LitElement, html, css } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { mlBrowserT, TabsCollectionT, TabsT } from '../../types'
import {
  PLANNER_PROMPTS,
  PLANNER_TYPES,
  PlanDataT,
  PlanItemT,
  PlanResultT,
  PlannerType,
} from '../services/plan-checklist'
import { MlEngineService } from '../services/mlEngine'

type ClassificationResultT = {
  sequence: string
  labels: string[]
  scores: number[]
}

class MozPlanChecklist extends LitElement {
  tabs: TabsCollectionT | null = null
  plannerType: PlannerType = 'trip'
  selectedTabSet: keyof TabsCollectionT = 'smarter'
  selectedTabs: { [key: string]: boolean } = {}
  customPrompt: string = ''
  planResult: PlanResultT | null = null
  isLoading: boolean = false
  isClassifying: boolean = false
  classificationScore: number = 0

  private mlEngineService: MlEngineService

  static properties = {
    tabs: { type: Object },
    plannerType: { type: String },
    selectedTabSet: { type: String },
    selectedTabs: { type: Object },
    customPrompt: { type: String },
    planResult: { type: Object },
    isLoading: { type: Boolean },
    isClassifying: { type: Boolean },
    classificationScore: { type: Number },
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
    }

    a {
      color: var(--color-link);
    }

    .wrapper {
      display: block;
      color: var(--color-fg);
      background-color: var(--color-bg);
      padding: 10px;
      /* override the sidebar’s default no‐select rules */
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

    .title {
      font-size: 16px;
      font-weight: 300;
      margin-bottom: 0;
    }

    .text-input,
    .text-area {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
      font-family: inherit;
      font-size: 14px;
    }

    .text-area {
      resize: vertical;
      min-height: 60px;
      width: 100%;
      box-sizing: border-box;
    }

    .select {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
      font-size: 14px;
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;

      &:disabled {
        background-color: var(--color-primary-disabled);
        cursor: not-allowed;
      }
    }

    .secondary-button {
      padding: 6px 12px;
      color: var(--color-fg);
      border: 1px solid var(--color-fg);
      border-radius: 4px;
      cursor: pointer;
      background-color: transparent;
      font-size: 12px;
    }

    .secondary-button:hover {
      background-color: var(--color-secondary-hover);
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
      max-height: 100%;
      margin: 10px 0;
    }

    .tabs-section {
      background-color: var(--color-response-bg);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 10px;
      max-height: 150px;
      overflow-y: auto;
    }

    .tab-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .tab-checkbox {
      margin-right: 8px;
    }

    .plan-result {
      display: flex;
      flex-direction: column;
      margin-top: 15px;
    }

    .explanation {
      background-color: var(--color-response-bg);
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 10px;
      line-height: 1.5;
    }

    .checklist {
      background-color: var(--color-response-bg);
      padding: 12px;
      border-radius: 4px;
    }

    .plan-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      flex-grow: 1;
    }

    .plan-item-content {
      display: flex;
      align-items: center;
      width: 100%;
      gap: 8px;
    }

    .search-button {
      padding: 4px 6px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .search-button:hover {
      opacity: 1;
      background-color: var(--color-link);
    }

    .completed {
      text-decoration: line-through;
      color: #999;
    }

    hr {
      border: none;
      border-top: 1px solid var(--color-secondary-hover);
      margin: 15px 0;
    }

    .controls-section {
      margin-bottom: 15px;
      flex-shrink: 0;
    }

    .inline-fields {
      display: flex;
      gap: 12px;
      align-items: end;
    }

    .inline-field {
      flex: 1;
      margin-bottom: 12px;
    }

    .inline-field .label {
      margin-bottom: 4px;
    }

    .inline-field .select {
      margin-bottom: 0;
      width: 100%;
    }
  `

  constructor() {
    super()
    this.mlEngineService = new MlEngineService({
      modelHub: 'huggingface',
      modelId: 'Xenova/mobilebert-uncased-mnli',
      taskName: 'zero-shot-classification',
    })
    this.loadTabs()
    this.setupMessageListener()
  }

  connectedCallback() {
    super.connectedCallback()
    browser.tabs.onActivated.addListener(this.loadTabs)
    browser.tabs.onUpdated.addListener(this.loadTabs)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    browser.tabs.onActivated.removeListener(this.loadTabs)
    browser.tabs.onUpdated.removeListener(this.loadTabs)
  }

  loadTabs = async () => {
    this.tabs = await ((browser as unknown) as mlBrowserT).extensionHub.getTabs()
    this.initializeSelectedTabs()
  }

  initializeSelectedTabs = () => {
    if (!this.tabs) return

    const currentTabSet = this.tabs[this.selectedTabSet]
    const newSelectedTabs: { [key: string]: boolean } = {}

    currentTabSet.forEach((tab, index) => {
      const tabKey = `${this.selectedTabSet}-${index}`
      newSelectedTabs[tabKey] = true // All tabs selected by default
    })

    this.selectedTabs = newSelectedTabs
    this.classifyPlannerType()
  }

  setupMessageListener = () => {
    browser.runtime.onMessage.addListener(message => {
      if (message.type === 'plan_check_result') {
        this.planResult = message.result
        this.isLoading = false
        this.requestUpdate()
      }
    })
  }

  handlePlannerTypeChange = (event: Event) => {
    const select = event.target as HTMLSelectElement
    this.plannerType = select.value as PlannerType
  }

  handleTabSetChange = (event: Event) => {
    const select = event.target as HTMLSelectElement
    this.selectedTabSet = select.value as keyof TabsCollectionT
    this.initializeSelectedTabs()
  }

  handleTabToggle = (tabKey: string) => {
    this.selectedTabs = {
      ...this.selectedTabs,
      [tabKey]: !this.selectedTabs[tabKey],
    }
    this.requestUpdate()
    this.classifyPlannerType()
  }

  getSelectedTabsContent = (): string => {
    if (!this.tabs) return ''

    const currentTabSet = this.tabs[this.selectedTabSet]
    const selectedTabsContent: string[] = []

    currentTabSet.forEach((tab, index) => {
      const tabKey = `${this.selectedTabSet}-${index}`
      if (this.selectedTabs[tabKey]) {
        selectedTabsContent.push(`${tab.title}`)
      }
    })

    return selectedTabsContent.join('\n')
  }

  handleCustomPromptChange = (event: Event) => {
    const textarea = event.target as HTMLTextAreaElement
    this.customPrompt = textarea.value
  }

  classifyPlannerType = async () => {
    if (!this.tabs) return

    const tabsContent = this.getSelectedTabsContent()
    if (!tabsContent.trim()) {
      return
    }

    const labels = Object.values(PLANNER_TYPES)

    try {
      this.isClassifying = true
      const classificationResult = await this.mlEngineService.getAIResponse<
        ClassificationResultT
      >({
        args: [tabsContent.slice(0, 2000), labels],
      })

      if (classificationResult && classificationResult.scores.length > 0) {
        const bestLabel = classificationResult.labels[0]
        const bestScore = classificationResult.scores[0]
        const newPlannerType = Object.keys(PLANNER_TYPES).find(
          key => PLANNER_TYPES[key as PlannerType] === bestLabel,
        ) as PlannerType | undefined

        if (newPlannerType) {
          if (bestScore < 0.25) {
            this.plannerType = 'generic'
          } else {
            this.plannerType = newPlannerType
          }
          this.classificationScore = bestScore
        }
      }
    } catch (err) {
      console.error('Error during planner type classification:', err)
    } finally {
      this.isClassifying = false
    }
  }

  sendPlanRequest = (existingPlan?: PlanResultT) => {
    if (!this.tabs) return

    const tabsContent = this.getSelectedTabsContent()
    if (!tabsContent.trim()) {
      alert('Please select at least one tab to generate a plan.')
      return
    }

    this.isLoading = true
    this.requestUpdate()

    const planData: PlanDataT = {
      plannerType: this.plannerType,
      tabSet: this.selectedTabSet,
      customPrompt: this.customPrompt.trim() || undefined,
    }

    browser.runtime.sendMessage({
      type: 'plan_check_request',
      data: {
        planData,
        tabsContent,
        existingPlan,
      },
    })
  }

  handleGeneratePlan = async () => {
    this.sendPlanRequest()
  }

  handleItemToggle = (itemId: string) => {
    if (!this.planResult) return

    this.planResult.items = this.planResult.items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    )
    this.requestUpdate()
  }

  handleSearch = (searchQuery: string) => {
    const encodedQuery = encodeURIComponent(searchQuery)
    const googleUrl = `https://www.google.com/search?q=${encodedQuery}`
    browser.tabs.create({ url: googleUrl })
  }

  handleUpdateExplanation = async () => {
    if (!this.planResult) return
    this.sendPlanRequest(this.planResult)
  }

  render() {
    const tabSetOptions = this.tabs ? Object.keys(this.tabs) : []
    const currentTabSet = this.tabs?.[this.selectedTabSet] || []

    return html`
      <div class="wrapper">
        <div class="container">
          <div class="controls-section">
            <div class="inline-fields">
              <div class="inline-field">
                <label class="label"
                  >Planner Type:
                  ${this.isClassifying
                    ? html`
                        <i>(…)</i>
                      `
                    : this.classificationScore > 0
                    ? html`
                        <span style="color: #888; font-weight: normal;">
                          (${Math.round(this.classificationScore * 100)}%)
                        </span>
                      `
                    : ''}</label
                >
                <select
                  class="select"
                  @change="${this.handlePlannerTypeChange}"
                  .value="${this.plannerType}"
                  title="${PLANNER_PROMPTS[this.plannerType]}"
                >
                  ${Object.entries(PLANNER_TYPES).map(
                    ([key, value]) =>
                      html`
                        <option value="${key}">${value}</option>
                      `,
                  )}
                </select>
              </div>

              <div class="inline-field">
                <label class="label">Tab Set:</label>
                <select
                  class="select"
                  @change="${this.handleTabSetChange}"
                  .value="${this.selectedTabSet}"
                >
                  ${tabSetOptions.map(
                    option => html`
                      <option
                        value="${option}"
                        ?selected="${option === this.selectedTabSet}"
                      >
                        ${option}
                        (${this.tabs?.[option as keyof TabsCollectionT]
                          ?.length || 0}
                        tabs)
                      </option>
                    `,
                  )}
                </select>
              </div>
            </div>

            ${currentTabSet.length > 0
              ? html`
                  <div class="field">
                    <label class="label">Selected Tabs:</label>
                    <div class="tabs-section">
                      ${currentTabSet.map((tab, index) => {
                        const tabKey = `${this.selectedTabSet}-${index}`
                        return html`
                          <div class="tab-item">
                            <input
                              type="checkbox"
                              class="tab-checkbox"
                              ?checked="${this.selectedTabs[tabKey]}"
                              @change="${() => this.handleTabToggle(tabKey)}"
                            />
                            ${tab.title}
                          </div>
                        `
                      })}
                    </div>
                  </div>
                `
              : ''}

            <div class="field">
              <textarea
                class="text-area"
                placeholder="Custom Instructions (optional): Add any specific requirements or preferences..."
                @input="${this.handleCustomPromptChange}"
                .value="${this.customPrompt}"
              ></textarea>
            </div>

            <button
              class="primary-button"
              @click="${this.handleGeneratePlan}"
              ?disabled="${this.isLoading || !this.tabs}"
            >
              ${this.isLoading ? 'Generating...' : 'Generate New Plan'}
            </button>
          </div>

          ${this.isLoading
            ? html`
                <div class="loader">Loading...</div>
              `
            : ''}
          ${this.planResult
            ? html`
                <div class="plan-result">
                  <div class="explanation">
                    <p>${this.planResult.explanation}</p>
                    <button
                      class="secondary-button"
                      @click="${this.handleUpdateExplanation}"
                      ?disabled="${this.isLoading}"
                    >
                      Update plan with selected tabs
                    </button>
                  </div>

                  <div class="checklist">
                    ${repeat(
                      this.planResult.items,
                      item => item.id,
                      item => html`
                        <div class="plan-item">
                          <div class="plan-item-content">
                            <label class="checkbox-label">
                              <input
                                type="checkbox"
                                ?checked="${item.completed}"
                                @change="${() =>
                                  this.handleItemToggle(item.id)}"
                              />
                              <span class="${item.completed ? 'completed' : ''}"
                                >${item.text}</span
                              >
                            </label>
                            ${!item.completed && item.searchQuery
                              ? html`
                                  <button
                                    class="search-button"
                                    @click="${() =>
                                      this.handleSearch(item.searchQuery!)}"
                                    title="Search: ${item.searchQuery}"
                                  >
                                    🔍
                                  </button>
                                `
                              : ''}
                          </div>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              `
            : ''}
        </div>
      </div>
    `
  }
}

export default MozPlanChecklist
