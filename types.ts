export type SemanticMatchT = {
  title: string
  url?: string
  score?: number
  excerpt?: string
}

export type SemanticMatchResultT = {
  tabs: SemanticMatchT[]
  history: SemanticMatchT[]
  stories: SemanticMatchT[]
}

export type UrlbarSuggestionT = {
  type: 'search' | 'navigate' | 'action'
  text: string
  title?: string
  url?: string
  icon?: string
  description?: string
}

export type mlBrowserT = {
  extensionHub: {
    getTabs: () => Promise<TabsCollectionT>
    semanticTabs: (searchString: string) => Promise<SemanticMatchT[]>
    semanticHistory: (searchString: string) => Promise<SemanticMatchT[]>
    semanticStories: (searchString: string) => Promise<SemanticMatchT[]>
    domainTabs: (domain: string) => Promise<SemanticMatchT[]>
    askChat: (prompt: string) => Promise<void>
    getBoolPref: (prefName: string) => Promise<boolean>
    findInPage: (query: string) => Promise<boolean>
    getUrlbarSuggestions: (searchString: string) => Promise<UrlbarSuggestionT[]>
    setUrlbarRedirect: (enabled: boolean) => Promise<boolean>
    setNewTabOverride: (enabled: boolean) => Promise<boolean>
    setFirefoxViewOverride: (enabled: boolean) => Promise<boolean>
    updateUIForAIMode: (enabled: boolean) => Promise<boolean>
    getLastFocusedUrl: () => Promise<string | null>
    closeSidebar: () => Promise<boolean>
  }
  trial?: {
    ml: {
      createEngine: (options: any) => Promise<any>
      runEngine: (options: any) => Promise<any>
      deleteCachedModels: () => Promise<void>
      onProgress: {
        addListener: (callback: (data: any) => void) => void
      }
    }
  }
  tabs: {
    query: (options: {
      currentWindow: boolean
    }) => Promise<Array<{ id?: number; url?: string }>>
    group: (options: { tabIds: number[]; groupId?: number }) => Promise<number>
  }
  tabGroups: {
    update: (
      id: number,
      options: { title: string; color: string },
    ) => Promise<void>
  }
}

export type MessageTypesT =
  | 'page_qa'
  | 'page_qa_result'
  | 'page_summarize'
  | 'page_summarize_result'
  | 'plan_check_request'
  | 'plan_check_result'
  | 'tab_summarize'
  | 'tab_summarize_result'
  | 'chat_message'
  | 'chat_message_result'
  | 'pages_open'
  | 'planner'
  | 'planner_result'
  | 'planner_followup'
  | 'aimode_search_action'

export type PromptDataT = {
  prompt: string
  fullText: string
}

// Add to this type as needed
export type EngineMetadataT = {
  taskName: string
  modelHub?: string
  modelId?: string
  modelFile?: string
  modelHubRootUrl?: string
  modelHubUrlTemplate?: string
  modelRevision?: string
  numContext?: number
  backend?: string
}

export type CurrentSummaryT = {
  prompt: string
  result: string
  url: string
  siteName: string
}

export type SummaryHistoryItemT = CurrentSummaryT & {
  date: string
  id: string
}

export type PageContentT = {
  textContent: string
  siteName: string
  url?: string
}

export enum AIModePersisteceMode {
  PER_TAB_GROUP = 'per_tab_group',
  PER_TAB = 'per_tab',
  PER_WINDOW = 'per_window',
}

export type AIModeMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type AIModeChat = {
  id: string
  messages: AIModeMessage[]
  timestamp: number
  tabId: number
  groupId?: number
  windowId: number
  tabTitle?: string
  tabUrl?: string
}

// Extend browser Tab type to include groupId
declare global {
  namespace browser.tabs {
    interface Tab {
      groupId: number
    }
  }
}

export type TabsT = Array<{
  title: string
  url: string
}>

export type TabsCollectionT = {
  current: TabsT
  recent: TabsT
  smart: TabsT
  smarter: TabsT
  start: TabsT
  tail: TabsT
}

// It's not clear what other values are on this type add as needed
export type PromptT = {
  role: string
  content: string
}

// It's not clear what other values are on this type add as needed
export type RunEngineMetadataT = {
  args?: any
  options?: any
  prompt?: PromptT[]
  nPredict?: number
  skipPrompt?: boolean
}

export type MessagePageAssistT = {
  prompt: string
  textContent: string
}

export type MessageSummarizeTabsT = {
  prompt: string
  textContent: string
}
