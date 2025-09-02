import { LitElement, html, css } from 'lit'
import {
  getOpenAIChatResponseWithModel,
  OpenAIKeyManager,
} from '../../services/openai'
import { LocalStorageKeys } from '../../../const'
import {
  AIModeChat,
  AIModeMessage,
  AIModePersisteceMode,
  mlBrowserT,
} from '../../../types'

class MozAIMode extends LitElement {
  query: string = ''
  hasOpenAIKey: boolean = false
  aiResponse: string = ''
  showSummarizeButton: boolean = false
  isProcessing: boolean = false
  private keyStatusCleanup?: () => void

  chats: AIModeChat[] = []
  currentChatId: string | null = null
  persistenceMode: AIModePersisteceMode = AIModePersisteceMode.PER_TAB_GROUP
  querySuggestions: Array<{ text: string; type: string }> = []
  showMenu: boolean = false
  currentTabId: number | null = null
  currentGroupId: number | null = null
  currentWindowId: number | null = null
  selectedSuggestionIndex: number = -1
  userHasEditedQuery: boolean = false

  static get properties() {
    return {
      query: { type: String },
      hasOpenAIKey: { type: Boolean },
      aiResponse: { type: String },
      showSummarizeButton: { type: Boolean },
      isProcessing: { type: Boolean },
      chats: { type: Array },
      currentChatId: { type: String },
      persistenceMode: { type: String },
      querySuggestions: { type: Array },
      showMenu: { type: Boolean },
      selectedSuggestionIndex: { type: Number },
      userHasEditedQuery: { type: Boolean },
    }
  }

  constructor() {
    super()
  }

