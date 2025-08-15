import { LitElement, html, css } from 'lit'
import { mlBrowserT } from '../../types'
import { getOpenAIChatResponseWithModel } from '../services/openai'

type TabItem = {
  id?: number
  title?: string
  url?: string
}

type HistoryItem = {
  id: string
  url?: string
  title?: string
  lastVisitTime?: number
}

type ContextItem = {
  type: 'tab' | 'history' | 'manual'
  title: string
  content: string
  selected?: boolean
}

type SemanticMatch = {
  title: string
  url?: string
  score?: number
  excerpt?: string
  selected?: boolean
}

type SemanticMatches = {
  tabs: SemanticMatch[]
  domainTabs: SemanticMatch[]
  history: SemanticMatch[]
  stories: SemanticMatch[]
  suggestedQueries: SemanticMatch[]
}

class MozSemanticSearch extends LitElement {
  contextItems: ContextItem[] = []
  selectedContext = ''
  manualInput = ''
  loading = true
  semanticMatches: SemanticMatches = {
    tabs: [],
    domainTabs: [],
    history: [],
    stories: [],
    suggestedQueries: [],
  }
  matchesLoading = false
  selectedMatches = {
    tabs: new Set<number>(),
    domainTabs: new Set<number>(),
    history: new Set<number>(),
    stories: new Set<number>(),
    suggestedQueries: new Set<number>(),
  }
  selectAllStates = {
    tabs: false,
    domainTabs: false,
    history: false,
    stories: false,
    suggestedQueries: false,
  }
  openedTabIds = {
    tabs: new Map<number, number>(), // index -> tabId
    domainTabs: new Map<number, number>(),
    history: new Map<number, number>(),
    stories: new Map<number, number>(),
    suggestedQueries: new Map<number, number>(),
  }
  customPrompt = ''
  debounceTimeout: number | null = null
  defaultPrompts = [
    'Make a plan based on these pages',
    'Compare and contrast these pages',
    'Extract key takeaways from these sources',
    'Find common themes across these pages',
    'Identify potential action items from this content',
    'Create a research summary from these sources',
    'Generate questions for deeper investigation',
    'Synthesize insights into a brief report',
  ]
  contextualPrompts: string[] = []
  showingContextualPrompts = false
  generatingPrompts = false

  static get properties() {
    return {
      contextItems: { type: Array },
      selectedContext: { type: String },
      manualInput: { type: String },
      loading: { type: Boolean },
      semanticMatches: { type: Object },
      matchesLoading: { type: Boolean },
      selectedMatches: { type: Object },
      selectAllStates: { type: Object },
      openedTabIds: { type: Object },
      customPrompt: { type: String },
      defaultPrompts: { type: Array },
      contextualPrompts: { type: Array },
      showingContextualPrompts: { type: Boolean },
      generatingPrompts: { type: Boolean },
    }
  }

  constructor() {
    super()
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadContextData()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // Clear debounce timeout on component cleanup
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
  }

  async loadContextData() {
    try {
      const [tabs, history] = await Promise.all([
        this.fetchRecentTabs(),
        this.fetchRecentSearches(),
      ])

      const items: ContextItem[] = []

      for (let i = 0; i < 3; i++) {
        if (tabs[i]) {
          items.push({
            type: 'tab',
            title: tabs[i].title || 'Untitled Tab',
            content: tabs[i].url || '',
          })
        }

        if (history[i] && i < 2) {
          const title = (history[i].title || 'Untitled Search').replace(
            ' - Google Search',
            '',
          )
          items.push({
            type: 'history',
            title,
            content: history[i].url || '',
          })
        }
      }

      items.push({
        type: 'manual',
        title: 'Manual Entry',
        content: '',
      })

      this.contextItems = items
      this.loading = false
    } catch (error) {
      console.error('Failed to load context data:', error)
      this.loading = false
    }
  }

  async fetchRecentTabs(): Promise<TabItem[]> {
    try {
      const tabs = await browser.tabs.query({ url: 'https://*/*' })
      // Sort by lastAccessed to get most recent tabs
      const sortedTabs = tabs
        .filter((tab) => tab.lastAccessed) // Filter out tabs without lastAccessed
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      return sortedTabs.slice(0, 3)
    } catch (error) {
      console.error('Failed to fetch tabs:', error)
      return []
    }
  }

