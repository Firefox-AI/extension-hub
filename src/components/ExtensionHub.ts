import { LitElement, html } from 'lit'

type FeatureOption = {
  value: string
  label: string
  component: () => unknown
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    value: 'page_qa',
    label: 'Page Q&A',
    component: () => html`<moz-question-answer></moz-question-answer>`,
  },
  {
    value: 'chat',
    label: 'Chat',
    component: () => html`<moz-chat></moz-chat>`,
  },
  {
    value: 'other_feature',
    label: 'Other Feature',
    component: () => html`<div>Example : Other feature content goes here</div>`,
  },
]

class MozExtensionHub extends LitElement {
  feature: string = FEATURE_OPTIONS[0].value

  static properties = {
    feature: { type: String },
  }

  constructor() {
    super()
  }

  createRenderRoot() {
    return this
  }

  handleSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement
    this.feature = select.value
  }

  handleSettingsClick() {
    browser.runtime.openOptionsPage()
  }

  render() {
    const selected = FEATURE_OPTIONS.find((opt) => opt.value === this.feature)
    return html`
      <div class="wrapper">
        <div class="header">
          <select class="select" @change="${this.handleSelectChange}">
            ${FEATURE_OPTIONS.map(
              (opt) =>
                html`<option
                  value="${opt.value}"
                  ?selected=${this.feature === opt.value}
                >
                  ${opt.label}
                </option>`
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
