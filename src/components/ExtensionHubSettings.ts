import { LitElement, html } from 'lit'
import { LocalStorageKeys } from '../../const'
import { EngineMetadataT } from '../../types'

const defaultOpenAiModel = 'gpt-4o'
const defaultTogetherAiModel = 'deepseek-ai/DeepSeek-V3'
class ExtensionHubSettings extends LitElement {
  loading: boolean = false
  openAiApikey: string = ''
  openAiModel: string = defaultOpenAiModel
  togetherAiApiKey: string = ''
  togetherAiModel: string = defaultTogetherAiModel
  source: 'openai' | 'local' = 'openai'
  isLocalAiEnabled: boolean = false
  engineMetadata: EngineMetadataT = {
    taskName: '',
    modelHub: '',
    modelId: '',
  }

  static properties = {
    feature: { type: String },
    openAiApikey: { type: String },
    openAiModel: { type: String },
    togetherAiApikey: { type: String },
    togeatherAiModel: { type: String },
    engineMetadata: { type: Object },
    source: { type: String },
    isLocalAiEnabled: { type: Boolean },
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
    const {
      openai_ai_model,
      openai_api_key,
      engine_metadata,
      togetherai_api_key,
      togetherai_model,
    } = await browser.storage.local.get([
      LocalStorageKeys.OPENAI_API_KEY,
      LocalStorageKeys.OPENAI_AI_MODEL,
      LocalStorageKeys.ENGINE_METADATA,
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
    ])
    this.openAiApikey = openai_api_key || ''
    this.openAiModel = openai_ai_model || defaultOpenAiModel
    this.togetherAiApiKey = togetherai_api_key || ''
    this.togetherAiModel = togetherai_model || defaultTogetherAiModel
    this.engineMetadata = {
      taskName: engine_metadata?.taskName || '',
      modelHub: engine_metadata?.modelHub || '',
      modelId: engine_metadata?.modelId || '',
    }
    this.isLocalAiEnabled = await browser.permissions.contains({
      permissions: ['trialML'],
    })
  }

  handleSourceSelectChange(event: Event) {
    // TODO: Implement logic to handle source selection change
    const select = event.target as HTMLSelectElement
  }

  /**
   * LOCAL AI (ML Engine) SETTINGS
   */

  async handleLocalAiEnabledToggleChange(event: Event) {
    const input = event.target as HTMLInputElement
    this.isLocalAiEnabled = input.checked
    // Request permissions for trialML API
    if (input.checked) {
      // Request permission
      ;(browser.permissions.request as any)({ permissions: ['trialML'] }).then(
        (granted: boolean) => {
          if (!granted) {
            console.warn('Permission trialML not granted')
          }
        }
      )
    } else {
      // Remove permission
      ;(browser.permissions.remove as any)({ permissions: ['trialML'] }).then(
        (removed: boolean) => {
          if (!removed) {
            console.warn('Permission trialML could not be removed')
          }
        }
      )
    }
  }

  handleUpdateEngineMetadata(e: Event, key: keyof EngineMetadataT) {
    const input = e.target as HTMLInputElement
    this.engineMetadata[key] = input.value
    // Update the engine metadata in
    browser.storage.local.set({
      engine_metadata: this.engineMetadata,
    })
  }

  /**
   * OPENAI SETTINGS
   */

  handleOpenAiApiKeyInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ openai_api_key: input.value })
    this.openAiApikey = input.value
  }

  handleOpenAiModelInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ openai_ai_model: input.value })
    this.openAiModel = input.value
  }

  /**
   * TOGETHERAI SETTINGS
   */
  handleTogetherAIApiKeyInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ togetherai_api_key: input.value })
    this.togetherAiApiKey = input.value
  }

  handleTogetherAiModelInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ togetherai_model: input.value })
    this.togetherAiModel = input.value
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
                value="${this.openAiApikey || ''}"
                @input="${this.handleOpenAiApiKeyInput}"
              />
            </div>
            <div>
              <label class="label">AI Model</label>
              <input
                type="text"
                placeholder="Valid OpenAI model name"
                class="text-input"
                value="${this.openAiModel || ''}"
                @input="${this.handleOpenAiModelInput}"
              />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Together AI</h3>
          <div class="fields">
            <div>
              <label class="label">API Key</label>
              <input
                type="password"
                placeholder="Together AI API Key"
                class="text-input"
                value="${this.togetherAiApiKey || ''}"
                @input="${this.handleTogetherAIApiKeyInput}"
              />
            </div>
            <div>
              <label class="label">AI Model</label>
              <input
                type="text"
                placeholder="Valid Together AI model name"
                class="text-input"
                value="${this.togetherAiModel || ''}"
                @input="${this.handleTogetherAiModelInput}"
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
            <div class="switch-container">
              <label class="switch-label">Enable Local AI</label>
              <label class="switch">
                <input
                  type="checkbox"
                  .checked=${this.isLocalAiEnabled}
                  @change=${this.handleLocalAiEnabledToggleChange}
                />
                <span class="slider"></span>
              </label>
            </div>
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
