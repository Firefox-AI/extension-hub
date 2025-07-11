export enum LocalStorageKeys {
  // UI
  CURRENT_FEATURE = 'current_feature',
  LAST_TAB_SUMMARIZATION = 'last_tab_summarization',
  LAST_QUESTION_ANSWER = 'last_question_answer',

  // Hugging Face
  HUGGING_FACE_API_KEY = 'hugging_face_api_key',
  HUGGING_FACE_MODEL = 'hugging_face_model',
  HUGGING_FACE_PROVIDER = 'hugging_face_provider',
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

  // Page Summarization
  LAST_PAGE_SUMMARIZATION = 'last_page_summarization',
  LAST_PAGE_SUMMARIZATION_PROMPT = 'last_page_summarization_prompt',
  MOCK_SUMMARY_DATABASE = 'mock_summary_database',
}

export enum SessionStorageKeys {
  ENGINE_CREATED = 'engine_created',
}
