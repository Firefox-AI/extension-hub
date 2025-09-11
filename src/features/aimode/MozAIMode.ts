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
import { MlEngineService } from '../../services/mlEngine'
import {
  detectQueryType,
  getQueryTypeIcon,
  getQueryTypeLabel,
  generateQuerySuggestions,
  getPersonalizedContext,
} from './utils'

// Default favicon for tabs
const DEFAULT_FAVICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23666" d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7L12 2z"/></svg>'

// IAB Content Categories
const TOPIC_CATEGORIES = {
  travel: 'Travel & Tourism',
  food: 'Food & Cooking',
  technology: 'Technology & Computing',
  sports: 'Sports & Recreation',
  news: 'News & Current Events',
  shopping: 'Shopping & E-commerce',
  entertainment: 'Entertainment & Media',
  health: 'Health & Fitness',
  finance: 'Finance & Business',
  education: 'Education & Learning',
  general: 'General Interest',
}

type TopicClassificationResult = {
  sequence: string
  labels: string[]
  scores: number[]
}

// Personal Insights Database

class MozAIMode extends LitElement {
  // Helper to detect if a tab URL is an about: page
  private isAboutPage(url: string | undefined): boolean {
    if (!url) return true
    return url.startsWith('about:')
  }

  // Helper to open URL, replacing about: pages or creating new tab with grouping
  private async openUrl(url: string): Promise<void> {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    const activeTab = tabs[0]

    if (this.isAboutPage(activeTab?.url) && this.currentTabId) {
      // Replace current about: page
      await browser.tabs.update(this.currentTabId, { url })
    } else {
      // Create new tab and add to group
      const newTab = await browser.tabs.create({ url })
      if (newTab.id) {
        await this.addTabToGroup(newTab.id)
      }
    }
  }
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
  hasMouseMoved: boolean = false
  private skipNextTabUpdate: boolean = false
  currentTopic: string = 'general'
  topicConfidence: number = 0
  isClassifyingTopic: boolean = false
  usePersonalInsights: boolean = false
  showTabsMenu: boolean = false
  isLoadingLiveSuggestions: boolean = false
  private liveSearchDebounceTimer?: number
  selectedTabs: Array<{ id: number; title: string; favicon: string }> = []
  availableTabs: Array<{
    id: number
    title: string
    url: string
    favicon: string
  }> = []
  redirectUrlbarToSidebar: boolean = false

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
      hasMouseMoved: { type: Boolean },
      currentTopic: { type: String },
      topicConfidence: { type: Number },
      isClassifyingTopic: { type: Boolean },
      usePersonalInsights: { type: Boolean },
      showTabsMenu: { type: Boolean },
      isLoadingLiveSuggestions: { type: Boolean },
      selectedTabs: { type: Array },
      availableTabs: { type: Array },
      redirectUrlbarToSidebar: { type: Boolean },
    }
  }

  private mlEngineService: MlEngineService

  constructor() {
    super()
    this.mlEngineService = new MlEngineService({
      modelHub: 'huggingface',
      modelId: 'Xenova/mobilebert-uncased-mnli',
      taskName: 'zero-shot-classification',
    })
  }

  async connectedCallback() {
    super.connectedCallback()
    browser.runtime.onMessage.addListener(this.handleIncomingMessage)
    browser.runtime.sendMessage({ type: 'aimode_sidebar_ready' })
    browser.tabs.onActivated.addListener(this.handleTabChanged)
    browser.tabs.onUpdated.addListener(this.handleTabUpdated)

    // Add listener for focus events from the browser to get URL
    window.addEventListener('focus', this.handleFocus)

    this.initializeOpenAIKeyStatus()
    await this.loadChatsAndSettings()
    await this.updateCurrentTabInfo()
    await this.loadPersonalInsightsPreference()
    await this.loadUrlbarRedirectPreference()
    await this.initializeCurrentTabInSelectedList()

    // Focus the input box by default
    this.focusInputBox()

    // If urlbar redirect is already enabled, activate the AI mode UI
    if (this.redirectUrlbarToSidebar) {
      await (browser as unknown as mlBrowserT).extensionHub.updateUIForAIMode(
        true,
      )
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.keyStatusCleanup?.()
    browser.tabs.onActivated.removeListener(this.handleTabChanged)
    browser.tabs.onUpdated.removeListener(this.handleTabUpdated)
    window.removeEventListener('focus', this.handleFocus)
    if (this.liveSearchDebounceTimer) {
      clearTimeout(this.liveSearchDebounceTimer)
    }
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

        // Skip suggestions and classification if we just opened a new tab
        if (this.skipNextTabUpdate) {
          this.skipNextTabUpdate = false
        } else {
          this.generateQuerySuggestions(
            activeTab.title || '',
            activeTab.url || '',
          )
          this.classifyTopicFromTab(activeTab.title || '', activeTab.url || '')
        }

        this.loadRelevantChat()
        this.classifyTopicFromTab(activeTab.title || '', activeTab.url || '')
      }
    } catch (error) {
      console.error('Error getting current tab info:', error)
    }
  }

  async loadPersonalInsightsPreference() {
    try {
      const { ai_mode_personal_insights } = await browser.storage.local.get([
        'ai_mode_personal_insights',
      ])
      this.usePersonalInsights = ai_mode_personal_insights || false
      this.requestUpdate()
    } catch (error) {
      console.error('Error loading personal insights preference:', error)
    }
  }

  async loadUrlbarRedirectPreference() {
    try {
      const { ai_mode_urlbar_redirect } = await browser.storage.local.get([
        'ai_mode_urlbar_redirect',
      ])
      this.redirectUrlbarToSidebar = ai_mode_urlbar_redirect || false
      this.requestUpdate()
    } catch (error) {
      console.error('Error loading urlbar redirect preference:', error)
    }
  }

  async loadAvailableTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true })
      this.availableTabs = tabs
        .filter(
          (tab) =>
            !this.selectedTabs.some((selected) => selected.id === tab.id),
        )
        .map((tab) => ({
          id: tab.id!,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favicon: tab.favIconUrl || DEFAULT_FAVICON,
        }))
      this.requestUpdate()
    } catch (error) {
      console.error('Error loading available tabs:', error)
    }
  }

  async addTabToGroup(tabId: number) {
    try {
      if (this.currentGroupId && this.currentGroupId !== -1) {
        // Add to existing group
        await (browser as unknown as mlBrowserT).tabs.group({
          tabIds: [tabId],
          groupId: this.currentGroupId,
        })
      } else if (this.currentTabId) {
        // Create new group with current tab and new tab
        const groupId = await (browser as unknown as mlBrowserT).tabs.group({
          tabIds: [this.currentTabId, tabId],
        })
        this.currentGroupId = groupId
      }
    } catch (error) {
      console.error('Error managing tab group:', error)
    }
  }

  async initializeCurrentTabInSelectedList() {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]

      if (activeTab && activeTab.id) {
        const currentTabData = {
          id: activeTab.id,
          title: activeTab.title || 'Untitled',
          favicon: activeTab.favIconUrl || DEFAULT_FAVICON,
        }

        // Initialize with only the current tab as the initial context
        if (!this.selectedTabs.some((tab) => tab.id === activeTab.id)) {
          this.selectedTabs = [currentTabData] // Replace, don't append
        }

        // Load other available tabs (excluding the current one)
        await this.loadAvailableTabs()
      }
    } catch (error) {
      console.error('Error initializing current tab context:', error)
    }
  }

  async classifyTopicFromTab(tabTitle: string, tabUrl: string) {
    if (!tabTitle.trim() && !tabUrl.trim()) return

    try {
      this.isClassifyingTopic = true
      this.requestUpdate()

      // Combine title and domain for classification
      const domain = tabUrl
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
      const content = `${tabTitle} ${domain}`.trim()

      const labels = Object.values(TOPIC_CATEGORIES)
      const classificationResult =
        await this.mlEngineService.getAIResponse<TopicClassificationResult>({
          args: [content.slice(0, 500), labels],
        })

      if (classificationResult && classificationResult.scores.length > 0) {
        const bestLabel = classificationResult.labels[0]
        const bestScore = classificationResult.scores[0]

        const newTopic = Object.keys(TOPIC_CATEGORIES).find(
          (key) =>
            TOPIC_CATEGORIES[key as keyof typeof TOPIC_CATEGORIES] ===
            bestLabel,
        ) as keyof typeof TOPIC_CATEGORIES | undefined

        if (newTopic && bestScore > 0.3) {
          this.currentTopic = newTopic
          this.topicConfidence = bestScore
        } else {
          this.currentTopic = 'general'
          this.topicConfidence = 0
        }

        // Regenerate suggestions with new topic
        this.generateQuerySuggestions(tabTitle, tabUrl)
      }
    } catch (error) {
      console.error('Error classifying topic:', error)
      this.currentTopic = 'general'
      this.topicConfidence = 0
    } finally {
      this.isClassifyingTopic = false
      this.requestUpdate()
    }
  }

  async generateLiveSuggestions(query: string) {
    if (!query.trim()) return

    this.isLoadingLiveSuggestions = true
    this.requestUpdate()

    try {
      const urlbarSuggestions = await (
        browser as unknown as mlBrowserT
      ).extensionHub.getUrlbarSuggestions(query.trim())

      const suggestions = []

      // Get search results from urlbar
      const searchResults = urlbarSuggestions.filter((s) => s.type === 'search')

      if (searchResults.length > 0) {
        // First search result - create both search and chat variants
        const firstResult = searchResults[0]

        // Original as search type with personalization
        suggestions.push({
          text:
            firstResult.text +
            getPersonalizedContext(this.usePersonalInsights, this.currentTopic),
          type: 'search',
        })

        // Same text with "?" as chat type with personalization
        suggestions.push({
          text:
            firstResult.text +
            getPersonalizedContext(
              this.usePersonalInsights,
              this.currentTopic,
            ) +
            '?',
          type: 'chat',
        })

        // Next 4 search results - run through detectQueryType to determine final type
        const remainingResults = searchResults.slice(1, 5)
        for (const result of remainingResults) {
          const detectedType = detectQueryType(result.text)
          const personalizedText =
            detectedType === 'chat' || detectedType === 'search'
              ? result.text +
                getPersonalizedContext(
                  this.usePersonalInsights,
                  this.currentTopic,
                )
              : result.text

          suggestions.push({
            text: personalizedText,
            type: detectedType,
          })
        }
      }

      // Add navigate results as-is (no personalization)
      const navigateResults = urlbarSuggestions.filter(
        (s) => s.type === 'navigate',
      )
      const navigateSuggestions = navigateResults.slice(0, 2).map((s) => ({
        text: s.text,
        type: s.type,
      }))
      suggestions.push(...navigateSuggestions)

      // Add action results as-is (no personalization)
      const actionResults = urlbarSuggestions.filter((s) => s.type === 'action')
      const actionSuggestions = actionResults.slice(0, 2).map((s) => ({
        text: s.text,
        type: s.type,
      }))
      suggestions.push(...actionSuggestions)

      this.querySuggestions = suggestions
    } catch (error) {
      console.error('Error getting live suggestions:', error)
      // Fall back to empty suggestions on error
      this.querySuggestions = []
    } finally {
      this.isLoadingLiveSuggestions = false
      this.requestUpdate()
    }
  }

  // Use imported getPersonalizedContext function
  getPersonalizedContext(): string {
    return getPersonalizedContext(this.usePersonalInsights, this.currentTopic)
  }

  // Use imported generateQuerySuggestions function
  generateQuerySuggestions(tabTitle: string, currentDomain: string = '') {
    const suggestions = generateQuerySuggestions(
      tabTitle,
      currentDomain,
      this.currentTopic,
      this.usePersonalInsights,
    )

    this.querySuggestions = suggestions
    this.hasMouseMoved = false
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
      this.query = ''
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

    // Update selected tabs to reflect the new current tab context
    const newActiveTabId = activeInfo.tabId
    const tabIndex = this.selectedTabs.findIndex(
      (tab) => tab.id === newActiveTabId,
    )

    if (tabIndex > 0) {
      // Move the newly active tab to the front of the selected tabs list
      const activeTab = this.selectedTabs[tabIndex]
      this.selectedTabs.splice(tabIndex, 1)
      this.selectedTabs.unshift(activeTab)
      this.requestUpdate()
    } else if (tabIndex === -1) {
      // If no active chat, replace the current tab context with the new active tab
      // If there is an active chat, keep existing context and just move to front
      try {
        const tab = await browser.tabs.get(newActiveTabId)
        if (tab) {
          const newTabData = {
            id: tab.id!,
            title: tab.title || 'Untitled',
            favicon: tab.favIconUrl || DEFAULT_FAVICON,
          }

          if (!this.currentChatId && !this.aiResponse) {
            // No active chat - replace the current tab context
            // Add the old current tab back to available tabs
            if (this.selectedTabs.length > 0) {
              const oldCurrentTab = this.selectedTabs[0]
              this.availableTabs.push({
                id: oldCurrentTab.id,
                title: oldCurrentTab.title,
                url: '', // We don't have URL stored in selectedTabs
                favicon: oldCurrentTab.favicon,
              })
            }
            this.selectedTabs = [newTabData]
          } else {
            // Active chat exists - add new tab to context
            this.selectedTabs.unshift(newTabData)
          }

          // Remove from available tabs if it was there
          this.availableTabs = this.availableTabs.filter(
            (t) => t.id !== newActiveTabId,
          )
          this.requestUpdate()
        }
      } catch (error) {
        console.error('Error updating current tab context:', error)
      }
    }
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
      this.skipNextTabUpdate = true
      await this.openUrl(url)
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
      } else if (action.toLowerCase().startsWith('find ')) {
        const query = action.slice(5).trim()
        const found = await (
          browser as unknown as mlBrowserT
        ).extensionHub.findInPage(query)
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
      this.skipNextTabUpdate = true
      await this.openUrl(searchUrl)

      this.query = '' // Clear the input box
      this.userHasEditedQuery = false
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

      const detectedType = detectQueryType(queryToSubmit)

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
      this.query = ''

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

  handleFocus = async () => {
    try {
      // Get the last focused URL from the API
      const url = await (
        browser as unknown as mlBrowserT
      ).extensionHub.getLastFocusedUrl()
      if (url && typeof url === 'string') {
        // Reset current conversation when loading URL from urlbar focus
        this.currentChatId = null
        this.aiResponse = ''
        this.showSummarizeButton = false

        // Pre-populate input with URL but keep userHasEditedQuery false
        // so quick prompts still appear
        this.query = url
        this.userHasEditedQuery = false
        this.selectedSuggestionIndex = -1

        // Focus and select the URL text
        this.focusInputBox(true)
        this.requestUpdate()
      }
    } catch (error) {
      console.error('Failed to get last focused URL:', error)
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

  handleContentMouseMove = () => {
    if (!this.hasMouseMoved) {
      this.hasMouseMoved = true
      this.requestUpdate()
    }
  }

  handleContentMouseLeave = () => {
    if (!this.userHasEditedQuery && this.selectedSuggestionIndex >= 0) {
      this.query = ''
      this.selectedSuggestionIndex = -1
      this.requestUpdate()
    }
  }

  focusInputBox(selectAll = false) {
    // Use setTimeout to ensure DOM is ready after component initialization
    setTimeout(() => {
      const textarea = this.shadowRoot?.querySelector(
        '.query-input',
      ) as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
        if (selectAll) {
          // Select all text in the input box
          textarea.select()
        }
      }
    }, 100)
  }

  handleSuggestionHover(index: number) {
    this.selectedSuggestionIndex = index

    // Always fill query on hover - works for both quick prompts and live suggestions
    const suggestion = this.querySuggestions[index]
    this.query = suggestion.text

    this.requestUpdate()

    // Focus the input box
    this.focusInputBox()
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
      this.query = ''
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

  async handlePersonalInsightsToggle() {
    this.usePersonalInsights = !this.usePersonalInsights

    // Save preference
    try {
      await browser.storage.local.set({
        ai_mode_personal_insights: this.usePersonalInsights,
      })
    } catch (error) {
      console.error('Error saving personal insights preference:', error)
    }

    // Regenerate suggestions with new setting - maintain current mode
    if (this.userHasEditedQuery && this.query.trim()) {
      // User was actively typing - regenerate live suggestions
      this.generateLiveSuggestions(this.query)
    } else {
      // Generate quick prompts for empty query
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      const activeTab = tabs[0]
      if (activeTab) {
        this.generateQuerySuggestions(
          activeTab.title || '',
          activeTab.url || '',
        )
      }
    }

    this.requestUpdate()
  }

  async handleUrlbarRedirectToggle() {
    this.redirectUrlbarToSidebar = !this.redirectUrlbarToSidebar

    // Save preference
    try {
      await browser.storage.local.set({
        ai_mode_urlbar_redirect: this.redirectUrlbarToSidebar,
      })
    } catch (error) {
      console.error('Error saving urlbar redirect preference:', error)
    }

    // Update UI for AI mode based on the new state
    await (browser as unknown as mlBrowserT).extensionHub.updateUIForAIMode(
      this.redirectUrlbarToSidebar,
    )

    this.showMenu = false
    this.requestUpdate()
  }

  handleAddTabClick() {
    this.showTabsMenu = !this.showTabsMenu
    if (this.showTabsMenu) {
      this.loadAvailableTabs()
    }
    this.requestUpdate()
  }

  async handleTabSelect(tab: {
    id: number
    title: string
    url: string
    favicon: string
  }) {
    // Add tab to selected list
    this.selectedTabs.push({
      id: tab.id,
      title: tab.title,
      favicon: tab.favicon,
    })

    // Remove from available tabs
    this.availableTabs = this.availableTabs.filter((t) => t.id !== tab.id)

    // Add to current tab group if group exists, or create new group
    await this.addTabToGroup(tab.id)

    // Close the menu
    this.showTabsMenu = false
    this.requestUpdate()
  }

  async handleRemoveTab(tabId: number) {
    // Find the tab being removed
    const removedTab = this.selectedTabs.find((tab) => tab.id === tabId)
    if (!removedTab) return

    // Remove from selected tabs
    this.selectedTabs = this.selectedTabs.filter((tab) => tab.id !== tabId)

    // Add back to available tabs if it's still open
    try {
      const tab = await browser.tabs.get(tabId)
      if (tab) {
        this.availableTabs.push({
          id: tab.id!,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favicon: tab.favIconUrl || DEFAULT_FAVICON,
        })
      }
    } catch (error) {
      // Tab was likely closed, so don't add back to available tabs
    }

    this.requestUpdate()
  }

  async handleSelectedTabClick(tabId: number) {
    try {
      await browser.tabs.update(tabId, { active: true })

      // Move the clicked tab to the front of the selected tabs list (context)
      const clickedTabIndex = this.selectedTabs.findIndex(
        (tab) => tab.id === tabId,
      )
      if (clickedTabIndex > 0) {
        const clickedTab = this.selectedTabs[clickedTabIndex]
        this.selectedTabs.splice(clickedTabIndex, 1)
        this.selectedTabs.unshift(clickedTab)
        this.requestUpdate()
      }
    } catch (error) {
      console.error('Error switching to tab:', error)
    }
  }

  getTopicIcon(topic: string): string {
    const icons: { [key: string]: string } = {
      travel: '✈️',
      food: '🍕',
      technology: '💻',
      sports: '⚽',
      news: '📰',
      shopping: '🛒',
      entertainment: '🎬',
      health: '🏥',
      finance: '💰',
      education: '📚',
      general: '📄',
    }
    return icons[topic] || icons.general
  }

  render() {
    const hasConversation = !!(this.aiResponse || this.currentChatId)
    return html`
      <div
        class="wrapper ${this.redirectUrlbarToSidebar && !hasConversation
          ? 'ai-mode'
          : ''}"
      >
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

                      <div class="menu-section">
                        <div class="menu-section-title">URL Bar</div>
                        <button
                          class="menu-item ${this.redirectUrlbarToSidebar
                            ? 'active'
                            : ''}"
                          @click="${this.handleUrlbarRedirectToggle}"
                        >
                          <span class="menu-icon">🔗</span>
                          Redirect Focus to Sidebar
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

          <div class="content" @mousemove="${this.handleContentMouseMove}">
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
                  <div
                    class="query-suggestions ${this.hasMouseMoved
                      ? 'mouse-moved'
                      : ''}"
                    @mouseleave="${this.handleContentMouseLeave}"
                  >
                    <div class="suggestions-header">
                      <div class="suggestions-header-left">
                        <span
                          >${this.userHasEditedQuery
                            ? 'Suggestions:'
                            : 'Quick Prompts:'}</span
                        >
                        ${this.isLoadingLiveSuggestions
                          ? html`
                              <span class="loading-indicator">
                                <span class="loading-spinner">⟳</span>
                                Loading...
                              </span>
                            `
                          : ''}
                        ${this.currentTopic !== 'general' &&
                        this.topicConfidence > 0
                          ? html`
                              <span class="topic-badge">
                                ${this.getTopicIcon(this.currentTopic)}
                                ${TOPIC_CATEGORIES[
                                  this
                                    .currentTopic as keyof typeof TOPIC_CATEGORIES
                                ]}
                                ${this.isClassifyingTopic
                                  ? html`<span class="classifying">...</span>`
                                  : ''}
                              </span>
                            `
                          : this.isClassifyingTopic
                            ? html`<span class="classifying"
                                >Analyzing topic...</span
                              >`
                            : ''}
                      </div>
                      <div class="personalization-toggle">
                        <label class="toggle-label">
                          <input
                            type="checkbox"
                            ?checked="${this.usePersonalInsights}"
                            @change="${this.handlePersonalInsightsToggle}"
                          />
                          <span class="toggle-text">Personalize</span>
                        </label>
                      </div>
                    </div>
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
                              >${getQueryTypeIcon(suggestion.type)}</span
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

            <!-- TAB SELECTION MENU -->
            ${this.showTabsMenu
              ? html`
                  <div
                    class="tabs-menu-overlay"
                    @click="${() => {
                      this.showTabsMenu = false
                      this.requestUpdate()
                    }}"
                  >
                    <div
                      class="tabs-menu"
                      @click="${(e: Event) => e.stopPropagation()}"
                    >
                      <div class="tabs-menu-header">
                        <span>Recent tabs</span>
                      </div>
                      <div class="tabs-menu-list">
                        ${this.availableTabs.map(
                          (tab) => html`
                            <button
                              class="tab-menu-item"
                              @click="${() => this.handleTabSelect(tab)}"
                            >
                              <img
                                src="${tab.favicon}"
                                alt=""
                                class="tab-favicon"
                                @error="${(e: Event) => {
                                  ;(e.target as HTMLImageElement).src =
                                    DEFAULT_FAVICON
                                }}"
                              />
                              <span class="tab-title">${tab.title}</span>
                            </button>
                          `,
                        )}
                      </div>
                    </div>
                  </div>
                `
              : ''}

            <div class="textarea-container">
              <textarea
                .value="${this.query}"
                @input="${(e: Event) => {
                  this.query = (e.target as HTMLTextAreaElement).value
                  this.selectedSuggestionIndex = -1
                  // Reset userHasEditedQuery if query becomes empty
                  if (!this.query.trim()) {
                    this.userHasEditedQuery = false
                    // Generate quick prompts for empty query
                    const tabs = browser.tabs
                      .query({
                        active: true,
                        currentWindow: true,
                      })
                      .then((tabs) => {
                        const activeTab = tabs[0]
                        if (activeTab) {
                          this.generateQuerySuggestions(
                            activeTab.title || '',
                            activeTab.url || '',
                          )
                        }
                      })
                      .catch((err) =>
                        console.error('Error getting active tab:', err),
                      )
                  } else {
                    this.userHasEditedQuery = true
                    // Debounce live suggestions to avoid too many API calls
                    if (this.liveSearchDebounceTimer) {
                      clearTimeout(this.liveSearchDebounceTimer)
                    }
                    this.liveSearchDebounceTimer = window.setTimeout(() => {
                      this.generateLiveSuggestions(this.query)
                    }, 50)
                  }
                }}"
                @keydown="${this.handleKeyDown}"
                class="query-input"
                placeholder="${this.aiResponse || this.currentChatId
                  ? 'Continue the conversation…'
                  : 'Ask, search, or type a URL…'}"
              ></textarea>

              <!-- BOTTOM TOOLBAR -->
              <div class="bottom-toolbar">
                <!-- ADD TAB BUTTON -->
                <button
                  class="add-tab-button"
                  @click="${this.handleAddTabClick}"
                  title="Add tabs"
                >
                  +
                </button>

                <!-- SELECTED TABS LIST -->
                <div class="selected-tabs-container">
                  ${this.selectedTabs.map(
                    (tab) => html`
                      <button
                        class="selected-tab"
                        @click="${() => this.handleSelectedTabClick(tab.id)}"
                      >
                        <img
                          src="${tab.favicon}"
                          alt=""
                          class="selected-tab-favicon"
                          @error="${(e: Event) => {
                            ;(e.target as HTMLImageElement).src =
                              DEFAULT_FAVICON
                          }}"
                        />
                        <span class="selected-tab-title">${tab.title}</span>
                        <div
                          class="remove-tab"
                          @click="${(e: Event) => {
                            e.stopPropagation()
                            this.handleRemoveTab(tab.id)
                          }}"
                        >
                          ×
                        </div>
                      </button>
                    `,
                  )}
                </div>

                <!-- SUBMIT BUTTON -->
                <button
                  class="submit-button"
                  @click="${this.handleSubmit}"
                  ?disabled="${this.isProcessing || !this.query.trim()}"
                >
                  ${this.aiResponse || this.currentChatId
                    ? '💬 Ask'
                    : `${getQueryTypeIcon(detectQueryType(this.query))} ${getQueryTypeLabel(detectQueryType(this.query))}`}
                </button>
              </div>
            </div>

            ${this.showSummarizeButton
              ? html`
                  <button
                    class="primary-button"
                    @click="${this.handleSummarizePage}"
                    ?disabled="${!this.hasOpenAIKey || this.isProcessing}"
                    style="margin-top: 8px;"
                  >
                    <span class="summarize-icon">📄</span>
                    Summarize Page
                  </button>
                `
              : ''}
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

      .query-suggestions:not(.mouse-moved) {
        pointer-events: none;
      }

      .suggestions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        font-weight: bold;
        margin-bottom: 6px;
        color: var(--color-text);
        opacity: 0.8;
      }

      .suggestions-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .topic-badge {
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: normal;
      }

      .classifying {
        font-style: italic;
        opacity: 0.7;
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        font-style: italic;
        opacity: 0.8;
        font-size: 10px;
      }

      .personalization-toggle {
        display: flex;
        align-items: center;
      }

      .toggle-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: normal;
        opacity: 0.9;
      }

      .toggle-label input[type='checkbox'] {
        width: 12px;
        height: 12px;
        cursor: pointer;
      }

      .toggle-text {
        user-select: none;
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

      /* Tab Selection Menu */
      .tabs-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.2);
        z-index: 2000;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .tabs-menu {
        position: absolute;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        min-width: 280px;
        max-width: 320px;
        max-height: 300px;
        overflow: hidden;
      }

      .tabs-menu-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border-light);
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text);
        background-color: var(--header-background);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tabs-menu-header::before {
        content: '🗂️';
        font-size: 14px;
      }

      .tabs-menu-list {
        max-height: 250px;
        overflow-y: auto;
        padding: 4px 0;
      }

      .tab-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.2s ease;
        font-size: 12px;
        color: var(--color-text);
      }

      .tab-menu-item:hover {
        background-color: var(--color-button-clear-bg-hover);
      }

      .tab-favicon {
        width: 16px;
        height: 16px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .tab-title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }

      /* Textarea Container */
      .textarea-container {
        position: relative;
        display: flex;
        flex-direction: column;
      }

      .query-input {
        flex: 1;
        resize: none;
        padding: 12px;
        padding-bottom: 50px;
        border: 1px solid var(--color-border-light);
        border-radius: 12px;
        background-color: var(--color-background);
        color: var(--color-text);
        margin: 0;
        min-height: 80px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
      }

      .query-input:focus {
        outline: none;
        border-color: var(--color-button-bg);
        box-shadow: 0 0 0 2px rgba(220, 189, 230, 0.3);
      }

      /* Bottom Toolbar */
      .bottom-toolbar {
        position: absolute;
        bottom: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10;
      }

      /* Add Tab Button */
      .add-tab-button {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background-color: var(--color-button-clear-bg);
        color: var(--color-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .add-tab-button:hover {
        background-color: var(--color-button-clear-bg-hover);
        transform: scale(1.05);
      }

      /* Selected Tabs Container */
      .selected-tabs-container {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        flex: 1;
        scrollbar-width: none;
        -ms-overflow-style: none;
        min-width: 0;
      }

      .selected-tabs-container::-webkit-scrollbar {
        display: none;
      }

      .selected-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px 4px 8px;
        background-color: var(--color-background);
        border: 1px solid var(--color-border-light);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 11px;
        color: var(--color-text);
        white-space: nowrap;
        flex-shrink: 0;
        max-width: 120px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        position: relative;
      }

      .selected-tab:hover {
        background-color: var(--color-button-clear-bg-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      .selected-tab-favicon {
        width: 14px;
        height: 14px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      /* Submit Button */
      .submit-button {
        padding: 8px 12px;
        border-radius: 18px;
        border: none;
        background-color: var(--color-button-bg);
        color: var(--color-button-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .submit-button:hover {
        background-color: var(--color-button-bg-hover);
        transform: scale(1.05);
      }

      .submit-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .selected-tab-title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
        max-width: 55px;
        padding-right: 2px;
      }

      .remove-tab {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        cursor: pointer;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: #666;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .remove-tab:hover {
        background-color: #ff6b6b;
        color: white;
        transform: scale(1.1);
      }

      /* AI Mode Styles */
      .wrapper.ai-mode {
        margin-top: -60px;
        padding-top: 165px;
      }

      .wrapper.ai-mode .textarea-container {
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        z-index: 1000;
      }
    `
  }
}

export default MozAIMode
