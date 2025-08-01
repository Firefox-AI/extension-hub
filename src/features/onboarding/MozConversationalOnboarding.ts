import { LitElement, html, css } from 'lit'

type ConversationStep = 
  | 'welcome'
  | 'vibe-check'
  | 'calm-response'
  | 'theme-selection'
  | 'default-browser'
  | 'browser-import'
  | 'importing'
  | 'ai-account'
  | 'ai-response'
  | 'ai-connected'
  | 'complete'

type ThemeOption = {
  id: string
  name: string
  imageUrl: string
  selected?: boolean
}

type BrowserOption = {
  id: string
  name: string
  iconUrl: string
}

class MozConversationalOnboarding extends LitElement {
  currentStep: ConversationStep = 'welcome'
  selectedVibe = ''
  selectedTheme = ''
  selectedBrowser = ''
  showTypewriter = false

  static get properties() {
    return {
      currentStep: { type: String },
      selectedVibe: { type: String },
      selectedTheme: { type: String },
      selectedBrowser: { type: String },
      showTypewriter: { type: Boolean }
    }
  }

  constructor() {
    super()
  }

  themes: ThemeOption[] = [
    {
      id: 'zen',
      name: 'Zen',
      imageUrl: '../assets/onboarding/zen.jpg'
    },
    {
      id: 'forest-fade',
      name: 'Forest Fade',
      imageUrl: '../assets/onboarding/forest.jpg',
      selected: true
    },
    {
      id: 'ocean-glass',
      name: 'Ocean Glass', 
      imageUrl: '../assets/onboarding/ocean.jpg'
    }
  ]

  browsers: BrowserOption[] = [
    {
      id: 'chrome',
      name: 'Chrome',
      iconUrl: '../assets/onboarding/chrome.png'
    },
    {
      id: 'edge', 
      name: 'Edge',
      iconUrl: '../assets/onboarding/edge.png'
    },
    {
      id: 'safari',
      name: 'Safari',
      iconUrl: '../assets/onboarding/safari.png'
    }
  ]

  handleVibeSelection(vibe: string) {
    this.selectedVibe = vibe
    if (vibe === 'Something else...') {
      this.currentStep = 'calm-response'
    } else {
      this.currentStep = 'theme-selection'
    }
  }

  handleThemeSelection(themeId: string) {
    this.selectedTheme = themeId
    this.currentStep = 'default-browser'
  }

  handleDefaultBrowserResponse(response: string) {
    if (response === 'Yes') {
      this.currentStep = 'browser-import'
    } else {
      this.currentStep = 'ai-account'
    }
  }

  handleBrowserSelection(browserId: string) {
    if (browserId === 'skip') {
      this.currentStep = 'ai-account'
    } else {
      this.selectedBrowser = browserId
      this.currentStep = 'importing'
      setTimeout(() => {
        this.currentStep = 'ai-account'
      }, 2000)
    }
  }

  handleAIAccountResponse(response: string) {
    if (response === 'Yes, connect to ChatGPT') {
      this.currentStep = 'ai-response'
      setTimeout(() => {
        this.currentStep = 'ai-connected'
        setTimeout(() => {
          this.currentStep = 'complete'
        }, 1500)
      }, 1000)
    } else {
      this.currentStep = 'complete'
    }
  }

  renderChatBubble(content: string, isUser = false) {
    return html`
      <div class="bubble-wrapper ${isUser ? 'user' : 'assistant'}">
        <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">
          ${content}
        </div>
      </div>
    `
  }

  renderOptionButtons(options: string[], handler: (option: string) => void) {
    return html`
      <div class="option-buttons">
        ${options.map(option => html`
          <button 
            class="option-button ${option === 'Something else...' || option === 'Yes' ? 'outline' : ''}"
            @click="${() => handler(option)}"
          >
            ${option}
          </button>
        `)}
      </div>
    `
  }

