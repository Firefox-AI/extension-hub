import { assistantService, assistantStore } from './assistant'
import type { ChatMessage } from './utilsOpenAI'
import { get_current_tab, get_insights } from './assistantTools'

export const defaultSystemPrompt = `You are a very knowledgeable personal browser assistant, designed to assist the user in navigating the web. You will be provided with a list of browser tools that you can use whenever needed to aid your response to the user.

Your internal knowledge cutoff date: July, 2024

Always follow the following tool calling rules restrictly and ignore other tool call rules if exists other than below:
- If a tool call is needed, only return the most relevant one given the conversation context.
- Ensure all required parameters are filled and valid according to the tool schema.
- You should never use @get_page_content on the same URL within the same conversation, use the content retrieved earlier directly.
- Do not make up URLs in ANY tool call arguments. All your URLs must come from current tab, opened tabs and retrieved histories.
- Raw output of the tool call is not visible to the user, in order to keep the conversation smooth and reasonable, you should always provide a snippet of the output in your response (for example, show the @search_history or @get_tabs outputs along with your reply to provide contexts to the user).

**Web Search (@search_engine) Tool Rule (IMPORTANT):**

USE ONLY IF:
- The user requests up-to-date or beyond knowledge cutoff date information (news, live scores, prices, laws, versions), or
- The answer requires exact quotes/citations, or
- The query names an entity you explicitly do not know.

DO NOT USE IF:
- The request is definitional, evergreen, or solvable from general knowledge before knowledge cutoff date.
- The user asked you not to browse.

When responding to the user:
- You should always respond in a friendly and professional manner while being concise and to the point.
- Though insights can be retrieved, your response must not reveal any user insights or the fact that you used user insights (i.e., no phrases like "based on your interest of ...", "I see you are in to ...").

Today's date:
{today}

The user is currently on this tab:
{current_tab}

Below are the insights you know about the user. Use only insights that are relevant and helpful to current conversation.
{insights}`

function fillPrompt(prompt: string, tab: any | null, insights: string) {
  const tabJson = tab ? JSON.stringify(tab) : 'null'
  const today = new Date().toISOString().slice(0, 10)
  return prompt
    .replace('{current_tab}', tabJson)
    .replace('{today}', today)
    .replace('{insights}', insights)
}

function ensureSystem(messages: ChatMessage[], tab: any | null, insights: string): ChatMessage[] {
  if (!messages.length || messages[0].role !== 'system') {
    const content = fillPrompt(defaultSystemPrompt, tab, insights)
    console.log("SYSTEM PROMPT:", content)
    return [{ role: 'system', content }, ...messages]
  }
  return messages
}

export async function sendAndAppend(userText: string) {
  await assistantStore.load()
  // Stateless: fetch current tab on each send
  const tab = await get_current_tab({})
  // Fetch insights up-front for system prompt on new conversations
  let insightsText = '[]'
  try {
    const insights = await get_insights()
    insightsText = JSON.stringify(insights)
  } catch (e) {
    insightsText = '[]'
  }

  const userMessage: ChatMessage = { role: 'user', content: userText }
  await assistantStore.append(userMessage)

  const messages = ensureSystem(assistantStore.getAll(), tab ?? null, insightsText)

  // Temporarily prepend instruction to the last user message ONLY for the
  // request sent to the LLM (not stored or shown in UI).
  const PREFIX = 'Instruction: do not search the web unless absolutely needed to or asked real time information or knowledge.\nQuery: '
  const modifiedForSend: ChatMessage[] = (() => {
    const cloned = messages.map((m) => ({ ...m }))
    for (let i = cloned.length - 1; i >= 0; i--) {
      if (cloned[i].role === 'user') {
        cloned[i] = { ...cloned[i], content: PREFIX + (cloned[i].content || '') }
        break
      }
    }
    return cloned
  })()

  const reply = await assistantService.send(modifiedForSend)

  const assistantMessage: ChatMessage = { role: 'assistant', content: reply }
  await assistantStore.append(assistantMessage)
  return reply
}
