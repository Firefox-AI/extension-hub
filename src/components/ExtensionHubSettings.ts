import { LitElement, html } from 'lit'
import { LocalStorageKeys } from '../../const'
import { EngineMetadataT } from '../../types'

const defaultOpenAiModel = 'gpt-4o'
const defaultTogetherAiModel = 'deepseek-ai/DeepSeek-V3'
const huggingFaceProviders = [
  'auto',
  'cerebras',
  'cohere',
  'fal-ai',
  'featherless-ai',
  'fireworks',
  'groq',
  'hr-inference',
  'hyperbolic',
  'nebius',
  'novita',
  'nscale',
  'replicate',
  'sambaNova',
  'together',
]
class ExtensionHubSettings extends LitElement {
  loading: boolean = false
  huggingFaceApiKey: string = ''
  huggingFaceModel: string = ''
  huggingFaceProvider: string = ''
  openAiApikey: string = ''
  openAiModel: string = defaultOpenAiModel
  togetherAiApiKey: string = ''
  togetherAiModel: string = defaultTogetherAiModel
  localModelUrl: string = ''
  localModelName: string = ''
  source: 'openai' | 'local' = 'openai'
  isLocalAiEnabled: boolean = false
  engineMetadata: EngineMetadataT = {
    taskName: '',
    modelHub: '',
    modelId: '',
  }

  static properties = {
    feature: { type: String },
    huggingFaceApiKey: { type: String },
    huggingFaceModel: { type: String },
    huggingFaceProvider: { type: String },
    openAiApikey: { type: String },
    openAiModel: { type: String },
    togetherAiApikey: { type: String },
    togeatherAiModel: { type: String },
    localModelUrl: { type: String },
    localModelName: { type: String },
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
      hugging_face_api_key,
      hugging_face_model,
      hugging_face_provider,
      openai_ai_model,
      openai_api_key,
      engine_metadata,
      togetherai_api_key,
      togetherai_model,
      local_model_url,
      local_model_name,
    } = await browser.storage.local.get([
      LocalStorageKeys.HUGGING_FACE_API_KEY,
      LocalStorageKeys.HUGGING_FACE_MODEL,
      LocalStorageKeys.HUGGING_FACE_PROVIDER,
      LocalStorageKeys.OPENAI_API_KEY,
      LocalStorageKeys.OPENAI_AI_MODEL,
      LocalStorageKeys.ENGINE_METADATA,
      LocalStorageKeys.TOGETHERAI_API_KEY,
      LocalStorageKeys.TOGETHERAI_MODEL,
      LocalStorageKeys.LOCAL_MODEL_URL,
      LocalStorageKeys.LOCAL_MODEL_NAME,
    ])
    this.huggingFaceApiKey = hugging_face_api_key || ''
    this.huggingFaceModel = hugging_face_model || ''
    this.huggingFaceProvider = hugging_face_provider || ''
    this.openAiApikey = openai_api_key || ''
    this.openAiModel = openai_ai_model || defaultOpenAiModel
    this.togetherAiApiKey = togetherai_api_key || ''
    this.togetherAiModel = togetherai_model || defaultTogetherAiModel
    this.localModelUrl = local_model_url || ''
    this.localModelName = local_model_name || ''
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
   * HUGGING FACE SETTINGS
   */

  handleHuggingFaceApiKeyInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ hugging_face_api_key: input.value })
    this.huggingFaceApiKey = input.value
  }

  handleHuggingFaceModelInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ hugging_face_model: input.value })
    this.huggingFaceModel = input.value
  }

  handleHuggingFaceProviderInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ hugging_face_provider: input.value })
    this.huggingFaceProvider = input.value
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

  /**
   * LOCAL MODEL SETTINGS
   */
  handleLocalModelUrlInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ local_model_url: input.value })
    this.localModelUrl = input.value
  }

  handleLocalModelNameInput(event: Event) {
    const input = event.target as HTMLSelectElement
    browser.storage.local.set({ local_model_name: input.value })
    this.localModelName = input.value
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="card">
          <h3>Inference Source</h3>
          <p class="info-base info-primary">
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
          <h3>Hugging Face</h3>
          <div class="fields">
            <div>
              <label class="label">API Key</label>
              <input
                type="password"
                placeholder="Hugging Face API Key"
                class="text-input"
                value="${this.huggingFaceApiKey || ''}"
                @input="${this.handleHuggingFaceApiKeyInput}"
              />
            </div>
            <div class="select-container">
              <label class="label">Hugging Face Provider</label>
              <select
                class="select"
                @change="${this.handleHuggingFaceProviderInput}"
              >
                ${huggingFaceProviders.map(
                  (provider) => html`
                    <option
                      value="${provider}"
                      ?selected=${this.huggingFaceProvider === provider}
                    >
                      ${provider}
                    </option>
                  `
                )}
              </select>
              <p class="info-base info-subtle">
                <i class="fa-solid fa-circle-info"></i>Select "auto" for
                huggingface to select provider for you.
              </p>
            </div>
          </div>
          <div>
            <label class="label">AI Model</label>
            <input
              type="text"
              placeholder="Valid Hugging Face model name"
              class="text-input"
              value="${this.huggingFaceModel || ''}"
              @input="${this.handleHuggingFaceModelInput}"
            />
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
          <p class="info-base info-primary">
            <i class="fa-solid fa-triangle-exclamation"></i
            ><span>
              local models may need additional CORS configuration. If you are
              using Ollama, please refer to the
              <a
                href="https://medium.com/dcoderai/how-to-handle-cors-settings-in-ollama-a-comprehensive-guide-ee2a5a1beef0"
                target="_blank"
                rel="noopener noreferrer"
                >Ollama CORS guide</a
              >.
            </span>
          </p>
          <div class="fields">
            <div>
              <label class="label">URL Endpoint</label>
              <input
                type="text"
                placeholder="Url to your local model endpoint"
                class="text-input"
                value="${this.localModelUrl || ''}"
                @input="${this.handleLocalModelUrlInput}"
              />
            </div>
            <div>
              <label class="label">Model Name</label>
              <input
                type="text"
                placeholder="Name of your local model"
                class="text-input"
                value="${this.localModelName || ''}"
                @input="${this.handleLocalModelNameInput}"
              />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>ML Engine</h3>
          <p class="info-base info-primary">
            <i class="fa-solid fa-wrench"></i>This section is under construction
          </p>
          <div class="fields">
            <div class="switch-container">
              <label class="switch-label">Enable Local Engine AI</label>
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
