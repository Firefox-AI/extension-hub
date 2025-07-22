import { LitElement, html, css } from 'lit'

export class MozEngineWarning extends LitElement {
  isVisible: boolean = false
  isLocalAiEnabled: boolean = false

  static properties = {
    isVisible: { type: Boolean },
    isLocalAiEnabled: { type: Boolean },
  }

  constructor() {
    super()
  }

  firstUpdated() {
    this.initLocalStorageData()
  }

  async initLocalStorageData() {
    this.isLocalAiEnabled = await browser.permissions.contains({
      permissions: ['trialML'],
    })
    this.isVisible = !this.isLocalAiEnabled
  }

  handleEnable() {
    ;(browser.permissions.request as any)({ permissions: ['trialML'] }).then(
      (granted: boolean) => {
        this.isVisible = !granted
      }
    )
  }

  static styles = css`
    :host {
      --color-bg: #bd2424;
      --color-fg: #ffffff;
    }

    .wrapper {
      background-color: var(--color-bg);
      color: var(--color-fg);
      padding: 10px;
      position: absolute;
      bottom: 0px;
    }

    .button {
      background-color: var(--color-fg);
      color: var(--color-bg);
      border: none;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 4px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
  `

  render() {
    if (!this.isVisible) {
      return html``
    }

    return html`
      <div class="wrapper">
        Warning - Mozilla Engine is not enabled. Click Enable Engine to allow it
        to run.
        <div class="actions">
          <button class="button" @click="${this.handleEnable}">
            Enable Engine
          </button>
        </div>
      </div>
    `
  }
}

customElements.define('moz-engine-warning', MozEngineWarning)
