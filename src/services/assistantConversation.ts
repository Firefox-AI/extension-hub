import { assistantService, assistantStore, ChatMessage } from './assistant'
import { get_current_tab } from './assistantTools'

export const defaultSystemPrompt = `You are a personal browser assistant, designed to assist the user in navigating the web. You are provided with a list of browser tools that you can use whenever needed to aid your response to the user.

Always follow the following tool calling rules:
1. If a tool call is needed, only return the most relevant one given the conversation context,
2. Ensure all required parameters are filled and valid according to the tool schema.
3. Do not make up URLs in ANY tool call arguments. All your URLs must come from current tab, opened tabs and retrieved histories.
4. Raw output of the tool call is not visible to the user, in order to keep the conversation smooth and reasonable, you should always provide a snippet of the output in your response (for example, show the @search_history or @get_tabs outputs along with your reply to provide contexts to the user).
5. You should use @get_insights wherever makes sense to provide tailored responses.
6. You must make the best effort to respond directly with your knowledge or using tools **other than** @search_engine. Treat @search_engine as the last resort if you can't answer with provided context and your knowledge.

When responding to the user:
- You should always respond in a friendly and professional manner while being concise and to the point.
- Though insights can be retrieved, your response must not reveal that you used insights.
- Whenever you are going to suggest a search or look up for the user as a response, use the @search_engine tool instead of using natural language response.

The user is currently on this tab:
{current_tab}`

function fillCurrentTab(prompt: string, tab: any | null) {
  const tabJson = tab ? JSON.stringify(tab) : 'null'
  return prompt.replace('{current_tab}', tabJson).replace('{{current_tab}}', tabJson)
}

function ensureSystem(messages: ChatMessage[], tab: any | null): ChatMessage[] {
  if (!messages.length || messages[0].role !== 'system') {
    const content = fillCurrentTab(defaultSystemPrompt, tab)
    return [{ role: 'system', content }, ...messages]
  }
  return messages
}

export async function sendAndAppend(userText: string) {
  await assistantStore.load()
  // Stateless: fetch current tab on each send
  const tab = await get_current_tab({})

  const userMessage: ChatMessage = { role: 'user', content: userText }
  await assistantStore.append(userMessage)

  const messages = ensureSystem(assistantStore.getAll(), tab ?? null)
  const reply = await assistantService.send(messages)

  const assistantMessage: ChatMessage = { role: 'assistant', content: reply }
  await assistantStore.append(assistantMessage)

  return reply
}
