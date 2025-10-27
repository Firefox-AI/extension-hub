import { assistantService, assistantStore } from './assistant'
import type { ChatMessage } from './utilsOpenAI'
import { get_current_tab, get_insights, get_weather_location } from './assistantTools'

export const defaultSystemPrompt = `You are a very knowledgeable personal browser assistant, designed to assist the user in navigating the web. You will be provided with a list of browser tools that you can use whenever needed to aid your response to the user.

Your internal knowledge cutoff date is: July, 2024.

# Tool Call Rules

Always follow the following tool calling rules restrictly and ignore other tool call rules if exists:
- If a tool call is inferred and needed, only return the most relevant one given the conversation context.
- Ensure all required parameters are filled and valid according to the tool schema.
- You should never use @get_page_content on the same URL within the same conversation, use the content retrieved earlier directly.
- Do not make up data, especially URLs, in ANY tool call arguments or responses. All your URLs must come from current tab, opened tabs and retrieved histories.
- Raw output of the tool call is not visible to the user, in order to keep the conversation smooth and reasonable, you should always provide a snippet of the output in your response (for example, show the @search_history or @get_tabs outputs along with your reply to provide contexts to the user whenever makes sense).

# Web Search (@search_engine) Rules

USE @search_engine ONLY IF:
- The user requests up-to-date or beyond knowledge cutoff date information (news, recent facts, live scores, prices, laws, versions), or
- The answer requires exact quotes/citations, or
- The query names an entity you explicitly do not know.

DO NOT USE @search_engine IF:
- The request is definitional, evergreen, or solvable from general knowledge before knowledge cutoff date.
- The user asked you not to browse.

# Insights and Personalization Rules

When responding to the user, if you use any user insights from the list below to personalize your response (even implicitly), you must reference them by including §insight: specific term§ inline, directly after the phrase or sentence where the insight is applied.
Use exact terms from the list rather than broad categories, and include multiple tags if multiple insights are relevant.
This enables better personalization features — do not skip tagging if an insight influences your answer.
Only tag insights that you actually used to PERSONALIZE the response instead of it simply being mentioned in the response (i.e. while summarizing a news article or something objective), avoid tagging irrelevant ones.

Examples of Insight Tagging:
- User asks about flights: Weave in personalization like "Since you often fly from SJC §insight: SJC§, consider direct options..."
- User asks about meals: "This recipe fits your interest in cooking pattern §insight: seasonal cooking§ and healthy recipes §insight: healthy recipes§:..."
- User asks about shoes: "For hiking boots, check REI §insight: REI§ based on your outdoor gear research §insight: outdoor gear§."

{title_prompt}
User insights:
{insights}

# Real Time & User Information

Today's date: {today}
User's location: {city}
The user is currently viewing this tab page: {current_tab}`

const titleGenerationRules = `
# Title Generation Rules

At the start of your response, you must create a concise title for the conversation based on the user's message. 
The title should be less than 6 words and should reflect the main topic or intent of the user's message. 
Do not end with punctuation (no period, question mark, etc.). Do not generate questions as titles.

Format the title as follows: §title: title§`

function fillPrompt(
  prompt: string,
  tab: any | null,
  insights: string,
  city: string,
) {
  const tabJson = tab ? JSON.stringify(tab) : 'null'
  const today = new Date().toISOString().slice(0, 10)
  return prompt
    .replace('{current_tab}', tabJson)
    .replace('{today}', today)
    .replace('{insights}', insights)
    .replace('{city}', city || 'Unknown')
}

function ensureSystem(
  messages: ChatMessage[],
  tab: any | null,
  insights: string,
  city: string,
  isFirstUserMessage: boolean = false,
): ChatMessage[] {
  if (!messages.length || messages[0].role !== 'system') {
    let promptToUse = defaultSystemPrompt
    // Add title generation rules only for the first user message
    if (isFirstUserMessage) {
      promptToUse = defaultSystemPrompt .replace('{title_prompt}', titleGenerationRules)
    }
    const content = fillPrompt(promptToUse, tab, insights, city)
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

  // Resolve city+country from privileged API (may be null)
  let city = 'Unknown'
  try {
    const loc = await get_weather_location()
    const c = (loc?.city || '').trim()
    const cc = ((loc?.countryCode || loc?.country) || '').trim()
    if (c && cc) city = `${c}, ${cc}`
    else if (c) city = c
    else if (cc) city = cc
  } catch (_) {
    city = 'Unknown'
  }

  // Check if this is the first user message (only user message so far)
  const allMessages = assistantStore.getAll()
  const userMessageCount = allMessages.filter(m => m.role === 'user').length
  const isFirstUserMessage = userMessageCount === 1
  console.log('[assistant] isFirstUserMessage:', allMessages)

  const messages = ensureSystem(assistantStore.getAll(), tab ?? null, insightsText, city, isFirstUserMessage)

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

// Streaming variant: emits deltas via callbacks and does NOT append the assistant
// message to the store (UI will manage incremental rendering and final append).
export async function sendAndStream(
  userText: string,
  handlers: { onDelta?: (text: string) => void; onEnd?: (finalText: string) => void } = {},
) {
  await assistantStore.load()
  const tab = await get_current_tab({})
  let insightsText = '[]'
  try {
    const insights = await get_insights()
    insightsText = JSON.stringify(insights)
  } catch (e) {
    insightsText = '[]'
  }

  const userMessage: ChatMessage = { role: 'user', content: userText }
  await assistantStore.append(userMessage)

  let city = 'Unknown'
  try {
    const loc = await get_weather_location()
    const c = (loc?.city || '').trim()
    const cc = ((loc?.countryCode || loc?.country) || '').trim()
    if (c && cc) city = `${c}, ${cc}`
    else if (c) city = c
    else if (cc) city = cc
  } catch (_) {
    city = 'Unknown'
  }

  // Check if this is the first user message (only user message so far)
  const allMessages = assistantStore.getAll()
  const userMessageCount = allMessages.filter(m => m.role === 'user').length
  const isFirstUserMessage = userMessageCount === 1

  const messages = ensureSystem(assistantStore.getAll(), tab ?? null, insightsText, city, isFirstUserMessage)
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

  const finalText = await assistantService.sendStream(modifiedForSend, handlers)
  return finalText
}
