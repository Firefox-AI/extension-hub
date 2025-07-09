import { LocalStorageKeys } from '../../const'

// Note if you are using Ollama you may need to set the CORS headers
// see this article on how to do it: https://medium.com/dcoderai/how-to-handle-cors-settings-in-ollama-a-comprehensive-guide-ee2a5a1beef0
export const getLocalModelResponse = async (
  prompt: string
): Promise<string> => {
  try {
    const { local_model_url, local_model_name } =
      await browser.storage.local.get([
        LocalStorageKeys.LOCAL_MODEL_URL,
        LocalStorageKeys.LOCAL_MODEL_NAME,
      ])

    if (!local_model_url || local_model_name === '') {
      return 'Local model URL is not set. Please configure it in the extension settings.'
    }

    const response = await fetch(local_model_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: local_model_name,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.message?.content || 'No response from local model.'
  } catch (error) {
    console.error('Error fetching local model response:', error)
    return 'An unexpected error occurred while contacting the local model.'
  }
}