  async connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
    browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
    browser.tabs.onActivated.addListener(this.handleTabChanged)
    browser.tabs.onUpdated.addListener(this.handleTabUpdated)
    this.initializeOpenAIKeyStatus()
    await this.loadChatsAndSettings()
    await this.updateCurrentTabInfo()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.keyStatusCleanup?.()
    browser.tabs.onActivated.removeListener(this.handleTabChanged)
    browser.tabs.onUpdated.removeListener(this.handleTabUpdated)
  }

  async initializeOpenAIKeyStatus() {
    // Set up listener for key status changes
    this.keyStatusCleanup = OpenAIKeyManager.addListener((hasKey) => {
      this.hasOpenAIKey = hasKey
      this.requestUpdate()
    })

    // Get initial key status
    this.hasOpenAIKey = await OpenAIKeyManager.checkOpenAIKey()
    this.requestUpdate()
  }

  async loadChatsAndSettings() {
    try {
      const { ai_mode_chats, ai_mode_persistence_mode } =
        await browser.storage.local.get([
          LocalStorageKeys.AI_MODE_CHATS,
          LocalStorageKeys.AI_MODE_PERSISTENCE_MODE,
        ])

      this.chats = ai_mode_chats || []
      this.persistenceMode =
        ai_mode_persistence_mode || AIModePersisteceMode.PER_TAB_GROUP

      this.requestUpdate()
    } catch (error) {
      console.error('Error loading AI mode data:', error)
    }
  }

  async updateCurrentTabInfo() {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]

      if (activeTab) {
        this.currentTabId = activeTab.id || null
        this.currentWindowId = activeTab.windowId || null
        this.currentGroupId =
          activeTab.groupId !== -1 ? activeTab.groupId : null

        this.generateQuerySuggestions(
          activeTab.title || '',
          activeTab.url || '',
        )
        this.loadRelevantChat()
      }
    } catch (error) {
      console.error('Error getting current tab info:', error)
    }
  }

  detectQueryType(query: string): string {
    const trimmedQuery = query.trim().toLowerCase()

    // Domain detection: single word with TLD
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(trimmedQuery)) {
      return 'navigate'
    }

    // Chat detection: starts with question words
    if (/^(who|what|when|where|why|how)\s/.test(trimmedQuery)) {
      return 'chat'
    }

    // Action detection: starts with "tab" or "find"
    if (trimmedQuery.startsWith('tab') || trimmedQuery.startsWith('find')) {
      return 'action'
    }

    // Default to search
    return 'search'
  }

  getQueryTypeIcon(type: string): string {
    switch (type) {
      case 'navigate':
        return '🌐'
      case 'chat':
        return '💬'
      case 'action':
        return '⚡'
      case 'search':
        return '🔍'
      default:
        return '🔍'
    }
  }

  getQueryTypeLabel(type: string): string {
    switch (type) {
      case 'navigate':
        return 'Navigate'
      case 'chat':
        return 'Ask'
      case 'action':
        return 'Action'
      case 'search':
        return 'Search'
      default:
        return 'Search'
    }
  }

  generateQuerySuggestions(tabTitle: string, currentDomain: string = '') {
    const suggestions = []
    const titleWords = tabTitle
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 3)

    // 2 chat prompts (question format to match detectQueryType)
    const chatPrompts = [
      `What is ${titleWords[0] || 'this page'} about?`,
      `How does ${titleWords[0] || 'this'} work?`,
      `Why is ${titleWords[0] || 'this'} important?`,
      `Where can I learn more about ${titleWords[0] || 'this'}?`,
      `When should I use ${titleWords[0] || 'this'}?`,
      `Who created ${titleWords[0] || 'this'}?`,
      `What are the benefits of ${titleWords[0] || 'this'}?`,
      `How do I get started with ${titleWords[0] || 'this'}?`,
    ]

    // Select 2 random chat prompts
    const shuffledChats = [...chatPrompts].sort(() => Math.random() - 0.5)
    suggestions.push(
      { text: shuffledChats[0], type: 'chat' },
      { text: shuffledChats[1], type: 'chat' },
    )

    // 2 web search queries (keyword format to match detectQueryType)
    if (titleWords.length > 0) {
      const searchQueries = [
        `${titleWords.slice(0, 2).join(' ')} guide`,
        `best ${titleWords[0]} alternatives`,
        `${titleWords[0]} tutorial`,
        `${titleWords[0]} tips tricks`,
        `${titleWords.slice(0, 2).join(' ')} review`,
        `${titleWords[0]} comparison`,
        `${titleWords[0]} vs competitors`,
        `${titleWords[0]} features`,
        `${titleWords[0]} pricing`,
        `${titleWords.slice(0, 2).join(' ')} documentation`,
      ]

      // Select 2 random search queries
      const shuffledSearches = [...searchQueries].sort(
        () => Math.random() - 0.5,
      )
      suggestions.push(
        { text: shuffledSearches[0], type: 'search' },
        { text: shuffledSearches[1], type: 'search' },
      )
    }

    // 1 current tab domain
    if (currentDomain) {
      const domain = currentDomain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
      suggestions.push({
        text: domain,
        type: 'navigate',
      })
    }

    // 2 actions
    suggestions.push({
      text: 'tab next',
      type: 'action',
    })
    if (titleWords.length > 0) {
      suggestions.push({
        text: `find ${titleWords[0]}`,
        type: 'action',
      })
    }

    this.querySuggestions = suggestions
    this.requestUpdate()
  }

  loadRelevantChat() {
    if (!this.currentTabId) return

    let relevantChat: AIModeChat | null = null

    switch (this.persistenceMode) {
      case AIModePersisteceMode.PER_TAB:
        relevantChat =
          this.chats
            .filter((chat) => chat.tabId === this.currentTabId)
            .sort((a, b) => b.timestamp - a.timestamp)[0] || null
        break

      case AIModePersisteceMode.PER_TAB_GROUP:
        if (this.currentGroupId) {
          relevantChat =
            this.chats
              .filter((chat) => chat.groupId === this.currentGroupId)
              .sort((a, b) => b.timestamp - a.timestamp)[0] || null
        } else {
          relevantChat =
            this.chats
              .filter((chat) => chat.tabId === this.currentTabId)
              .sort((a, b) => b.timestamp - a.timestamp)[0] || null
        }
        break

      case AIModePersisteceMode.PER_WINDOW:
        return
    }

    if (relevantChat) {
      this.currentChatId = relevantChat.id
      const lastUserMessage = relevantChat.messages
        ?.filter((m) => m.role === 'user')
        .pop()
      const lastAssistantMessage = relevantChat.messages
        ?.filter((m) => m.role === 'assistant')
        .pop()
      this.query = lastUserMessage?.content || ''
      this.aiResponse = lastAssistantMessage?.content || ''
    } else {
      this.currentChatId = null
      this.query = ''
      this.aiResponse = ''
    }

    this.requestUpdate()
  }

  handleTabChanged = async (activeInfo: any) => {
    await this.updateCurrentTabInfo()
  }

  handleTabUpdated = async (tabId: number, changeInfo: any) => {
    if (tabId === this.currentTabId && changeInfo.title) {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]
      this.generateQuerySuggestions(changeInfo.title, activeTab?.url || '')
    }
  }

  async saveChats() {
    try {
      await browser.storage.local.set({
        [LocalStorageKeys.AI_MODE_CHATS]: this.chats,
      })
    } catch (error) {
      console.error('Error saving chats:', error)
    }
  }

  generateDummyResponse(query: string): string {
    const responses = [
      // Tech/Development
      `Based on your query "${query}", here are some insights: This appears to be related to web development and user experience design. Consider focusing on accessibility and responsive design principles.`,
      `About "${query}": This involves multiple considerations including performance, security, and maintainability. Would you like me to elaborate on any specific aspect?`,
      `Your question about "${query}" touches on important technical concepts. The key is to balance functionality with simplicity while ensuring scalability for future needs.`,

      // Food & Cooking
      `Regarding "${query}": That sounds delicious! For the best results, I'd recommend using fresh, seasonal ingredients. Don't forget to taste as you go and adjust seasoning accordingly.`,
      `About "${query}": This is a fantastic choice! Consider pairing it with complementary flavors and textures. Presentation can make all the difference too - sometimes simple is best.`,
      `Looking at "${query}": Great question! The key to success here is timing and temperature. Make sure to prep all your ingredients beforehand for a smooth cooking experience.`,

      // Sports & Fitness
      `Analyzing "${query}": This is exciting! Proper form and consistency are crucial for success. Start gradually and focus on building good habits rather than pushing too hard too fast.`,
      `Your question about "${query}" is spot-on! Training smart is more important than training hard. Make sure to include rest and recovery in your routine for optimal results.`,
      `Regarding "${query}": That's a great goal to work towards! Focus on the fundamentals first, then build complexity. Remember that progress takes time and patience.`,

      // Shopping & Products
      `About "${query}": Excellent choice to research before buying! I'd recommend comparing features, reading reviews, and considering your long-term needs. Sometimes spending a bit more upfront saves money later.`,
      `Looking into "${query}": Smart shopping approach! Check for seasonal sales, compare prices across retailers, and don't forget to factor in warranty and customer service quality.`,
      `Regarding "${query}": That's worth investigating! Consider the total cost of ownership, including maintenance and accessories. User reviews can provide valuable real-world insights.`,

      // Travel & Places
      `About "${query}": What an exciting destination! I'd suggest checking the best time to visit, local customs, and must-see attractions. Don't over-schedule - leave time for spontaneous discoveries.`,
      `Your question about "${query}" brings back great memories! Research local transportation options, try authentic local cuisine, and consider staying in neighborhoods where locals live for a more genuine experience.`,
      `Regarding "${query}": Perfect choice for exploration! Pack light, learn a few basic phrases in the local language, and be open to unexpected adventures. The best travel stories come from unplanned moments.`,

      // General/Versatile
      `Analyzing "${query}": This is a common challenge many people face. I suggest starting with a minimal approach and iterating based on what works best for your specific situation.`,
      `Your inquiry about "${query}" is very thoughtful! The best approach often involves breaking it down into smaller, manageable steps and celebrating progress along the way.`,
      `About "${query}": This is definitely worth exploring further! Consider multiple perspectives, gather information from reliable sources, and trust your instincts when making decisions.`,
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  async handleNavigate(domain: string) {
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`
      await browser.tabs.create({ url })
    } catch (error) {
      console.error('Error navigating:', error)
      this.aiResponse = `Sorry, couldn't navigate to ${domain}`
    }
  }

  async handleAction(action: string) {
    try {
      if (
        action.toLowerCase().includes('tab next') ||
        action.toLowerCase().includes('tab')
      ) {
        const tabs = await browser.tabs.query({ currentWindow: true })
        const currentIndex = tabs.findIndex(
          (tab) => tab.id === this.currentTabId,
        )
        const nextIndex = (currentIndex + 1) % tabs.length
        await browser.tabs.update(tabs[nextIndex].id!, { active: true })
        this.aiResponse = `Switched to next tab: ${tabs[nextIndex].title || 'Untitled'}`
      } else if (action.toLowerCase().startsWith('find ')) {
        const query = action.slice(5).trim()
        const found = await (
          browser as unknown as mlBrowserT
        ).extensionHub.findInPage(query)
        this.aiResponse = found
          ? `Found "${query}" in page`
          : `"${query}" not found in page`
      } else {
        this.aiResponse = `Action "${action}" is not supported yet`
      }
    } catch (error) {
      console.error('Error performing action:', error)
      this.aiResponse = `Sorry, couldn't perform action: ${action}`
    }
  }

  async handleSearch(query: string) {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      await browser.tabs.create({ url: searchUrl })
      this.aiResponse = `Opened Google search for: ${query}`
    } catch (error) {
      console.error('Error searching:', error)
      this.aiResponse = `Sorry, couldn't search for: ${query}`
    }
  }

  async handleChat(query: string) {
    let response: string
    if (this.hasOpenAIKey) {
      try {
        const openAIResponse = await getOpenAIChatResponseWithModel(
          query,
          'gpt-4o',
        )
        response = openAIResponse.content || this.generateDummyResponse(query)
      } catch (error) {
        console.error('OpenAI error, falling back to dummy response:', error)
        response = this.generateDummyResponse(query)
      }
    } else {
      response = this.generateDummyResponse(query)
    }
    return response
  }

  async handleSubmit() {
    const queryToSubmit = this.query
    if (!queryToSubmit.trim() || !this.currentTabId) return

    this.isProcessing = true
    this.requestUpdate()

    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]

      const detectedType = this.detectQueryType(queryToSubmit)

      // Handle different query types
      if (detectedType === 'navigate') {
        await this.handleNavigate(queryToSubmit.trim())
        this.isProcessing = false
        this.requestUpdate()
        return
      } else if (detectedType === 'action') {
        await this.handleAction(queryToSubmit)
        this.query = ''
        this.aiResponse = ''
        this.userHasEditedQuery = false
        this.isProcessing = false
        this.requestUpdate()
        return
      } else if (
        detectedType === 'search' &&
        !this.aiResponse &&
        !this.currentChatId
      ) {
        await this.handleSearch(queryToSubmit)
        this.isProcessing = false
        this.requestUpdate()
        return
      }

      // Handle chat (including search queries when in chat context)
      // For subsequent messages in existing chat, use canned responses only
      let response: string
      if (this.aiResponse || this.currentChatId) {
        response = this.generateDummyResponse(queryToSubmit)
      } else {
        response = await this.handleChat(queryToSubmit)
      }

      const now = Date.now()
      const userMessage: AIModeMessage = {
        role: 'user',
        content: queryToSubmit,
        timestamp: now,
      }
      const assistantMessage: AIModeMessage = {
        role: 'assistant',
        content: response,
        timestamp: now + 1,
      }

      if (this.currentChatId) {
        // Append to existing chat
        const existingChat = this.chats.find((c) => c.id === this.currentChatId)
        if (existingChat) {
          existingChat.messages.push(userMessage, assistantMessage)
          existingChat.timestamp = now
        }
      } else {
        // Create new chat
        const newChat: AIModeChat = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          messages: [userMessage, assistantMessage],
          timestamp: now,
          tabId: this.currentTabId,
          groupId: this.currentGroupId || undefined,
          windowId: this.currentWindowId!,
          tabTitle: activeTab?.title,
          tabUrl: activeTab?.url,
        }

        this.chats.unshift(newChat)
        this.currentChatId = newChat.id
      }

      this.aiResponse = response
      await this.saveChats()
    } catch (error) {
      console.error('Error handling submit:', error)
      this.aiResponse = 'Sorry, I encountered an error processing your query.'
    }

    this.query = ''
    this.userHasEditedQuery = false
    this.isProcessing = false
    this.requestUpdate()
  }

  handleIncomingMessage = async (message: any) => {
    if (message.type === 'aimode_search_action') {
      if (!message.data.action) {
        // Ping message - respond with ready signal
        browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
        return
      }

      this.query = message.data.query || ''
      if (message.data.aiResponse) {
        this.aiResponse = message.data.aiResponse
        this.showSummarizeButton = true
        this.requestUpdate()
      }
    }
  }

  async handleSummarizePage() {
    if (!this.hasOpenAIKey) return

    this.isProcessing = true
    this.requestUpdate()

    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        throw new Error('No active tab found')
      }

      const results = await browser.tabs.executeScript(activeTab.id, {
        code: `
          document.body.innerText || document.body.textContent || '';
        `,
      })

      const pageContent = results[0] || ''

      const prompt = `Please provide a concise summary of the following web page content in 2-3 paragraphs:

${pageContent.slice(0, 4000)}`

      const response = await getOpenAIChatResponseWithModel(prompt, 'gpt-4o')

      if (response.content) {
        this.aiResponse = response.content
      } else {
        this.aiResponse = 'Sorry, I encountered an error summarizing this page.'
      }
    } catch (error) {
      console.error('Error summarizing page:', error)
      this.aiResponse = 'Sorry, I encountered an error summarizing this page.'
    }

    this.isProcessing = false
    this.requestUpdate()
  }

  renderConversation() {
    if (this.isProcessing && !this.aiResponse) {
      return html`
        <div class="ai-response-section">
          <div class="ai-loading">
            <span class="loading-spinner">⟳</span>
            Processing...
          </div>
        </div>
      `
    }

    if (!this.currentChatId || !this.aiResponse) {
      return html``
    }

    const currentChat = this.chats.find((c) => c.id === this.currentChatId)
    if (!currentChat) {
      return html``
    }

    const messages: AIModeMessage[] = currentChat.messages || []

    return html`
      <div class="ai-response-section">
        <div class="conversation">
          ${messages.map(
            (message) => html`
              <div class="message ${message.role}">
                <div class="message-header">
                  <span class="message-icon">
                    ${message.role === 'user' ? '👤' : '🤖'}
                  </span>
                  <span class="message-role">
                    ${message.role === 'user' ? 'You' : 'Mina'}
                  </span>
                </div>
                <div class="message-content">${message.content}</div>
              </div>
            `,
          )}
        </div>
      </div>
    `
  }

  handleKeyDown(e: KeyboardEvent) {
    const suggestionsVisible =
      this.querySuggestions.length > 0 &&
      !this.aiResponse &&
      !this.currentChatId

    if (!suggestionsVisible) {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.handleSubmit()
      }
      return
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        this.handleSubmit()
        break

      case 'ArrowDown':
        e.preventDefault()
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.querySuggestions.length - 1,
        )
        if (this.selectedSuggestionIndex >= 0) {
          const suggestion = this.querySuggestions[this.selectedSuggestionIndex]
          this.query = suggestion.text
        }
        this.requestUpdate()
        break

      case 'ArrowUp':
        e.preventDefault()
        this.selectedSuggestionIndex = Math.max(
          this.selectedSuggestionIndex - 1,
          -1,
        )
        if (this.selectedSuggestionIndex >= 0) {
          const suggestion = this.querySuggestions[this.selectedSuggestionIndex]
          this.query = suggestion.text
        } else {
          this.query = ''
          this.userHasEditedQuery = false
        }
        this.requestUpdate()
        break

      case 'Escape':
        this.selectedSuggestionIndex = -1
        this.query = ''
        this.userHasEditedQuery = false
        this.requestUpdate()
        break
    }
  }

  handleSuggestionHover(index: number) {
    this.selectedSuggestionIndex = index

    // Only change query if user hasn't manually edited it
    if (!this.userHasEditedQuery) {
      const suggestion = this.querySuggestions[index]
      this.query = suggestion.text
    }

    this.requestUpdate()

    // Focus the input box
    const textarea = this.shadowRoot?.querySelector(
      '.query-input',
    ) as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
    }
  }

  handleSuggestionClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    this.handleSubmit()
  }

  handleNewChatClick() {
    this.currentChatId = null
    this.query = ''
    this.aiResponse = ''
    this.showSummarizeButton = false
    this.selectedSuggestionIndex = -1
    this.userHasEditedQuery = false
    this.requestUpdate()
  }

  handleCloseClick() {
    browser.runtime.sendMessage({
      type: 'pages_open',
      data: { page: 'aiModePage.html' },
    })
    browser.sidebarAction.close()
  }

  handleMenuClick() {
    this.showMenu = !this.showMenu
    this.requestUpdate()
  }

  async handlePersistenceModeChange(mode: AIModePersisteceMode) {
    this.persistenceMode = mode
    await browser.storage.local.set({
      [LocalStorageKeys.AI_MODE_PERSISTENCE_MODE]: mode,
    })
    this.loadRelevantChat()
    this.showMenu = false
    this.requestUpdate()
  }

  handleSelectChat(chatId: string) {
    const chat = this.chats.find((c) => c.id === chatId)
    if (chat) {
      this.currentChatId = chatId
      const lastUserMessage = chat.messages
        ?.filter((m) => m.role === 'user')
        .pop()
      const lastAssistantMessage = chat.messages
        ?.filter((m) => m.role === 'assistant')
        .pop()
      this.query = lastUserMessage?.content || ''
      this.aiResponse = lastAssistantMessage?.content || ''
      this.showMenu = false
      this.requestUpdate()
    }
  }

  async handleClearChat(chatId: string) {
    this.chats = this.chats.filter((c) => c.id !== chatId)
    if (this.currentChatId === chatId) {
      this.currentChatId = null
      this.query = ''
      this.aiResponse = ''
    }
    await this.saveChats()
    this.requestUpdate()
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="menu-container">
              <button class="header-button" @click=${this.handleMenuClick}>
                <slot name="menu-icon">Menu</slot>
              </button>
              ${this.showMenu
                ? html`
                    <div class="menu-dropdown">
                      <div class="menu-section">
                        <div class="menu-section-title">Persistence Mode</div>
                        <button
                          class="menu-item ${this.persistenceMode ===
                          AIModePersisteceMode.PER_TAB_GROUP
                            ? 'active'
                            : ''}"
                          @click="${() =>
                            this.handlePersistenceModeChange(
                              AIModePersisteceMode.PER_TAB_GROUP,
                            )}"
                        >
                          <span class="menu-icon">⧉</span>
                          Per Tab Group
                        </button>
                        <button
                          class="menu-item ${this.persistenceMode ===
                          AIModePersisteceMode.PER_TAB
                            ? 'active'
                            : ''}"
                          @click="${() =>
                            this.handlePersistenceModeChange(
                              AIModePersisteceMode.PER_TAB,
                            )}"
                        >
                          <span class="menu-icon">⬜</span>
                          Per Tab
                        </button>
                        <button
                          class="menu-item ${this.persistenceMode ===
                          AIModePersisteceMode.PER_WINDOW
                            ? 'active'
                            : ''}"
                          @click="${() =>
                            this.handlePersistenceModeChange(
                              AIModePersisteceMode.PER_WINDOW,
                            )}"
                        >
                          <span class="menu-icon">⬛</span>
                          Per Window
                        </button>
                      </div>
                      ${this.chats.length > 0
                        ? html`
                            <div class="menu-section">
                              <div class="menu-section-title">Recent Chats</div>
                              <div class="chat-list">
                                ${this.chats.slice(0, 10).map(
                                  (chat) => html`
                                    <div
                                      class="chat-item ${chat.id ===
                                      this.currentChatId
                                        ? 'active'
                                        : ''}"
                                    >
                                      <button
                                        class="chat-select"
                                        @click="${() =>
                                          this.handleSelectChat(chat.id)}"
                                      >
                                        <div class="chat-preview">
                                          <div class="chat-query">
                                            ${(() => {
                                              const lastUserMsg = chat.messages
                                                ?.filter(
                                                  (m) => m.role === 'user',
                                                )
                                                .pop()
                                              const preview =
                                                lastUserMsg?.content || ''
                                              return (
                                                preview.slice(0, 50) +
                                                (preview.length > 50
                                                  ? '...'
                                                  : '')
                                              )
                                            })()}
                                          </div>
                                          <div class="chat-meta">
                                            <span class="chat-date"
                                              >${new Date(
                                                chat.timestamp,
                                              ).toLocaleDateString()}</span
                                            >
                                            ${chat.tabTitle
                                              ? html`<span class="chat-tab"
                                                  >${chat.tabTitle.slice(
                                                    0,
                                                    20,
                                                  )}${chat.tabTitle.length > 20
                                                    ? '...'
                                                    : ''}</span
                                                >`
                                              : ''}
                                          </div>
                                        </div>
                                      </button>
                                      <button
                                        class="chat-delete"
                                        @click="${() =>
                                          this.handleClearChat(chat.id)}"
                                        title="Delete chat"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  `,
                                )}
                              </div>
                            </div>
                          `
                        : ''}
                    </div>
                  `
                : ''}
            </div>

            <img
              src="../assets/ai-mode-logo.png"
              alt="AI Mode Logo"
              data-fa-i2svg="disabled"
              height="32"
            />
            <div class="header-buttons">
              <button
                class="header-button"
                @click=${this.handleNewChatClick}
                title="New Chat"
              >
                <slot name="new-chat-icon">+</slot>
              </button>
              <button class="header-button" @click=${this.handleCloseClick}>
                <slot name="expand-icon">Expand</slot>
              </button>
            </div>
          </div>

          <div class="content">
            <!-- OPENAI KEY WARNING -->
            ${!this.hasOpenAIKey
              ? html`
                  <div class="openai-warning">
                    <span class="warning-icon">⚠️</span>
                    OpenAI API key required for actual AI responses (dummy
                    responses without). Add key in Extension Hub settings.
                  </div>
                `
              : ''}

            <!-- AI RESPONSE SECTION -->
            ${this.renderConversation()}

            <!-- QUERY SUGGESTIONS -->
            ${this.querySuggestions.length > 0 &&
            !this.aiResponse &&
            !this.currentChatId
              ? html`
                  <div class="query-suggestions">
                    <div class="suggestions-header">Suggest:</div>
                    <div class="suggestions-list">
                      ${this.querySuggestions.map(
                        (suggestion, index) => html`
                          <button
                            class="suggestion-button ${suggestion.type} ${this
                              .selectedSuggestionIndex === index
                              ? 'selected'
                              : ''}"
                            @click="${(e: MouseEvent) =>
                              this.handleSuggestionClick(e)}"
                            @mouseenter="${() =>
                              this.handleSuggestionHover(index)}"
                          >
                            <span class="suggestion-icon"
                              >${this.getQueryTypeIcon(suggestion.type)}</span
                            >
                            <span class="suggestion-text"
                              >${suggestion.text}</span
                            >
                          </button>
                        `,
                      )}
                    </div>
                  </div>
                `
              : ''}

            <textarea
              .value="${this.query}"
              @input="${(e: Event) => {
                this.query = (e.target as HTMLTextAreaElement).value
                this.selectedSuggestionIndex = -1
                // Reset userHasEditedQuery if query becomes empty
                if (!this.query.trim()) {
                  this.userHasEditedQuery = false
                } else {
                  this.userHasEditedQuery = true
                }
              }}"
              @keydown="${this.handleKeyDown}"
              class="query-input"
              placeholder="${this.aiResponse || this.currentChatId
                ? 'Continue the conversation…'
                : 'Ask, search, or type a URL…'}"
            ></textarea>

            <div class="button-row">
              <button
                class="primary-button"
                @click="${this.handleSubmit}"
                ?disabled="${this.isProcessing || !this.query.trim()}"
              >
                ${this.aiResponse || this.currentChatId
                  ? '💬 Ask'
                  : `${this.getQueryTypeIcon(this.detectQueryType(this.query))} ${this.getQueryTypeLabel(this.detectQueryType(this.query))}`}
              </button>
              ${this.showSummarizeButton
                ? html`
                    <button
                      class="primary-button"
                      @click="${this.handleSummarizePage}"
                      ?disabled="${!this.hasOpenAIKey || this.isProcessing}"
                    >
                      <span class="summarize-icon">📄</span>
                      Summarize Page
                    </button>
                  `
                : ''}
            </div>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        /* Primary colors */
        --color-backdrop: #ffa2f7;
        --color-background: #fff;
        --color-text: #000;
        --header-background: #f7ecf8;

        /* Gradient colors */
        --color-gradient-start: #efe2f2;
        --color-gradient-end: #fbecf2;

        /* Border colors */
        --color-border-light: rgba(21, 20, 26, 0.1);

        /* Shadow colors */
        --color-shadow-dark: rgba(0, 0, 0, 0.15);
        --color-shadow-darker: rgba(0, 0, 0, 0.35);

        /* button colors */
        --color-button-bg: #dcbde6;
        --color-button-bg-hover: #d8b5e1;
        --color-button-text: #343434;

        --color-button-clear-bg-hover: #e3e3e3;
        --color-button-clear-bg: transparent;
        --color-button-clear-text: #000000;

        font-family: Arial, sans-serif;
        background-color: var(--color-background);
        color: var(--color-text);
      }

      .wrapper {
        display: block;
        padding: 10px;
        color: var(--color-text);
        background-color: var(--color-backdrop);
        user-select: text !important;
        -moz-user-select: text !important;
      }

      .container {
        box-shadow:
          0 0 20px var(--color-shadow-dark),
          0 25px 30px var(--color-shadow-darker);
        height: calc(100vh - 100px);
        max-height: calc(100vh - 100px);
        display: flex;
        flex-direction: column;
        border-radius: 8px;
        font-size: 14px;
        background: linear-gradient(
          to bottom right,
          var(--color-gradient-start),
          var(--color-gradient-end)
        );
      }

      .header {
        display: flex;
        align-items: center;
        padding: 10px;
        justify-content: space-between;
        border-bottom: 1px solid var(--color-border-light);
        background-color: var(--header-background);
        border-top-right-radius: 8px;
        border-top-left-radius: 8px;
      }

      .header-buttons {
        display: flex;
        gap: 4px;
      }

      .header-button {
        padding: 6px 12px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 16px;
      }

      .header-button:hover {
        background-color: var(--color-border-light);
        border-radius: 4px;
      }

      .content {
        display: flex;
        flex-direction: column;
        padding: 10px;
      }

      .query-input {
        flex: 1;
        resize: none;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-input-bg);
        color: var(--color-fg);
        margin: 12px 0;
      }

      /**
      * Buttons
      */
      .clear-button {
        border: none;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        background-color: var(--color-button-clear-bg);
        color: var(--color-button-clear-text);
        padding: 8px 12px;
      }

      .clear-button:hover {
        background-color: var(--color-button-clear-bg-hover);
      }

      .primary-button {
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
        border: none;
        padding: 14px 18px;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s ease;
      }

      .primary-button:hover {
        background-color: var(--color-button-bg-hover);
      }

      .primary-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .button-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .openai-warning {
        background-color: #fff3cd;
        color: #856404;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        border: 1px solid #ffeaa7;
      }

      .ai-response-section {
        margin-bottom: 12px;
      }

      .ai-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        background-color: var(--color-background);
        border-radius: 4px;
        font-size: 12px;
      }

      .ai-response {
        background-color: var(--color-background);
        border-radius: 4px;
        border: 1px solid var(--color-border-light);
      }

      .ai-response-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background-color: var(--header-background);
        border-bottom: 1px solid var(--color-border-light);
        font-size: 12px;
        font-weight: bold;
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
      }

      .ai-response-content {
        padding: 12px;
        font-size: 12px;
        line-height: 1.4;
      }

      /* Conversation Styles */
      .conversation {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
      }

      .message {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .message.user {
        align-items: flex-end;
      }

      .message.assistant {
        align-items: flex-start;
      }

      .message-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: bold;
        opacity: 0.8;
      }

      .message-icon {
        font-size: 14px;
      }

      .message-content {
        background-color: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        line-height: 1.4;
        max-width: 85%;
        word-wrap: break-word;
      }

      .message.user .message-content {
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
        border-radius: 12px 4px 12px 12px;
      }

      .message.assistant .message-content {
        background-color: var(--color-background);
        border-radius: 4px 12px 12px 12px;
      }

      /* Query Suggestions */
      .query-suggestions {
        margin-bottom: 12px;
        padding: 8px;
        background-color: var(--color-background);
        border-radius: 4px;
        border: 1px solid var(--color-border-light);
      }

      .suggestions-header {
        font-size: 11px;
        font-weight: bold;
        margin-bottom: 6px;
        color: var(--color-text);
        opacity: 0.8;
      }

      .suggestions-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .suggestion-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 12px;
        background-color: var(--color-button-clear-bg);
        color: var(--color-button-clear-text);
        border: 1px solid var(--color-border-light);
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        text-align: left;
        width: 100%;
      }

      .suggestion-button:hover,
      .suggestion-button.selected {
        background-color: var(--color-button-clear-bg-hover);
      }

      .suggestion-icon {
        font-size: 14px;
        width: 16px;
        text-align: center;
        flex-shrink: 0;
      }

      .suggestion-text {
        flex: 1;
        font-size: 11px;
      }

      .suggestion-button.search {
        border-left: 3px solid #4285f4;
      }

      .suggestion-button.chat {
        border-left: 3px solid #34a853;
      }

      .suggestion-button.navigate {
        border-left: 3px solid #ea4335;
      }

      .suggestion-button.action {
        border-left: 3px solid #fbbc05;
      }

      /* Menu Dropdown */
      .menu-container {
        position: relative;
      }

      .menu-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        background-color: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: 4px;
        box-shadow: 0 4px 12px var(--color-shadow-dark);
        min-width: 250px;
        max-width: 300px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 1000;
        margin-top: 4px;
      }

      .menu-section {
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border-light);
      }

      .menu-section:last-child {
        border-bottom: none;
      }

      .menu-section-title {
        font-size: 11px;
        font-weight: bold;
        padding: 4px 12px;
        color: var(--color-text);
        opacity: 0.8;
        text-transform: uppercase;
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }

      .menu-item:hover {
        background-color: var(--color-button-clear-bg-hover);
      }

      .menu-item.active {
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
      }

      .menu-icon {
        width: 14px;
        text-align: center;
        font-size: 12px;
      }

      .loading-spinner {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .ai-icon,
      .warning-icon,
      .summarize-icon {
        margin-right: 4px;
      }

      /* Chat List */
      .chat-list {
        max-height: 200px;
        overflow-y: auto;
      }

      .chat-item {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 2px;
        margin: 2px 4px;
      }

      .chat-item.active {
        background-color: var(--color-button-bg);
      }

      .chat-select {
        flex: 1;
        background: none;
        border: none;
        text-align: left;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 2px;
        transition: background-color 0.2s ease;
      }

      .chat-select:hover {
        background-color: var(--color-button-clear-bg-hover);
      }

      .chat-preview {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .chat-query {
        font-size: 11px;
        font-weight: 500;
        color: var(--color-text);
        line-height: 1.2;
      }

      .chat-meta {
        display: flex;
        gap: 8px;
        font-size: 10px;
        opacity: 0.7;
      }

      .chat-date {
        color: var(--color-text);
      }

      .chat-tab {
        color: var(--color-text);
        font-style: italic;
      }

      .chat-delete {
        padding: 4px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        border-radius: 2px;
        transition: all 0.2s ease;
        font-size: 14px;
        font-weight: bold;
      }

      .chat-delete:hover {
        opacity: 1;
        background-color: #ff6b6b;
        color: white;
      }
    `
  }
}

export default MozAIMode