  renderThemeCards() {
    return html`
      <div class="theme-selection">
        <div class="theme-cards">
          ${this.themes.map(theme => html`
            <div 
              class="theme-card ${theme.selected ? 'selected' : ''}"
              @click="${() => this.handleThemeSelection(theme.id)}"
            >
              <div class="theme-image" style="background-image: url('${theme.imageUrl}')"></div>
              <div class="theme-name">${theme.name}</div>
            </div>
          `)}
        </div>
        <div class="theme-actions">
          <button class="theme-choose-button" @click="${() => this.handleThemeSelection(this.themes.find(t => t.selected)?.id || 'forest-fade')}">
            Choose this theme
          </button>
          <button class="theme-refresh-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C14.105 3 16.021 3.895 17.436 5.436" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M15 5H18V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `
  }

  renderBrowserButtons() {
    return html`
      <div class="browser-buttons">
        ${this.browsers.map(browser => html`
          <button 
            class="browser-button ${browser.id === 'chrome' ? 'outline' : ''}"
            @click="${() => this.handleBrowserSelection(browser.id)}"
          >
            <img src="${browser.iconUrl}" alt="${browser.name}" class="browser-icon">
            ${browser.name}
          </button>
        `)}
        <button class="browser-button" @click="${() => this.handleBrowserSelection('skip')}">
          Skip
        </button>
      </div>
    `
  }

  render() {
    return html`
      <div class="onboarding-container">
        <div class="chat-content">
          <div class="header-section">
            <h1 class="main-title">
              Great! Let's make Firefox<br>
              <strong>truly yours.</strong>
            </h1>
          </div>

          <div class="conversation-flow">
            ${this.currentStep === 'welcome' ? html`
              ${this.renderChatBubble('Vibe check: how do you want this space to feel?')}
              ${this.renderOptionButtons(['Vibrant', 'Whimsy', 'Cosmic', 'Something else...'], (option) => this.handleVibeSelection(option))}
            ` : ''}

            ${this.selectedVibe && this.currentStep !== 'welcome' ? html`
              ${this.selectedVibe === 'Something else...' ? 
                this.renderChatBubble('Calm and serene, like a breath of fresh air', true) : ''}
            ` : ''}

            ${this.currentStep === 'calm-response' ? html`
              ${this.renderChatBubble('Channeling calm and serene, like a breath of fresh air...')}
            ` : ''}

            ${this.currentStep === 'theme-selection' || (this.selectedVibe && this.currentStep !== 'welcome' && this.currentStep !== 'calm-response') ? html`
              ${this.renderChatBubble('How about one of these?')}
              ${this.renderThemeCards()}
            ` : ''}

            ${this.currentStep === 'default-browser' ? html`
              ${this.renderChatBubble('Looking good 😎 Want to make Firefox your go-to browser?')}
              ${this.renderOptionButtons(['Yes', 'Maybe later'], (option) => this.handleDefaultBrowserResponse(option))}
            ` : ''}

            ${this.currentStep === 'browser-import' ? html`
              ${this.renderChatBubble('Great choice 🙌 I\'ll bring in your settings, passwords, bookmarks, etc. from another browser. Which one?')}
              ${this.renderBrowserButtons()}
            ` : ''}

            ${this.currentStep === 'importing' ? html`
              ${this.renderChatBubble('I\'m on it. Will let you know when everything\'s in!')}
            ` : ''}

            ${this.currentStep === 'ai-account' ? html`
              ${this.renderChatBubble('Looks like you might use Claude and ChatGPT. Connect your accounts?')}
              ${this.renderOptionButtons(['Yes, connect to ChatGPT'], (option) => this.handleAIAccountResponse(option))}
            ` : ''}

            ${this.currentStep === 'ai-response' ? html`
              ${this.renderChatBubble('Yes, connect to ChatGPT', true)}
            ` : ''}

            ${this.currentStep === 'ai-connected' ? html`
              ${this.renderChatBubble('Connected!')}
            ` : ''}

            ${this.currentStep === 'complete' ? html`
              <div class="completion-section">
                <h2 class="completion-title">OK, you're all set for now.</h2>
                <p class="completion-subtitle">Start typing in the search bar or click the chat whenever you need my help.</p>
                <button class="start-browsing-button">Start browsing</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        --color-bg: #202020;
        --color-fg: #ffffff;
        --color-primary: #9666ff;
        --color-bubble-bg: rgba(0,0,0,0.3);
        --color-bubble-user-bg: rgba(255,255,255,0.3);
        --color-card-bg: rgba(255,255,255,0.8);
        --gradient-start: #ff6b35;
        --gradient-end: #9666ff;
      }

