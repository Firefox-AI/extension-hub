import { InferenceClient } from '@huggingface/inference'
import { LocalStorageKeys } from '../../const'

export const getHuggingFaceResponse = async (prompt: string) => {
  try {
    const { hugging_face_api_key, hugging_face_model, hugging_face_provider } =
      await browser.storage.local.get([
        LocalStorageKeys.HUGGING_FACE_API_KEY,
        LocalStorageKeys.HUGGING_FACE_MODEL,
        LocalStorageKeys.HUGGING_FACE_PROVIDER,
      ])

    const client = new InferenceClient(hugging_face_api_key || '')

    const response = await client.chatCompletion({
      model: hugging_face_model || 'meta-llama/Llama-3.1-8B-Instruct',
      provider: hugging_face_provider || 'auto',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Answering this question to the best of your ability, try and only used the context provided with the question. If the information is not present in the context say you do not know. If you are asked to define words it is ok to user other data you know.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const content = response.choices[0].message.content
    return content
  } catch (error) {
    console.error('Error fetching Hugging Face response:', error)
  }
}
