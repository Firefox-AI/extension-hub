import { LitElement, html } from 'lit'
import { LocalStorageKeys } from '../../const'
import { EngineMetadataT } from '../../types'

const defaultOpenAiModel = 'gpt-4o'
class ExtensionHubSettings extends LitElement {
  loading: boolean = false
  apikey: string = ''
  aiModel: string = defaultOpenAiModel
  source: 'openai' | 'local' = 'openai'
  engineMetadata: EngineMetadataT = {
    taskName: '',
    modelHub: '',
    modelId: '',
  }

  static properties = {
    feature: { type: String },
    apikey: { type: String },
    aiModel: { type: String },
    engineMetadata: { type: Object },
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
    console.log('Initializing local storage data...')
    const { openai_ai_model, openai_api_key, engine_metadata } =
      await browser.storage.local.get([
        LocalStorageKeys.OPENAI_API_KEY,
        LocalStorageKeys.OPENAI_AI_MODEL,
        LocalStorageKeys.ENGINE_METADATA,
      ])
    this.apikey = openai_api_key || ''
    this.aiModel = openai_ai_model || defaultOpenAiModel
    this.engineMetadata = {
      taskName: engine_metadata?.taskName || '',
      modelHub: engine_metadata?.modelHub || '',
      modelId: engine_metadata?.modelId || '',
    }
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

  handleUpdateEngineMetadata(e: Event, key: keyof EngineMetadataT) {
    const input = e.target as HTMLInputElement
    this.engineMetadata[key] = input.value
    // Update the engine metadata in
    browser.storage.local.set({
      engine_metadata: this.engineMetadata,
    })
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
              <label class="label">Model Name (ID)</label>
              <input
                @input="${(e: Event) => {
                  this.handleUpdateEngineMetadata(e, 'modelId')
                }}"
                type="text"
                placeholder="Model Name (ID)"
                class="text-input"
                value="${this.engineMetadata.modelId}"
              />
            </div>
            <div>
              <label class="label">Model Task</label>
              <input
                @input="${(e: Event) => {
                  this.handleUpdateEngineMetadata(e, 'taskName')
                }}"
                type="text"
                placeholder="Model Task"
                class="text-input"
                value="${this.engineMetadata.taskName}"
              />
            </div>
            <div>
              <label class="label">Model Hub</label>
              <input
                @input="${(e: Event) => {
                  this.handleUpdateEngineMetadata(e, 'modelHub')
                }}"
                type="text"
                placeholder="Model Hub"
                class="text-input"
                value="${this.engineMetadata.modelHub}"
              />
            </div>
          </div>
        </div>
      </div>
    `
  }
}

export default ExtensionHubSettings
