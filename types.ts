export type mlBrowserT = {
  trial?: {
    ml: {
      createEngine: (options: any) => Promise<any>
      runEngine: (options: any) => Promise<any>
      deleteCachedModels: () => Promise<void>
    }
  }
}

export type MessageTypesT =
  | 'analyze_page'
  | 'ai_result'
  | 'page_summarize'
  | 'page_summarize_result'

export type PromptDataT = {
  prompt: string
  fullText: string
}

export type EngineMetadataT = {
  taskName: string
  modelHub: string
  modelId: string
}
