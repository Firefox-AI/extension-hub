import { LitElement, html } from 'lit'
import { mlBrowserT, TabsCollectionT, TabsT } from '../../types'

class MozTabsDebug extends LitElement {
  tabs: TabsCollectionT | null = null

  static properties = {
    tabs: { type: Object },
  }

  constructor() {
    super()
    this.loadTabs()
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
    this.tabs = await (browser as unknown as mlBrowserT).extensionHub.getTabs()
  }

  createRenderRoot() {
    return this
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="card">
          <h3>Tabs</h3>
          <div class="fields">
            ${this.tabs
              ? Object.entries(this.tabs).map(
                  ([key, tabArray]) => html`
                    <h4>${key}</h4>
                    <ul>
                      ${(tabArray as TabsT).map(
                        (tab) => html`<li>${tab.title}</li>`,
                      )}
                    </ul>
                  `,
                )
              : html`<p>Loading...</p>`}
          </div>
        </div>
      </div>
    `
  }
}

export default MozTabsDebug
