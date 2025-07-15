export const initEnvironment = async () => {
  // OpenAI
  const openai_api_key = process.env.OPENAI_API_KEY || ''
  openai_api_key && (await browser.storage.local.set({ openai_api_key }))
  const openai_model = process.env.OPENAI_MODEL || ''
  openai_model && (await browser.storage.local.set({ openai_model }))
  // TogeatherAI
  const togetherai_api_key = process.env.TOGETHERAI_API_KEY || ''
  togetherai_api_key &&
    (await browser.storage.local.set({ togetherai_api_key }))
  const togetherai_model = process.env.TOGETHERAI_MODEL || ''
  togetherai_model && (await browser.storage.local.set({ togetherai_model }))
  // Huggingface
  const hugging_face_api_key = process.env.HUGGINGFACE_API_KEY || ''
  hugging_face_api_key &&
    (await browser.storage.local.set({ hugging_face_api_key }))
  const hugging_face_model = process.env.HUGGINGFACE_MODEL || ''
  hugging_face_model &&
    (await browser.storage.local.set({ hugging_face_model }))
  const hugging_face_provider = process.env.HUGGINGFACE_PROVIDER || ''
  hugging_face_provider &&
    (await browser.storage.local.set({ hugging_face_provider }))
  // ML Engine
  // This is currently set to all or nothing, so all of these need to be set if you want
  // env variables to be used
  const ml_engine_task_name = process.env.ML_ENGINE_TASK_NAME || ''
  const ml_engine_model_hub = process.env.ML_ENGINE_MODEL_HUB || ''
  const ml_engine_model_id = process.env.ML_ENGINE_MODEL_ID || ''
  ml_engine_task_name &&
    ml_engine_model_hub &&
    ml_engine_model_id &&
    (await browser.storage.local.set({
      engine_metadata: {
        taskName: ml_engine_task_name,
        modelHub: ml_engine_model_hub,
        modelId: ml_engine_model_id,
      },
    }))
  // Local Model
  const local_model_url = process.env.LOCAL_MODEL_URL || ''
  local_model_url && (await browser.storage.local.set({ local_model_url }))
  const local_model_name = process.env.LOCAL_MODEL_NAME || ''
  local_model_name && (await browser.storage.local.set({ local_model_name }))
}