      .onboarding-container {
        min-height: 100vh;
        background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
        padding: 60px 20px;
        color: var(--color-fg);
        font-family: 'Inter', sans-serif;
        position: relative;
        overflow-y: auto;
      }

      .chat-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 60px;
      }

      .header-section {
        text-align: center;
        margin-bottom: 100px;
      }

      .main-title {
        font-family: 'Firefox Sharp Sans', sans-serif;
        font-size: 48px;
        font-weight: 500;
        line-height: 1.2;
        margin: 0;
        color: var(--color-fg);
      }

      .main-title strong {
        font-weight: bold;
      }

      .conversation-flow {
        display: flex;
        flex-direction: column;
        gap: 60px;
      }

      .bubble-wrapper {
        display: flex;
        margin-bottom: 20px;
      }

      .bubble-wrapper.user {
        justify-content: flex-end;
      }

      .chat-bubble {
        max-width: 680px;
        padding: 30px;
        border-radius: 16px;
        font-size: 26px;
        font-weight: 500;
        line-height: 1.5;
        letter-spacing: -0.286px;
      }

      .chat-bubble.assistant {
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
      }

      .chat-bubble.user {
        background: var(--color-bubble-user-bg);
        backdrop-filter: blur(10px);
      }

      .option-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .option-button {
        padding: 14px 28px;
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border: none;
        border-radius: 58px;
        color: var(--color-fg);
        font-size: 22px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .option-button.outline {
        border: 1.5px solid var(--color-fg);
      }

      .option-button:hover {
        transform: translateY(-2px);
        background: rgba(0,0,0,0.4);
      }

      .theme-selection {
        display: flex;
        align-items: center;
        gap: 26px;
        margin-top: 20px;
      }

      .theme-cards {
        display: flex;
        gap: 16px;
      }

      .theme-card {
        width: 140px;
        background: var(--color-card-bg);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .theme-card.selected {
        border: 2px solid var(--color-fg);
      }

      .theme-card:hover {
        transform: translateY(-4px);
      }

      .theme-image {
        height: 70px;
        background-size: cover;
        background-position: center;
      }

      .theme-name {
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 500;
        color: #15141a;
        line-height: 1.3;
      }

      .theme-actions {
        display: flex;
        gap: 8px;
      }

      .theme-choose-button {
        padding: 14px 28px;
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border: none;
        border-radius: 58px;
        color: var(--color-fg);
        font-size: 20px;
        font-weight: 600;
        cursor: pointer;
      }

      .theme-refresh-button {
        width: 56px;
        height: 56px;
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border: none;
        border-radius: 58px;
        color: var(--color-fg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .browser-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .browser-button {
        padding: 14px 28px;
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border: none;
        border-radius: 58px;
        color: var(--color-fg);
        font-size: 22px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .browser-button.outline {
        border: 1.5px solid var(--color-fg);
      }

      .browser-icon {
        width: 24px;
        height: 24px;
      }

      .completion-section {
        text-align: center;
        margin-top: 100px;
      }

      .completion-title {
        font-family: 'Firefox Sharp Sans', sans-serif;
        font-size: 48px;
        font-weight: bold;
        margin: 0 0 20px 0;
      }

      .completion-subtitle {
        font-family: 'Firefox Sharp Sans', sans-serif;
        font-size: 38px;
        font-weight: 500;
        line-height: 1.3;
        margin: 0 0 40px 0;
        max-width: 1175px;
        margin-left: auto;
        margin-right: auto;
      }

      .start-browsing-button {
        padding: 17px 43px;
        background: var(--color-primary);
        border: none;
        border-radius: 75px;
        color: var(--color-fg);
        font-size: 26px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .start-browsing-button:hover {
        transform: translateY(-2px);
        background: #8555e6;
      }
    `
  }
}

export default MozConversationalOnboarding
