export function detectQueryType(query: string): string {
  const trimmedQuery = query.trim().toLowerCase()

  // URL detection: starts with http/https or contains protocol-like patterns
  if (
    /^https?:\/\//.test(trimmedQuery) ||
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

export function customView(window: any, context: any, apiInstance: any): void {
  console.log(
    'Custom view function triggered for AI mode page',
    window.gBrowser.selectedTab.label,
    detectQueryType('test'),
  )
}
