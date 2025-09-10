import { LitElement, html } from 'lit'
import { LocalStorageKeys } from '../../const'
import './MozEngineDownloadProgress'
import './MozEngineWarning'

type FeatureOption = {
  value:
    | 'ai_mode'
    | 'attribute_comparison'
    | 'chat'
    | 'conversational_onboarding'
    | 'extensionhub_dashboard'
    | 'page_qa'
    | 'page_summarization'
    | 'plan_checklist'
    | 'tab_summarization'
    | 'planner'
    | 'tabs_debug'
  label: string
  component: () => unknown
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    value: 'ai_mode',
    label: 'AI Mode',
    component: () =>
      html`<moz-ai-mode>
        <i class="fa-solid fa-bars" slot="menu-icon"></i>
        <i class="fa-solid fa-pen-to-square" slot="new-chat-icon"></i>
        <i class="fa-solid fa-expand" slot="expand-icon"></i>
      </moz-ai-mode>`,
  },
  {
    value: 'conversational_onboarding',
    label: 'Conversational Onboarding',
    component: () =>
      html`<moz-conversational-onboarding></moz-conversational-onboarding>`,
  },
  {
    value: 'page_qa',
    label: 'Page Q&A',
    component: () => html`<moz-question-answer></moz-question-answer>`,
  },
  {
    value: 'page_summarization',
    label: 'Page Summarization',
    component: () => html`<moz-page-summarization></moz-page-summarization>`,
  },

  {
    value: 'tab_summarization',
    label: 'Tabs Summarization',
    component: () => html`<moz-tabs></moz-tabs>`,
  },
  {
    value: 'chat',
    label: 'Chat',
    component: () => html`<moz-chat></moz-chat>`,
  },
  {
    value: 'planner',
    label: 'Planner History',
    component: () => html`<moz-planner></moz-planner>`,
  },
  {
    value: 'plan_checklist',
    label: 'Planner Checklist',
    component: () => html`<moz-plan-checklist></moz-plan-checklist>`,
  },
  {
    value: 'attribute_comparison',
    label: 'Attribute Comparison',
    component: () =>
      html`<moz-attribute-comparison></moz-attribute-comparison>`,
  },
  {
    value: 'tabs_debug',
    label: 'Tabs Debug',
    component: () => html`<moz-tabs-debug></moz-tabs-debug>`,
  },
  {
    value: 'extensionhub_dashboard',
    label: 'Extension Hub Dashboard',
    component: () => html`<moz-extension-hub-dash></moz-extension-hub-dash>`,
  },
]

class MozExtensionHub extends LitElement {
  feature: string = ''

  static properties = {
    feature: { type: String },
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
    const { current_feature } = await browser.storage.local.get([
      LocalStorageKeys.CURRENT_FEATURE,
    ])
    this.feature = current_feature || FEATURE_OPTIONS[0].value
  }

  async handleSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement
    this.feature = select.value
    await browser.storage.local.set({
      [LocalStorageKeys.CURRENT_FEATURE]: this.feature,
    })
  }

  handleSettingsClick() {
    browser.runtime.openOptionsPage()
  }

  render() {
    const selected = FEATURE_OPTIONS.find((opt) => opt.value === this.feature)
    return html`
      <div class="wrapper">
        <moz-engine-download-progress></moz-engine-download-progress>
        <moz-engine-warning></moz-engine-warning>
        <div class="header">
          <select
            class="select"
            @change="${this.handleSelectChange}"
            value="${this.feature}"
          >
            ${FEATURE_OPTIONS.map(
              (opt) =>
                html`<option
                  value="${opt.value}"
                  ?selected=${this.feature === opt.value}
                >
                  ${opt.label}
                </option>`,
            )}
          </select>
          <button class="settings-button" @click="${this.handleSettingsClick}">
            <i class="fa-solid fa-gear"></i>
          </button>
        </div>

        <div>
          ${selected
            ? selected.component()
            : html`<div class="error">Unknown feature: ${this.feature}</div>`}
        </div>
      </div>
    `
  }
}

export default MozExtensionHub
