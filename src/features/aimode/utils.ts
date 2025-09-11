import type { mlBrowserT } from '../../../types'

export function detectQueryType(query: string): string {
  const trimmedQuery = query.trim().toLowerCase()

  // URL detection: starts with http/https or contains protocol-like patterns
  if (
    /^(about|https?):/.test(trimmedQuery) ||
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(
      trimmedQuery.replace(/^https?:\/\//, ''),
    )
  ) {
    return 'navigate'
  }

  // Domain detection: no spaces with at least one period (supports subdomains and paths)
  if (
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedQuery) &&
    !trimmedQuery.includes(' ')
  ) {
    return 'navigate'
  }

  // Chat detection: starts with question words OR ends with question mark
  if (
    /^(who|what|when|where|why|how)\s/.test(trimmedQuery) ||
    trimmedQuery.endsWith('?')
  ) {
    return 'chat'
  }

  // Action detection: starts with "tab" or "find" or "tab switch:"
  if (
    trimmedQuery.startsWith('tab') ||
    trimmedQuery.startsWith('find') ||
    trimmedQuery.startsWith('tab switch:')
  ) {
    return 'action'
  }

  // Default to search
  return 'search'
}

export function getQueryTypeIcon(type: string): string {
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

export function getQueryTypeLabel(type: string): string {
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

// Topic-specific personalization insights
const PERSONAL_INSIGHTS = {
  // Topic-specific insights
  topicInsights: {
    travel: ['japan travel', 'budget travel', 'family travel', 'solo travel'],
    food: ['vegan food', 'gluten-free', 'quick meals', 'healthy eating'],
    technology: ['open source', 'mobile development', 'ai/ml', 'cybersecurity'],
    sports: [
      'nfl interest',
      'fantasy sports',
      'local teams',
      'fitness tracking',
    ],
    news: [
      'breaking news',
      'political interest',
      'local news',
      'fact checking',
    ],
    shopping: [
      'eco-friendly products',
      'budget shopping',
      'tech gadgets',
      'home improvement',
    ],
    entertainment: [
      'movie reviews',
      'streaming content',
      'music discovery',
      'gaming',
    ],
    health: [
      'mental health',
      'nutrition focus',
      'fitness goals',
      'preventive care',
    ],
    finance: [
      'retirement planning',
      'crypto interest',
      'budgeting',
      'investing',
    ],
    education: [
      'online learning',
      'career development',
      'skill building',
      'certification',
    ],
    general: [
      'trending topics',
      'popular content',
      'lives in reno',
      'budget conscious',
      'tech savvy',
      'time-pressed',
      'quality focused',
      'environmentally conscious',
      'health conscious',
    ],
  },
  // General insights that apply to any topic
  generalInsights: [
    'trending topics',
    'popular content',
    'lives in reno',
    'budget conscious',
    'tech savvy',
    'time-pressed',
    'quality focused',
    'environmentally conscious',
    'health conscious',
  ],
}

// Topic-specific suggestion templates
const TOPIC_SUGGESTIONS = {
  travel: {
    chat: [
      'What is the best time to visit {topic}?',
      'How much does a trip to {topic} cost?',
      'What are the top attractions in {topic}?',
      'What are the local customs in {topic}?',
      'Where should I stay in {topic}?',
      'What food should I try in {topic}?',
    ],
    search: [
      '{topic} travel guide',
      '{topic} hotels deals',
      '{topic} flight deals',
      '{topic} travel tips',
      'best {topic} restaurants',
      '{topic} weather forecast',
    ],
  },
  food: {
    chat: [
      'What are the ingredients in {topic}?',
      'How do I make {topic} healthier?',
      'What goes well with {topic}?',
      'How long does {topic} last?',
      'What are alternatives to {topic}?',
      'How many calories are in {topic}?',
    ],
    search: [
      '{topic} recipe',
      '{topic} nutrition facts',
      '{topic} cooking tips',
      'healthy {topic} alternatives',
      '{topic} meal prep',
      '{topic} dietary restrictions',
    ],
  },
  technology: {
    chat: [
      'How does {topic} work?',
      'What are the pros and cons of {topic}?',
      'Who should use {topic}?',
      'What are alternatives to {topic}?',
      'How secure is {topic}?',
      'What skills do I need for {topic}?',
    ],
    search: [
      '{topic} tutorial',
      '{topic} vs competitors',
      '{topic} reviews',
      '{topic} documentation',
      '{topic} pricing',
      '{topic} best practices',
    ],
  },
  sports: {
    chat: [
      'Who are the top {topic} players?',
      'What are the latest {topic} news?',
      'How can I improve at {topic}?',
      'What equipment do I need for {topic}?',
      'When is the {topic} season?',
      'Where can I watch {topic}?',
    ],
    search: [
      '{topic} scores',
      '{topic} highlights',
      '{topic} schedule',
      '{topic} stats',
      '{topic} training',
      '{topic} gear',
    ],
  },
  news: {
    chat: [
      'What happened with {topic}?',
      'Why is {topic} important?',
      'What are the implications of {topic}?',
      'Who is involved in {topic}?',
      'When did {topic} happen?',
      'Where can I learn more about {topic}?',
    ],
    search: [
      '{topic} latest news',
      '{topic} analysis',
      '{topic} fact check',
      '{topic} timeline',
      '{topic} expert opinion',
      '{topic} background',
    ],
  },
  shopping: {
    chat: [
      'What are the best deals for {topic}?',
      'How much should I pay for {topic}?',
      'Where can I buy {topic}?',
      'What are the reviews for {topic}?',
      'What are alternatives to {topic}?',
      'What features should I look for in {topic}?',
    ],
    search: [
      '{topic} best deals',
      '{topic} price comparison',
      '{topic} reviews',
      '{topic} discount codes',
      '{topic} where to buy',
      '{topic} features',
    ],
  },
  entertainment: {
    chat: [
      'What is {topic} about?',
      'Who stars in {topic}?',
      'When was {topic} released?',
      'Where can I watch {topic}?',
      'What genre is {topic}?',
      'How long is {topic}?',
    ],
    search: [
      '{topic} reviews',
      '{topic} cast',
      '{topic} streaming',
      '{topic} trailer',
      '{topic} ratings',
      '{topic} similar shows',
    ],
  },
  health: {
    chat: [
      'What are the symptoms of {topic}?',
      'How can I prevent {topic}?',
      'What causes {topic}?',
      'When should I see a doctor about {topic}?',
      'What treatments are available for {topic}?',
      'How serious is {topic}?',
    ],
    search: [
      '{topic} symptoms',
      '{topic} treatment',
      '{topic} prevention',
      '{topic} causes',
      '{topic} home remedies',
      '{topic} medical advice',
    ],
  },
  finance: {
    chat: [
      'How do I invest in {topic}?',
      'What are the risks of {topic}?',
      'When should I consider {topic}?',
      'What are the fees for {topic}?',
      'How does {topic} work?',
      'What returns can I expect from {topic}?',
    ],
    search: [
      '{topic} investment guide',
      '{topic} fees',
      '{topic} risks',
      '{topic} returns',
      '{topic} comparison',
      '{topic} tax implications',
    ],
  },
  education: {
    chat: [
      'How can I learn {topic}?',
      'What skills do I need for {topic}?',
      'Where can I study {topic}?',
      'How long does it take to learn {topic}?',
      'What career opportunities are in {topic}?',
      'What are the prerequisites for {topic}?',
    ],
    search: [
      '{topic} courses',
      '{topic} certification',
      '{topic} tutorials',
      '{topic} career path',
      '{topic} online learning',
      '{topic} study guide',
    ],
  },
  general: {
    chat: [
      'What is {topic} about?',
      'How does {topic} work?',
      'Why is {topic} important?',
      'Where can I learn more about {topic}?',
      'When should I use {topic}?',
      'Who created {topic}?',
    ],
    search: [
      '{topic} guide',
      '{topic} tutorial',
      '{topic} reviews',
      '{topic} comparison',
      '{topic} tips',
      '{topic} alternatives',
    ],
  },
}

// Topic-specific domain suggestions
const TOPIC_DOMAINS = {
  travel: [
    'booking.com',
    'tripadvisor.com',
    'airbnb.com',
    'expedia.com',
    'kayak.com',
  ],
  food: [
    'allrecipes.com',
    'foodnetwork.com',
    'epicurious.com',
    'tasty.co',
    'delish.com',
  ],
  technology: [
    'github.com',
    'stackoverflow.com',
    'techcrunch.com',
    'arstechnica.com',
    'wired.com',
  ],
  sports: [
    'espn.com',
    'bleacherreport.com',
    'cbssports.com',
    'nfl.com',
    'nba.com',
  ],
  news: ['reuters.com', 'bbc.com', 'apnews.com', 'npr.org', 'cnn.com'],
  shopping: ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'etsy.com'],
  entertainment: [
    'imdb.com',
    'netflix.com',
    'rottentomatoes.com',
    'hulu.com',
    'spotify.com',
  ],
  health: [
    'webmd.com',
    'mayoclinic.org',
    'healthline.com',
    'medicalnewstoday.com',
    'nih.gov',
  ],
  finance: [
    'mint.com',
    'investopedia.com',
    'marketwatch.com',
    'yahoo.finance.com',
    'cnbc.com',
  ],
  education: [
    'coursera.org',
    'edx.org',
    'khanacademy.org',
    'udemy.com',
    'codecademy.com',
  ],
  general: [
    'wikipedia.org',
    'reddit.com',
    'quora.com',
    'medium.com',
    'youtube.com',
  ],
}

export function getPersonalizedContext(
  usePersonalInsights: boolean = false,
  currentTopic: string = 'general',
): string {
  if (!usePersonalInsights) return ''
  const topicKey = currentTopic as keyof typeof TOPIC_SUGGESTIONS
  const topicInsights = PERSONAL_INSIGHTS.topicInsights[topicKey] || []
  const generalInsights = PERSONAL_INSIGHTS.generalInsights
  let context = ''

  // Select random insights for each suggestion
  const selectedTopicInsight =
    topicInsights[Math.floor(Math.random() * topicInsights.length)]
  const selectedGeneralInsight =
    generalInsights[Math.floor(Math.random() * generalInsights.length)]

  if (selectedTopicInsight) {
    context += ` for ${selectedTopicInsight}`
  }
  if (
    selectedGeneralInsight &&
    selectedGeneralInsight !== selectedTopicInsight
  ) {
    context += ` (${selectedGeneralInsight})`
  }

  return context
}

export function generateQuerySuggestions(
  tabTitle: string,
  currentDomain: string = '',
  currentTopic: string = 'general',
  usePersonalInsights: boolean = false,
): Array<{ text: string; type: string }> {
  const suggestions = []
  const titleWords = tabTitle
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)

  const topicKey = currentTopic as keyof typeof TOPIC_SUGGESTIONS
  const topicTemplates =
    TOPIC_SUGGESTIONS[topicKey] || TOPIC_SUGGESTIONS.general
  const topic = titleWords.join(' ') || 'this'

  // 2 chat prompts using topic-aware templates with individual personalization
  const chatTemplates = [...topicTemplates.chat].sort(() => Math.random() - 0.5)
  suggestions.push(
    {
      text:
        chatTemplates[0].replace('{topic}', topic) +
        getPersonalizedContext(usePersonalInsights, currentTopic),
      type: 'chat',
    },
    {
      text:
        chatTemplates[1].replace('{topic}', topic) +
        getPersonalizedContext(usePersonalInsights, currentTopic),
      type: 'chat',
    },
  )

  // 2 search queries using topic-aware templates with individual personalization
  const searchTemplates = [...topicTemplates.search].sort(
    () => Math.random() - 0.5,
  )
  suggestions.push(
    {
      text:
        searchTemplates[0].replace('{topic}', topic) +
        getPersonalizedContext(usePersonalInsights, currentTopic),
      type: 'search',
    },
    {
      text:
        searchTemplates[1].replace('{topic}', topic) +
        getPersonalizedContext(usePersonalInsights, currentTopic),
      type: 'search',
    },
  )

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

  // 1 topic-specific domain suggestion (different from current)
  const topicDomains = TOPIC_DOMAINS[topicKey] || TOPIC_DOMAINS.general
  const currentTabDomain = currentDomain
    ? currentDomain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .toLowerCase()
    : ''

  // Filter out the current domain and select a random one
  const availableDomains = topicDomains.filter(
    (domain) => domain.toLowerCase() !== currentTabDomain,
  )

  if (availableDomains.length > 0) {
    const suggestedDomain =
      availableDomains[Math.floor(Math.random() * availableDomains.length)]
    suggestions.push({
      text: suggestedDomain,
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

  return suggestions
}

export function customView(
  window: any,
  context: any,
  apiInstance: mlBrowserT['extensionHub'],
): void {
  // Check if overlay already exists to prevent duplicates
  if (window.document.getElementById('ai-mode-overlay')) {
    return
  }

  // Create overlay container
  const overlay = window.document.createElement('div')
  overlay.id = 'ai-mode-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to right, rgba(232, 180, 243, 0.5), rgba(255, 224, 236, 0.5));
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    animation: fadeIn 0.3s ease-in-out;
  `

  // Create main content container
  const content = window.document.createElement('div')
  content.style.cssText = `
    background: white;
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 90%;
    text-align: center;
  `

  // Create textarea
  const textarea = window.document.createElement('textarea')
  textarea.placeholder = 'Ask, search, or type a URL…'
  textarea.style.cssText = `
    width: 100%;
    height: 120px;
    border: 2px solid #e1e5e9;
    border-radius: 12px;
    padding: 16px;
    font-size: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    resize: none;
    outline: none;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
  `

  // Create unified suggestions container (for both quick prompts and live suggestions)
  const suggestionsHeader = window.document.createElement('div')
  suggestionsHeader.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 6px;
    color: #666;
    opacity: 0.8;
  `

  const suggestionsHeaderLeft = window.document.createElement('div')
  suggestionsHeaderLeft.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `
  suggestionsHeaderLeft.textContent = 'Quick Prompts:'

  const suggestionsList = window.document.createElement('div')
  suggestionsList.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `

  suggestionsHeader.appendChild(suggestionsHeaderLeft)

  const unifiedSuggestionsContainer = window.document.createElement('div')
  unifiedSuggestionsContainer.style.cssText = `
    margin-top: 16px;
    padding: 8px;
    background-color: white;
    border-radius: 8px;
    border: 1px solid #e1e5e9;
    display: block;
  `
  unifiedSuggestionsContainer.appendChild(suggestionsHeader)
  unifiedSuggestionsContainer.appendChild(suggestionsList)

  // Add mouse leave handler to clear input when leaving the entire suggestions area
  unifiedSuggestionsContainer.addEventListener('mouseleave', () => {
    // Clear textarea if user hasn't manually edited (like MozAIMode)
    if (!userHasEditedQuery && selectedSuggestionIndex >= 0) {
      textarea.value = ''
      selectedSuggestionIndex = -1
      updateButtonText()
    }
  })

  // Create buttons container
  const buttonsContainer = window.document.createElement('div')
  buttonsContainer.style.cssText = `
    margin-top: 24px;
    display: flex;
    gap: 12px;
    justify-content: center;
  `

  // Create dynamic execute button that reflects query type
  const executeButton = window.document.createElement('button')
  executeButton.innerHTML = '🔍 Search'
  executeButton.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-width: 120px;
  `

  // Create cancel button
  const cancelButton = window.document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.style.cssText = `
    background: #f8f9fa;
    color: #666;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `

  // Add CSS animations
  const style = window.document.createElement('style')
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `
  window.document.head.appendChild(style)

  // Variables for suggestion management
  let suggestionDebounceTimer: number | null = null
  let currentSuggestions: any[] = []
  let selectedSuggestionIndex = -1
  let userHasEditedQuery = false

  function hideSuggestions() {
    unifiedSuggestionsContainer.style.display = 'none'
    currentSuggestions = []
    selectedSuggestionIndex = -1
  }

  function updateSuggestionSelection() {
    const items = suggestionsList.children
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement
      if (i === selectedSuggestionIndex) {
        item.style.backgroundColor = '#e9ecef'
      } else {
        item.style.backgroundColor = 'transparent'
      }
    }
  }

  function selectSuggestion(index: number) {
    if (index >= 0 && index < currentSuggestions.length) {
      const suggestion = currentSuggestions[index]
      textarea.value = suggestion.text
      hideSuggestions()
      updateQueryType()
    }
  }

  // Just update the button text based on query type
  function updateButtonText() {
    const query = textarea.value.trim()
    if (!query) {
      executeButton.innerHTML = '🔍 Search'
      return
    }

    const type = detectQueryType(query)
    const icon = getQueryTypeIcon(type)
    const label = getQueryTypeLabel(type)
    executeButton.innerHTML = `${icon} ${label}`
  }

  // Update query type and suggestions as user types
  async function updateQueryType() {
    const query = textarea.value.trim()
    if (!query) {
      executeButton.innerHTML = '🔍 Search'
      // Reset to quick prompts and reset user edit state
      userHasEditedQuery = false
      showQuickPrompts()
      return
    }

    updateButtonText()

    // Only fetch live suggestions if user has actually typed (not hover fills)
    if (userHasEditedQuery) {
      // Show live suggestions header
      suggestionsHeaderLeft.textContent = 'Suggestions:'

      // Debounce suggestions
      if (suggestionDebounceTimer) {
        window.clearTimeout(suggestionDebounceTimer)
      }

      suggestionDebounceTimer = window.setTimeout(async () => {
        await fetchAndDisplayLiveSuggestions(query)
      }, 50)
    }
  }

  // Fetch live suggestions from urlbar
  async function fetchAndDisplayLiveSuggestions(query: string) {
    try {
      const urlbarSuggestions = await apiInstance.getUrlbarSuggestions(query)
      const suggestions = []

      // Get search results from urlbar
      const searchResults = urlbarSuggestions.filter((s) => s.type === 'search')

      if (searchResults.length > 0) {
        // First search result - create both search and chat variants
        const firstResult = searchResults[0]

        // Original as search type
        suggestions.push({
          text: firstResult.text,
          type: 'search',
        })

        // Same text with "?" as chat type
        suggestions.push({
          text: firstResult.text + '?',
          type: 'chat',
        })

        // Next 4 search results - run through detectQueryType to determine final type
        const remainingResults = searchResults.slice(1, 5)
        for (const result of remainingResults) {
          const detectedType = detectQueryType(result.text)
          suggestions.push({
            text: result.text,
            type: detectedType,
          })
        }
      }

      // Add navigate results as-is
      const navigateResults = urlbarSuggestions.filter(
        (s) => s.type === 'navigate',
      )
      const navigateSuggestions = navigateResults.slice(0, 2).map((s) => ({
        text: s.text,
        type: s.type,
      }))
      suggestions.push(...navigateSuggestions)

      // Add action results as-is
      const actionResults = urlbarSuggestions.filter((s) => s.type === 'action')
      const actionSuggestions = actionResults.slice(0, 2).map((s) => ({
        text: s.text,
        type: s.type,
      }))
      suggestions.push(...actionSuggestions)

      currentSuggestions = suggestions.slice(0, 8) // Limit to 8 suggestions
      displaySuggestions()
    } catch (error) {
      console.error('Error fetching live suggestions:', error)
      hideSuggestions()
    }
  }

  // Create a suggestion button with MozAIMode styling
  function createSuggestionButton(suggestion: any, index: number) {
    const button = window.document.createElement('button')
    button.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 12px;
      background-color: transparent;
      color: #333;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      text-align: left;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `

    // Add left border color based on type
    const borderColors = {
      search: '#4285f4',
      chat: '#34a853',
      navigate: '#ea4335',
      action: '#fbbc05',
    }
    const borderColor =
      borderColors[suggestion.type as keyof typeof borderColors] ||
      borderColors.search
    button.style.borderLeft = `3px solid ${borderColor}`

    const icon = window.document.createElement('span')
    icon.textContent = getQueryTypeIcon(suggestion.type)
    icon.style.cssText = `
      font-size: 14px;
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    `

    const text = window.document.createElement('span')
    text.textContent = suggestion.text
    text.style.cssText = `
      flex: 1;
      font-size: 11px;
      line-height: 1.2;
    `

    button.appendChild(icon)
    button.appendChild(text)

    // Hover effects - fill textarea on hover like MozAIMode
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#e9ecef'
      selectedSuggestionIndex = index
      updateSuggestionSelection()

      // Fill textarea with suggestion text (without triggering live suggestions)
      textarea.value = suggestion.text
      updateButtonText()
      textarea.focus()
    })

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent'
    })

    // Click handler - execute directly like MozAIMode
    button.addEventListener('click', (e: any) => {
      e.preventDefault()
      e.stopPropagation()
      handleExecute()
    })

    return button
  }

  // Display suggestions in the UI
  function displaySuggestions() {
    suggestionsList.innerHTML = ''

    if (currentSuggestions.length === 0) {
      hideSuggestions()
      return
    }

    currentSuggestions.forEach((suggestion, index) => {
      const suggestionButton = createSuggestionButton(suggestion, index)
      suggestionsList.appendChild(suggestionButton)
    })

    showSuggestions()
  }

  function showSuggestions() {
    unifiedSuggestionsContainer.style.display = 'block'
  }

  // Event listeners
  textarea.addEventListener('input', (e: any) => {
    // Mark that user has manually edited the query (not from hover)
    userHasEditedQuery = true
    updateQueryType()
  })

  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = '#667eea'
  })

  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = '#e1e5e9'
  })

  executeButton.addEventListener('mouseenter', () => {
    executeButton.style.transform = 'translateY(-1px)'
  })

  executeButton.addEventListener('mouseleave', () => {
    executeButton.style.transform = 'translateY(0)'
  })

  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.background = '#e9ecef'
  })

  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.background = '#f8f9fa'
  })

  // Handle execute action
  function handleExecute() {
    const query = textarea.value.trim()
    if (!query) return

    const type = detectQueryType(query)

    // Close overlay first
    closeOverlay()

    // Handle different query types
    switch (type) {
      case 'navigate':
        const url =
          query.startsWith('about:') || query.startsWith('http')
            ? query
            : `https://${query}`
        window.gBrowser.selectedTab = window.gBrowser.addTrustedTab(url, {
          triggeringPrincipal: context.extension.principal,
        })
        break
      case 'search':
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        window.gBrowser.selectedTab = window.gBrowser.addTrustedTab(searchUrl, {
          triggeringPrincipal: context.extension.principal,
        })
        break
      case 'chat':
        // Open AI mode page for chat queries with the query as hash parameter
        const chatUrl =
          context.extension.baseURL +
          'pages/aiModePage.html#' +
          encodeURIComponent(query)
        window.gBrowser.selectedTab = window.gBrowser.addTrustedTab(chatUrl, {
          triggeringPrincipal: context.extension.principal,
        })
        break
      case 'action':
      default:
        // Open AI mode page for action queries
        const aiModeUrl = context.extension.baseURL + 'pages/aiModePage.html'
        window.gBrowser.selectedTab = window.gBrowser.addTrustedTab(aiModeUrl, {
          triggeringPrincipal: context.extension.principal,
        })
        break
    }
  }

  function closeOverlay() {
    if (overlay.parentNode) {
      overlay.style.animation = 'fadeOut 0.2s ease-in-out'
      window.setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay)
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style)
        }
      }, 200)
    }
    // Reset state when closing
    userHasEditedQuery = false
  }

  // Button event listeners
  executeButton.addEventListener('click', handleExecute)
  cancelButton.addEventListener('click', closeOverlay)

  // Keyboard shortcuts with suggestion navigation
  textarea.addEventListener('keydown', (e: any) => {
    if (currentSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectedSuggestionIndex < 0) {
          selectedSuggestionIndex = 0
        } else {
          selectedSuggestionIndex = Math.min(
            selectedSuggestionIndex + 1,
            currentSuggestions.length - 1,
          )
        }
        updateSuggestionSelection()
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1)
        updateSuggestionSelection()
        return
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault()
        selectSuggestion(selectedSuggestionIndex)
        return
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleExecute()
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleExecute()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      const hasText = textarea.value.trim().length > 0

      if (hasText) {
        // Clear input and regenerate original quick prompts
        textarea.value = ''
        userHasEditedQuery = false
        selectedSuggestionIndex = -1
        executeButton.innerHTML = '🔍 Search'
        initializeQuickPrompts() // Regenerate original tab-based quick prompts
      } else {
        // Close overlay when input is already empty
        closeOverlay()
      }
    }
  })

  // Close on backdrop click
  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) {
      closeOverlay()
    }
  })

  // Assemble the UI
  buttonsContainer.appendChild(executeButton)
  buttonsContainer.appendChild(cancelButton)

  // Initialize quick prompts
  async function initializeQuickPrompts() {
    try {
      // Get current tab info from the already available window
      const currentTab = window.gBrowser.selectedBrowser
      const tabTitle =
        currentTab.contentTitle || currentTab.contentDocument?.title || ''
      const tabUrl = currentTab.currentURI.spec || ''

      // Generate quick prompts based on current tab
      const quickPrompts = generateQuerySuggestions(tabTitle, tabUrl)
      displayQuickPrompts(quickPrompts.slice(0, 6)) // Show first 6 prompts
    } catch (error) {
      console.error('Error initializing quick prompts:', error)
      // Fallback to general prompts if we can't get tab info
      const fallbackPrompts = generateQuerySuggestions('', '')
      displayQuickPrompts(fallbackPrompts.slice(0, 6))
    }
  }

  function displayQuickPrompts(prompts: Array<{ text: string; type: string }>) {
    suggestionsList.innerHTML = ''

    prompts.forEach((prompt, index) => {
      const promptButton = createSuggestionButton(prompt, index)
      suggestionsList.appendChild(promptButton)
    })

    // Set current suggestions for keyboard navigation
    currentSuggestions = prompts
    showSuggestions()
  }

  function showQuickPrompts() {
    suggestionsHeaderLeft.textContent = 'Quick Prompts:'
    unifiedSuggestionsContainer.style.display = 'block'
  }

  content.appendChild(textarea)
  content.appendChild(unifiedSuggestionsContainer)
  content.appendChild(buttonsContainer)

  overlay.appendChild(content)
  window.document.body.appendChild(overlay)

  // Auto-focus the textarea and initialize quick prompts
  window.setTimeout(() => {
    textarea.focus()
    initializeQuickPrompts()
  }, 100)
}
