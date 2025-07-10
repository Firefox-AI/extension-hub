export enum LocalStorageKeys {
  // UI
  CURRENT_FEATURE = 'current_feature',
  LAST_PAGE_SUMMARIZATION = 'last_page_summarization',
  LAST_QUESTION_ANSWER = 'last_question_answer',
  LAST_TAB_SUMMARIZATION = 'last_tab_summarization',
  // OpenAI
  OPENAI_API_KEY = 'openai_api_key',
  OPENAI_AI_MODEL = 'openai_ai_model',
  // ML Engine
  ENGINE_METADATA = 'engine_metadata',
  ENGINE_CREATED = 'engine_created',
  IS_LOCAL_AI_ENABLED = 'is_local_ai_enabled',
  // TogeatherAI
  TOGETHERAI_API_KEY = 'togetherai_api_key',
  TOGETHERAI_MODEL = 'togetherai_model',
  // Local Model
  LOCAL_MODEL_URL = 'local_model_url',
  LOCAL_MODEL_NAME = 'local_model_name',

  // Summary Data
  MOCK_SUMMARY_DATABASE = 'mock_summary_database',
}

export enum SessionStorageKeys {
  ENGINE_CREATED = 'engine_created',
}
