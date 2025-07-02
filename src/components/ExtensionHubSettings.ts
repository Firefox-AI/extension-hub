import { LitElement, html } from 'lit'
import { LocalStorageKeys } from '../../const'

const defaultOpenAiModel = 'gpt-4o'
class ExtensionHubSettings extends LitElement {
  loading: boolean = false
  apikey: string = ''
  aiModel: string = defaultOpenAiModel
  source: 'openai' | 'local' = 'openai'

  static properties = {
    feature: { type: String },
    apikey: { type: String },
    aiModel: { type: String },
    source: { type: String },
  }

  constructor() {
    super()
  }

  createRenderRoot() {
    return this
  }

  async firstUpdated() {
    this.initLocalStorageData()
  }

  async initLocalStorageData() {
    const { openai_ai_model, openai_api_key } = await browser.storage.local.get(
      [LocalStorageKeys.OPENAI_API_KEY, LocalStorageKeys.OPENAI_AI_MODEL]
    )
    this.apikey = openai_api_key || ''
    this.aiModel = openai_ai_model || defaultOpenAiModel
  }

  handleApiKeyInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ openai_api_key: input.value })
    this.apikey = input.value
  }

  handleAiModelInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ openai_ai_model: input.value })
    this.aiModel = input.value
  }

  handleSettingsClick() {
    browser.runtime.openOptionsPage()
  }

  handleSourceSelectChange(event: Event) {
    // TODO: Implement logic to handle source selection change
    const select = event.target as HTMLSelectElement
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="card">
          <h3>Inference Source</h3>
          <p class="info">
            <i class="fa-solid fa-wrench"></i>This section is under construction
          </p>
          <div class="fields">
            <div class="select-container">
              <label class="label">Select Source</label>
              <select class="select" @change="${this.handleSourceSelectChange}">
                <option value="openai" ?selected=${this.source === 'openai'}>
                  Open Ai
                </option>
                <option value="local" ?selected=${this.source === 'local'}>
                  Local Model
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Open AI</h3>
          <div class="fields">
            <div>
              <label class="label">API Key</label>
              <input
                type="password"
                placeholder="OpenAI API Key"
                class="text-input"
                value="${this.apikey || ''}"
                @input="${this.handleApiKeyInput}"
              />
            </div>
            <div>
              <label class="label">AI Model</label>
              <input
                type="text"
                placeholder="Valid OpenAI model name"
                class="text-input"
                value="${this.aiModel || ''}"
                @input="${this.handleAiModelInput}"
              />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Local Model</h3>
          <p class="info">
            <i class="fa-solid fa-wrench"></i>This section is under construction
          </p>
          <div class="fields">
            <div>
              <label class="label">Model Name</label>
              <input type="text" placeholder="Model Name" class="text-input" />
            </div>
            <div>
              <label class="label">Model Task</label>
              <input type="text" placeholder="Model Task" class="text-input" />
            </div>
            <div>
              <label class="label">Model Hub</label>
              <input type="text" placeholder="Model Hub" class="text-input" />
            </div>
          </div>
        </div>
      </div>
    `
  }
}

export default ExtensionHubSettings
