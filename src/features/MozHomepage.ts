import { LitElement, html, css } from 'lit'

const TopicData = [
  {
    topic: 'Whistler, BC',
    description: 'Summarise the tabs I have open about Whistler, BC.',
    icon: '✏️',
  },
  {
    topic: 'Local mode',
    description: "Find cool, non-touristy spots near where I'll be.",
    icon: '📍',
  },
  {
    topic: 'Compare tabs',
    description: 'Compare Airbnb listings and give a recommendation.',
    icon: '❓',
  },
  {
    topic: 'Soundtrack my trip',
    description: 'Build me a playlist that fits my destination and vibe.',
    icon: '🎧',
  },
]

class MozHomepage extends LitElement {
  static get properties() {
    return {}
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
  }

  async handleActionClick(topic: {
    topic: string
    description: string
    icon: string
  }) {
    try {
      await browser.runtime.sendMessage({
        type: 'homepage_action_click',
        data: {
          topic: topic.topic,
          description: topic.description,
          icon: topic.icon,
          timestamp: Date.now(),
        },
      })
      console.log('Homepage action clicked:', topic.topic)
    } catch (error) {
      console.error('Error sending homepage action message:', error)
    }
  }

  async handleSearchAction(action: string) {
    try {
      await browser.runtime.sendMessage({
        type: 'homepage_search_action',
        data: {
          action,
          timestamp: Date.now(),
        },
      })
      console.log('Homepage search action:', action)
    } catch (error) {
      console.error('Error sending homepage search message:', error)
    }
  }

  render() {
    return html`
      <div class="homepage-container">
        <div class="browser-frame">
          <div class="header">
            <div class="firefox-logo">
              <div class="logo-icon">🦊</div>
              <div class="logo-text">Firefox</div>
            </div>
          </div>

          <div class="main-content">
            <div class="background-gradient"></div>

            <div class="content-wrapper">
              <div class="smart-actions">
                ${TopicData.map(
                  (topic) => html`
                    <div
                      class="action-card"
                      @click="${() => this.handleActionClick(topic)}"
                    >
                      <div class="action-content">
                        <div class="action-header">
                          <div class="action-icon">${topic.icon}</div>
                          <div class="action-title">${topic.topic}</div>
                        </div>
                        <div class="action-description">
                          ${topic.description}
                        </div>
                      </div>
                    </div>
                  `,
                )}
              </div>

              <div class="search-container">
                <div class="search-bar">
                  <div class="search-input">
                    <div class="search-text">
                      Hi Mina, what do you want to do today?
                    </div>
                  </div>
                  <div class="search-controls">
                    <div
                      class="add-button"
                      @click="${() => this.handleSearchAction('add_files')}"
                    >
                      <span class="plus-icon">+</span>
                      <span class="add-text">Add image, tabs or files</span>
                    </div>
                    <div
                      class="mic-button"
                      @click="${() => this.handleSearchAction('voice_input')}"
                    >
                      🎤
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        height: 100vh;
        font-family:
          'SF Pro',
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
        background: #f9f9fb;
      }

      .homepage-container {
        width: 100%;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f3f3;
      }

      .browser-frame {
        width: 94%;
        height: 94%;
        max-width: 1400px;
        background: #f0f0f4;
        border-radius: 8px;
        box-shadow:
          0 0 20px rgba(0, 0, 0, 0.15),
          0 25px 30px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        position: relative;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 30px;
        background: #2b2b2e;
        backdrop-filter: blur(10px);
      }

      .firefox-logo {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-icon {
        font-size: 32px;
      }

      .logo-text {
        font-size: 18px;
        font-weight: 500;
        color: #ffffff;
      }

      .main-content {
        height: calc(100% - 80px);
        position: relative;
        overflow: hidden;
      }

      .background-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #8341ca 0%, #656fff 100%);
      }

      .content-wrapper {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        gap: 40px;
      }

      .smart-actions {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        width: 100%;
        max-width: 900px;
      }

      .action-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .action-card {
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow:
          0 0.25px 0.75px rgba(0, 0, 0, 0.05),
          0 2px 6px rgba(0, 0, 0, 0.1);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
        cursor: pointer;
      }

      .action-card:hover {
        transform: translateY(-2px);
        box-shadow:
          0 0.5px 1.5px rgba(0, 0, 0, 0.1),
          0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .action-card:active {
        transform: translateY(0px);
      }

      .action-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
      }

      .action-title {
        font-size: 13.5px;
        color: #15141a;
        font-weight: 400;
        margin-bottom: 6px;
      }

      .action-description {
        font-size: 11.5px;
        color: rgba(21, 20, 26, 0.69);
        line-height: 1.3;
      }

      .search-container {
        width: 100%;
        max-width: 900px;
      }

      .search-bar {
        background: #ffffff;
        border-radius: 8px;
        padding: 16px;
        box-shadow:
          0 0.375px 1.5px rgba(0, 0, 0, 0.05),
          0 3px 12px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .search-input {
        padding: 10px;
        border-bottom: 1px solid rgba(21, 20, 26, 0.1);
      }

      .search-text {
        font-size: 15.5px;
        color: rgba(21, 20, 26, 0.69);
      }

      .search-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
      }

      .add-button {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .add-button:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }

      .plus-icon {
        font-size: 16px;
        color: #5b5b66;
      }

      .add-text {
        font-size: 13.5px;
        color: rgba(21, 20, 26, 0.69);
      }

      .mic-button {
        font-size: 16px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }

      .mic-button:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }

      @media (max-width: 1200px) {
        .smart-actions {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 768px) {
        .smart-actions {
          grid-template-columns: 1fr;
        }

        .content-wrapper {
          padding: 20px;
        }
      }
    `
  }
}

export default MozHomepage