  async fetchRecentSearches(): Promise<HistoryItem[]> {
    try {
      const history = await browser.history.search({
        text: 'google.com/search',
        startTime: 0,
        maxResults: 3,
      })
      return history
    } catch (error) {
      console.error('Failed to fetch history:', error)
      return []
    }
  }

  handleContextSelection(index: number, title: string) {
    this.contextItems = this.contextItems.map((item, i) => ({
      ...item,
      selected: i === index,
    }))

    if (this.contextItems[index].type === 'manual') {
      this.selectedContext = this.manualInput
    } else {
      this.selectedContext = title
    }

    // Reset contextual prompts when context changes
    this.contextualPrompts = []
    this.showingContextualPrompts = false

    // Fetch semantic matches when context is selected
    if (this.selectedContext.trim()) {
      this.fetchSemanticMatches(this.selectedContext)
    }
  }

  handleManualInput(e: Event) {
    this.manualInput = (e.target as HTMLInputElement).value
    const manualIndex = this.contextItems.findIndex(
      (item) => item.type === 'manual',
    )

    if (manualIndex !== -1) {
      // Auto-select manual context when input has value
      if (this.manualInput.trim()) {
        this.handleContextSelection(manualIndex, this.manualInput)
      }

      // Update selected context if already selected
      if (this.contextItems[manualIndex].selected) {
        this.selectedContext = this.manualInput

        // Reset contextual prompts when manual input changes
        this.contextualPrompts = []
        this.showingContextualPrompts = false

        if (this.selectedContext.trim()) {
          this.fetchSemanticMatches(this.selectedContext)
          // Use debounced query generation for manual input
          this.debouncedGenerateSuggestedQueries(this.selectedContext)
        }
      }
    }
  }

  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return ''
    }
  }

  getDomainFromContext(): string {
    const selectedItem = this.contextItems.find((item) => item.selected)
    if (selectedItem?.type === 'tab') {
      return this.extractDomain(selectedItem.content)
    }
    if (selectedItem?.type === 'manual') {
      return this.extractDomain(this.manualInput) || this.manualInput
    }
    return ''
  }

  getAdditionalContextHints(): string {
    // Collect other context items as hints (excluding the selected one and manual if empty)
    const selectedItem = this.contextItems.find((item) => item.selected)
    const otherContextItems = this.contextItems.filter((item) => {
      if (item.selected) return false
      if (item.type === 'manual' && !this.manualInput.trim()) return false
      return true
    })

    let contextHints = `\nCurrent time: ${new Date()}`
    if (otherContextItems.length > 0) {
      const hints = otherContextItems
        .map((item) => {
          if (item.type === 'manual') return this.manualInput
          return item.title
        })
        .join(', ')
      contextHints += `\nAdditional context hints (may be unrelated): ${hints}`
    }

    return contextHints
  }

  async generateSuggestedQueries(context: string): Promise<SemanticMatch[]> {
    try {
      const contextHints = this.getAdditionalContextHints()

      const prompt = `Based on this primary context: "${context}"${contextHints}

Generate 5 diverse search queries that would help explore and research this topic further. These should be different types of queries that provide complementary perspectives:

1. A factual/informational query
2. A how-to/practical query
3. A comparison/analysis query
4. A recent developments/news query
5. A deeper research/academic query

The additional context hints may provide related topics or themes, but focus primarily on the main context. Use the hints only as light inspiration if relevant.

Return only the search queries, one per line, without numbers, quotes or bullets.`

      console.log('suggested queries', prompt)
      const response = await getOpenAIChatResponseWithModel(prompt, 'gpt-4o')
      if (response.content) {
        const queries = response.content
          .split('\n')
          .map((query: string) => query.trim())
          .filter((query: string) => query.length > 0)
          .slice(0, 5)

        return queries.map((query: string) => ({
          title: query,
          url: `https://www.google.com/search?client=firefox-b-1-d&q=${encodeURIComponent(query)}`,
          excerpt: '',
          score: undefined,
        }))
      }

      return []
    } catch (error) {
      console.error('Failed to generate suggested queries:', error)
      return []
    }
  }

  debouncedGenerateSuggestedQueries(searchString: string) {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }

    // Set new timeout for 500ms delay
    this.debounceTimeout = window.setTimeout(() => {
      this.generateSuggestedQueries(searchString).then(async (matches) => {
        this.semanticMatches = {
          ...this.semanticMatches,
          suggestedQueries: matches,
        }
        await this.autoSelectMatches(['suggestedQueries'])
        this.requestUpdate()
      })
    }, 500)
  }

  async generateContextualPrompts(): Promise<string[]> {
    try {
      const selectedUrls = this.getSelectedMatchUrls()
      if (selectedUrls.length === 0) {
        return []
      }

      // Create a description of the workspace items
      const workspaceDescription = this.getWorkspaceDescription()
      const contextHints = this.getAdditionalContextHints()

      const prompt = `Based on the selected context "${this.selectedContext}" and the following workspace items: ${workspaceDescription}\n\n${contextHints}

Generate 5 conversation prompts that would be ideal for a chatbot to help analyze, synthesize, or work with this specific content. These prompts should be:
- Directly relevant to the selected workspace items
- Action-oriented for chatbot interaction
- Different from generic analysis prompts
- Focused on practical insights or next steps

Examples of good chatbot prompts:
- Help me identify the key disagreements between these sources
- What questions should I ask to validate these findings?
- Create a decision matrix based on this information
- Find the gaps in this research and suggest follow-up topics

Return only the 5 prompts, one per line, without numbers, quotes or bullets.`

      console.log('suggested prompts', prompt)
      const response = await getOpenAIChatResponseWithModel(prompt, 'gpt-4o')

      if (response.content) {
        const prompts = response.content
          .split('\n')
          .map((prompt: string) => prompt.trim())
          .filter((prompt: string) => prompt.length > 0)
          .slice(0, 5)

        return prompts
      }

      return []
    } catch (error) {
      console.error('Failed to generate contextual prompts:', error)
      return []
    }
  }

  getWorkspaceDescription(): string {
    const descriptions: string[] = []

    // Add selected items by type
    for (const [type, selectedIndexes] of Object.entries(
      this.selectedMatches,
    )) {
      if (selectedIndexes.size > 0) {
        const matches = this.semanticMatches[type as keyof SemanticMatches]
        descriptions.push(
          ...Array.from(selectedIndexes).map(
            (index) => matches[index]?.title || 'Untitled',
          ),
        )
      }
    }

    return descriptions.join(', ')
  }

  async fetchSemanticMatches(searchString: string) {
    this.matchesLoading = true
    try {
      const domain = this.getDomainFromContext()

      const [tabs, domainTabs, history, stories] = await Promise.all([
        (browser as unknown as mlBrowserT).extensionHub.semanticTabs(
          searchString,
        ),
        domain
          ? (browser as unknown as mlBrowserT).extensionHub.domainTabs(domain)
          : Promise.resolve([]),
        (browser as unknown as mlBrowserT).extensionHub.semanticHistory(
          searchString,
        ),
        (browser as unknown as mlBrowserT).extensionHub.semanticStories(
          searchString,
        ),
      ])

      // Remove domain tabs that already appear in semantic tabs
      const semanticTabUrls = new Set((tabs || []).map((tab) => tab.url))
      const filteredDomainTabs = (domainTabs || []).filter(
        (tab) => !semanticTabUrls.has(tab.url),
      )

      // Remove selected context and Google search URLs from semantic history
      const selectedItem = this.contextItems.find((item) => item.selected)
      const filteredHistory = (history || []).filter((item) => {
        // Filter out selected context
        if (item.url === selectedItem?.content) return false

        // Filter out semantic tabs
        if (semanticTabUrls.has(item.url)) return false

        // Filter out Google search URLs
        if (item.url?.includes('google.com/search')) return false

        return true
      })

      this.semanticMatches = {
        tabs: tabs || [],
        domainTabs: filteredDomainTabs,
        history: filteredHistory,
        stories: stories || [],
        suggestedQueries: [],
      }

      // Reset selections when new matches are loaded
      this.selectedMatches = {
        tabs: new Set(),
        domainTabs: new Set(),
        history: new Set(),
        stories: new Set(),
        suggestedQueries: new Set(),
      }
      this.selectAllStates = {
        tabs: false,
        domainTabs: false,
        history: false,
        stories: false,
        suggestedQueries: false,
      }

      // Close any previously opened tabs
      await this.closeAllOpenedTabs()
      this.openedTabIds = {
        tabs: new Map(),
        domainTabs: new Map(),
        history: new Map(),
        stories: new Map(),
        suggestedQueries: new Map(),
      }

      // Auto-select matches based on criteria (after cleanup)
      await this.autoSelectMatches()

      // Generate suggested queries separately (async)
      // For non-manual context, generate immediately
      if (selectedItem?.type !== 'manual') {
        this.generateSuggestedQueries(searchString).then(async (matches) => {
          this.semanticMatches = {
            ...this.semanticMatches,
            suggestedQueries: matches,
          }
          await this.autoSelectMatches(['suggestedQueries'])
          this.requestUpdate()
        })
      }
    } catch (error) {
      console.error('Failed to fetch semantic matches:', error)
    }
    this.matchesLoading = false
  }

  async autoSelectMatches(
    matchTypes: (keyof SemanticMatches)[] = [
      'tabs',
      'domainTabs',
      'history',
      'stories',
    ],
  ) {
    for (const type of matchTypes) {
      const matches = this.semanticMatches[type]
      if (matches.length === 0) continue

      // Auto-select items with sufficient score
      for (let index = 0; index < matches.length; index++) {
        const match = matches[index]
        if (
          (type == 'tabs' || (match.score && match.score > 0.25)) &&
          !this.selectedMatches[type].has(index)
        ) {
          await this.handleMatchSelection(type, index)
        }
      }
    }
  }

  async handleSelectAll(
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
  ) {
    const isSelecting = !this.selectAllStates[type]
    this.selectAllStates = {
      ...this.selectAllStates,
      [type]: isSelecting,
    }

    const topFive = [0, 1, 2, 3, 4].filter(
      (i) => i < this.semanticMatches[type].length,
    )

    if (isSelecting) {
      // Select top 5 matches using handleMatchSelection
      for (const index of topFive) {
        if (!this.selectedMatches[type].has(index)) {
          await this.handleMatchSelection(type, index)
        }
      }
    } else {
      // Deselect all using handleMatchSelection
      for (const index of topFive) {
        if (this.selectedMatches[type].has(index)) {
          await this.handleMatchSelection(type, index)
        }
      }
    }
    this.requestUpdate()
  }

  async handleMatchSelection(
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
    index: number,
  ) {
    const newSet = new Set(this.selectedMatches[type])
    const wasSelected = newSet.has(index)

    if (wasSelected) {
      newSet.delete(index)
      // Close background tab when unchecked
      await this.closeBackgroundTab(type, index)
    } else {
      newSet.add(index)
      // Open background tab when checked
      const match = this.semanticMatches[type][index]
      if (match) {
        await this.openBackgroundTab(match, type, index)
      }
    }

    this.selectedMatches[type] = newSet

    // Update select all state
    const topFive = [0, 1, 2, 3, 4].filter(
      (i) => i < this.semanticMatches[type].length,
    )
    this.selectAllStates[type] = topFive.every((i) => newSet.has(i))
    this.requestUpdate()
  }

  async openBackgroundTab(
    match: SemanticMatch,
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
    index: number,
  ) {
    if (match.url && !this.openedTabIds[type].has(index)) {
      try {
        const tab = await browser.tabs.create({
          url: match.url,
          active: false,
        })
        this.openedTabIds[type].set(index, tab.id ?? 0)
      } catch (error) {
        console.error('Failed to open background tab:', error)
      }
    }
  }

  async closeBackgroundTab(
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
    index: number,
  ) {
    const tabId = this.openedTabIds[type].get(index)
    if (tabId) {
      try {
        await browser.tabs.remove(tabId)
        this.openedTabIds[type].delete(index)
      } catch (error) {
        console.error('Failed to close background tab:', error)
      }
    }
  }

  async closeAllOpenedTabs() {
    for (const [type, tabMap] of Object.entries(this.openedTabIds)) {
      for (const tabId of tabMap.values()) {
        try {
          await browser.tabs.remove(tabId)
        } catch (error) {
          console.error('Failed to close background tab:', error)
        }
      }
    }
  }

  handleMatchClick(
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
    index: number,
  ) {
    // Toggle checkbox selection
    this.handleMatchSelection(type, index)
  }

  getSelectedMatchUrls(): string[] {
    const urls: string[] = []

    // Collect URLs from all selected matches
    for (const [type, selectedIndexes] of Object.entries(
      this.selectedMatches,
    )) {
      for (const index of selectedIndexes) {
        const match = this.semanticMatches[type as keyof SemanticMatches][index]
        if (match?.url) {
          urls.push(match.url)
        }
      }
    }

    return urls
  }

  constructPrompt(prompt: string): string {
    const urls = this.getSelectedMatchUrls()
    const urlsText =
      urls.length > 0
        ? `\n\nRelevant URLs (use tool for content):\n${urls.join('\n')}`
        : ''
    return `Context: ${this.selectedContext}\n\n${prompt}${urlsText}`
  }

  async sendToFirefoxChat(prompt: string) {
    const fullPrompt = this.constructPrompt(prompt)
    await (browser as unknown as mlBrowserT).extensionHub.askChat(fullPrompt)
  }

  handleDefaultPromptClick(prompt: string) {
    this.sendToFirefoxChat(prompt)
  }

  handleCustomPromptInput(e: Event) {
    this.customPrompt = (e.target as HTMLInputElement).value
  }

  handleCustomPromptSubmit() {
    if (this.customPrompt.trim()) {
      this.sendToFirefoxChat(this.customPrompt.trim())
    }
  }

  async handleToggleContextualPrompts() {
    if (!this.showingContextualPrompts) {
      // Switch to contextual prompts
      if (this.contextualPrompts.length === 0) {
        this.generatingPrompts = true
        this.requestUpdate()

        const prompts = await this.generateContextualPrompts()
        this.contextualPrompts = prompts
        this.generatingPrompts = false
      }
      this.showingContextualPrompts = true
    } else {
      // Switch back to default prompts
      this.showingContextualPrompts = false
    }
    this.requestUpdate()
  }

  getCurrentPrompts(): string[] {
    if (this.showingContextualPrompts) {
      return this.contextualPrompts.length > 0
        ? [...this.defaultPrompts.slice(0, 3), ...this.contextualPrompts]
        : this.defaultPrompts
    }
    return this.defaultPrompts
  }

  renderContextItem(item: ContextItem, index: number) {
    if (item.type === 'manual') {
      return html`
        <div
          class="context-item manual ${item.selected ? 'selected' : ''}"
          @click="${() => this.handleContextSelection(index, this.manualInput)}"
        >
          <div class="context-title">${item.title}</div>
          <input
            type="text"
            .value="${this.manualInput}"
            @input="${this.handleManualInput}"
            @click="${(e: Event) => e.stopPropagation()}"
            placeholder="Enter your context manually..."
            class="manual-input"
          />
        </div>
      `
    }

    return html`
      <div
        class="context-item ${item.type} ${item.selected ? 'selected' : ''}"
        @click="${() => this.handleContextSelection(index, item.title)}"
      >
        <div class="context-title">${item.title}</div>
        <div class="context-content">${item.content.slice(0, 100)}</div>
        <div class="context-type">
          ${item.type === 'tab' ? 'Recent Tab' : 'Recent Search'}
        </div>
      </div>
    `
  }

  renderSemanticMatches() {
    if (!this.selectedContext) {
      return html`<div class="no-selection">No context selected yet</div>`
    }

    if (this.matchesLoading) {
      return html`<div class="loading">Finding semantic matches...</div>`
    }

    return html`
      <div class="matches-container">
        ${this.semanticMatches.tabs.length > 0
          ? this.renderMatchType(
              'tabs',
              'Semantic Tabs',
              this.semanticMatches.tabs,
            )
          : ''}
        ${this.semanticMatches.domainTabs.length > 0
          ? this.renderMatchType(
              'domainTabs',
              `Domain Tabs (${this.getDomainFromContext()})`,
              this.semanticMatches.domainTabs,
            )
          : ''}
        ${this.semanticMatches.history.length > 0
          ? this.renderMatchType(
              'history',
              'Semantic History',
              this.semanticMatches.history,
            )
          : ''}
        ${this.renderSuggestedQueries()}
        ${this.semanticMatches.stories.length > 0
          ? this.renderMatchType(
              'stories',
              'Semantic Stories',
              this.semanticMatches.stories,
            )
          : ''}
      </div>
    `
  }

  renderMatchType(
    type: 'tabs' | 'domainTabs' | 'history' | 'stories' | 'suggestedQueries',
    label: string,
    matches: SemanticMatch[],
  ) {
    return html`
      <div class="match-type-section">
        <div class="match-type-header">
          <h3 class="match-type-title">${label}</h3>
          <label class="select-all-container">
            <input
              type="checkbox"
              .checked="${this.selectAllStates[type]}"
              @change="${() => this.handleSelectAll(type)}"
            />
            Select All
          </label>
        </div>

        <div class="matches-list">
          ${matches.length === 0
            ? html` <div class="no-matches">No matches found</div> `
            : matches.map(
                (match, index) => html`
                  <div
                    class="match-item ${this.selectedMatches[type].has(index)
                      ? 'selected'
                      : ''}"
                    @click="${() => this.handleMatchClick(type, index)}"
                  >
                    <label
                      class="match-checkbox"
                      @click="${(e: Event) => e.stopPropagation()}"
                    >
                      <input
                        type="checkbox"
                        .checked="${this.selectedMatches[type].has(index)}"
                        @change="${() =>
                          this.handleMatchSelection(type, index)}"
                      />
                    </label>
                    <div class="match-content">
                      <div class="match-title">${match.title}</div>
                      ${match.excerpt
                        ? html`
                            <div class="match-excerpt">${match.excerpt}</div>
                          `
                        : ''}
                      ${match.score
                        ? html`
                            <div class="match-score">
                              Score: ${(match.score * 100).toFixed(1)}%
                            </div>
                          `
                        : ''}
                    </div>
                  </div>
                `,
              )}
        </div>
      </div>
    `
  }

  renderSuggestedQueries() {
    if (this.semanticMatches.suggestedQueries.length === 0) {
      return ''
    }

    return this.renderMatchType(
      'suggestedQueries',
      'Suggested Search Queries',
      this.semanticMatches.suggestedQueries,
    )
  }

  render() {
    return html`
      <div class="semantic-search-container">
        <div class="content">
          <!-- Part 1: Context Selection -->
          <div class="context-selection-section">
            <h2 class="section-title">Semantic Context</h2>
            ${this.loading
              ? html` <div class="loading">Loading context items...</div> `
              : html`
                  <div class="context-items">
                    ${this.contextItems.map((item, index) =>
                      this.renderContextItem(item, index),
                    )}
                  </div>
                `}
          </div>

          <!-- Part 2: Semantic Matches -->
          <div class="semantic-matches-section">
            <h2 class="section-title">Add to Workspace</h2>
            <div class="matches-display">${this.renderSemanticMatches()}</div>
          </div>

          <!-- Part 3: Workspace Actions -->
          ${this.selectedContext
            ? html`
                <div class="workspace-actions-section">
                  <h2 class="section-title">
                    Send to Firefox Chat
                    ${this.getSelectedMatchUrls().length > 0
                      ? html` <button
                          class="toggle-prompts-btn ${this
                            .showingContextualPrompts
                            ? 'active'
                            : ''}"
                          @click="${this.handleToggleContextualPrompts}"
                          ?disabled="${this.generatingPrompts ||
                          this.getSelectedMatchUrls().length === 0}"
                        >
                          ${this.generatingPrompts
                            ? 'Generating...'
                            : this.showingContextualPrompts
                              ? '✨ Contextual Prompts'
                              : '🎯 Get Contextual Prompts'}
                        </button>`
                      : null}
                  </h2>

                  ${this.getSelectedMatchUrls().length === 0
                    ? html`
                        <div class="no-urls-message">
                          Select some matches above to enable workspace actions
                        </div>
                      `
                    : html`
                        <div class="actions-container">
                          <!-- Prompt Selection -->
                          <div class="prompt-selection-section">
                            <div class="prompt-items">
                              ${this.getCurrentPrompts().map(
                                (prompt, index) => html`
                                  <div
                                    class="prompt-item ${index >= 3 &&
                                    this.showingContextualPrompts
                                      ? 'contextual'
                                      : ''}"
                                    @click="${() =>
                                      this.handleDefaultPromptClick(prompt)}"
                                  >
                                    <div class="prompt-content">${prompt}</div>
                                  </div>
                                `,
                              )}
                              <div class="prompt-item custom">
                                <input
                                  type="text"
                                  .value="${this.customPrompt}"
                                  @input="${this.handleCustomPromptInput}"
                                  placeholder="Enter custom prompt..."
                                  class="custom-prompt-input"
                                />
                                <button
                                  class="custom-prompt-submit"
                                  @click="${this.handleCustomPromptSubmit}"
                                  ?disabled="${!this.customPrompt.trim()}"
                                >
                                  Send custom prompt
                                </button>
                              </div>
                            </div>
                          </div>

                          <!-- Selected URLs Preview -->
                          <div class="urls-preview">
                            <strong
                              >Selected URLs
                              (${this.getSelectedMatchUrls().length}):</strong
                            >
                            <div class="urls-list">
                              ${this.getSelectedMatchUrls()
                                .slice(0, 3)
                                .map(
                                  (url) => html`
                                    <div class="url-item">${url}</div>
                                  `,
                                )}
                              ${this.getSelectedMatchUrls().length > 3
                                ? html`
                                    <div class="url-item">
                                      ...and
                                      ${this.getSelectedMatchUrls().length - 3}
                                      more
                                    </div>
                                  `
                                : ''}
                            </div>
                          </div>
                        </div>
                      `}
                </div>
              `
            : ''}
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
        --color-bubble-bg: rgba(0, 0, 0, 0.3);
        --color-card-bg: rgba(255, 255, 255, 0.8);
        --color-selected: #007bff;
        --gradient-start: #ff6b35;
        --gradient-end: #9666ff;
      }

      .semantic-search-container {
        min-height: 100vh;
        background: linear-gradient(
          135deg,
          var(--gradient-start) 0%,
          var(--gradient-end) 100%
        );
        padding: 60px 20px;
        color: var(--color-fg);
        font-family: 'Inter', sans-serif;
      }

      .content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 40px;
      }

      .header-section {
        text-align: center;
        margin-bottom: 40px;
      }

      .main-title {
        font-family: 'Firefox Sharp Sans', sans-serif;
        font-size: 48px;
        font-weight: 500;
        line-height: 1.2;
        margin: 0;
        color: var(--color-fg);
      }

      .section-title {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 20px;
        color: var(--color-fg);
      }

      .context-selection-section {
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 30px;
      }

      .loading {
        text-align: center;
        padding: 40px;
        font-size: 18px;
        opacity: 0.8;
      }

      .context-items {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }

      .context-item {
        background: var(--color-card-bg);
        color: #15141a;
        border-radius: 12px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
      }

      .context-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .context-item.selected {
        border-color: var(--color-selected);
        background: rgba(0, 123, 255, 0.1);
        color: var(--color-fg);
      }

      .context-title {
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 8px;
      }

      .context-content {
        font-size: 14px;
        opacity: 0.8;
        margin-bottom: 8px;
        word-break: break-all;
      }

      .context-type {
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        opacity: 0.6;
      }

      .context-item.manual {
        display: flex;
        flex-direction: column;
      }

      .manual-input {
        margin-top: 8px;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        color: #333;
      }

      .context-item.manual.selected .manual-input {
        border-color: var(--color-selected);
      }

      .semantic-matches-section {
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 30px;
      }

      .context-preview {
        font-size: 16px;
        line-height: 1.5;
        word-break: break-word;
        margin-bottom: 20px;
        padding: 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
      }

      .matches-display {
        min-height: 200px;
      }

      .matches-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }

      .match-type-section {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
      }

      .match-type-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .match-type-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        color: var(--color-fg);
      }

      .select-all-container {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
        color: var(--color-fg);
      }

      .select-all-container input[type='checkbox'] {
        margin: 0;
      }

      .matches-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .match-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        background: var(--color-card-bg);
        color: #15141a;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
      }

      .match-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .match-item.selected {
        border-color: var(--color-selected);
        background: rgba(0, 123, 255, 0.1);
        color: var(--color-fg);
      }

      .match-checkbox {
        display: flex;
        align-items: center;
        margin-top: 2px;
      }

      .match-checkbox input[type='checkbox'] {
        margin: 0;
      }

      .match-content {
        flex: 1;
      }

      .match-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
        line-height: 1.3;
      }

      .match-excerpt {
        font-size: 12px;
        opacity: 0.8;
        margin-bottom: 4px;
        line-height: 1.4;
        word-break: break-all;
      }

      .match-score {
        font-size: 11px;
        opacity: 0.6;
        font-weight: 500;
      }

      .no-matches,
      .no-selection {
        opacity: 0.6;
        font-style: italic;
        text-align: center;
        padding: 40px;
      }

      /* Part 3: Workspace Actions Styles */
      .workspace-actions-section {
        background: var(--color-bubble-bg);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 30px;
        margin-top: 20px;
      }

      .actions-container {
        display: flex;
        flex-direction: column;
        gap: 25px;
      }

      .action-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .action-label {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-fg);
        margin-bottom: 8px;
      }

      .action-button {
        padding: 12px 20px;
        background: var(--color-primary);
        color: var(--color-fg);
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .action-button:hover:not(:disabled) {
        background: #8555e6;
        transform: translateY(-1px);
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #555;
      }

      .action-button.primary {
        background: var(--color-primary);
        font-size: 16px;
        padding: 14px 24px;
      }

      .action-button.secondary {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid var(--color-fg);
        color: var(--color-fg);
        font-size: 14px;
        padding: 8px 16px;
        align-self: flex-start;
      }

      .prompt-selection-section {
        margin-bottom: 20px;
      }

      .toggle-prompts-btn {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--color-fg);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .toggle-prompts-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-1px);
      }

      .toggle-prompts-btn.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .toggle-prompts-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: rgba(255, 255, 255, 0.05);
      }

      .prompt-items {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }

      .prompt-item {
        background: var(--color-card-bg);
        color: #15141a;
        border-radius: 12px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        min-height: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .prompt-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .prompt-content {
        font-weight: 600;
        font-size: 14px;
        text-align: center;
        line-height: 1.3;
      }

      .prompt-item.custom {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }

      .prompt-item.contextual {
        background: linear-gradient(
          135deg,
          var(--color-card-bg) 80%,
          rgba(150, 102, 255, 0.2),
          rgba(150, 102, 255, 0.1)
        );
        border-color: rgba(150, 102, 255, 0.3);
      }

      .prompt-title {
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 8px;
      }

      .custom-prompt-input {
        margin-top: 8px;
        padding: 8px 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        color: #333;
        flex: 1;
      }

      .custom-prompt-submit {
        margin-top: 8px;
        padding: 6px 12px;
        background: var(--color-primary);
        color: var(--color-fg);
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .custom-prompt-submit:hover:not(:disabled) {
        background: #8555e6;
        transform: translateY(-1px);
      }

      .custom-prompt-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #555;
      }

      .no-urls-message {
        text-align: center;
        opacity: 0.6;
        font-style: italic;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }

      .urls-preview {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 15px;
      }

      .urls-preview strong {
        color: var(--color-fg);
        font-size: 14px;
      }

      .urls-list {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .url-item {
        font-size: 12px;
        opacity: 0.8;
        background: rgba(0, 0, 0, 0.2);
        padding: 6px 10px;
        border-radius: 4px;
        word-break: break-all;
      }
    `
  }
}

export default MozSemanticSearch
