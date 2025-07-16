export type mlBrowserT = {
  extensionHub: {
    getTabs: () => Promise<TabsCollectionT>
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
    group: (options: { tabIds: number[] }) => Promise<number>
  }
  tabGroups: {
    update: (
      id: number,
      options: { title: string; color: string }
    ) => Promise<void>
  }
}

export type MessageTypesT =
  | 'page_qa'
  | 'ai_result'
  | 'page_summarize'
  | 'page_summarize_result'
  | 'tab_summarize'
  | 'tab_summarize_result'
  | 'chat_message'
  | 'chat_message_result'

export type PromptDataT = {
  prompt: string
  fullText: string
}

export type EngineMetadataT = {
  taskName: string
  modelHub: string
  modelId: string
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
