// src/background/services/planner.ts
import { getOpenAIResponseWithModel, getOpenAIChatResponseWithModel, getOpenAIWebSearchResponse } from './openai'
import { marked } from 'marked'
import { getEmbedding } from './mlEngine'


const OPENAI_SUMMARY_AND_FOLLOWUP_MODEL = 'gpt-4.1-mini'
const OPENAI_REASON_MODEL = 'o4-mini'
const MAX_HISTORY_RETRIEVAL = 50
const HISTORY_SIMILARITY_THRESHOLD = 0.5
const MAX_RELEVANT_HISTORY = 5

/**
 * Stores conversation history for follow-up interactions after initial planning.
 * The history is pre-populated with a system message to set the context and role,
 * and will be populated with the following logic
 * - user-specified goal
 * - summaries from relevant browser history
 * - generated initial plan + a follow-up question (to ask for feedbacks/improvements) to user
 * - back-and-forth conversation with user ...
 */
let conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    {
        "role": 'system',
        "content": `You are a planning assistant that helps users refine and expand a structured plan based on their browsing history and original goal.
The user has already received an initial plan (see below). You are now engaged to handle follow-up questions and requests for changes or additions.

Your responsibilities:
- Understand the user's feedback or questions in the context of the original goal and plan.
- Clearly explain what modifications you are making and why.
- Incorporate the user's requests and make sure you address all their points.
- Ensure feasibility of the updated plan.
- If the user asks vague questions, infer intent reasonably but do not invent unrelated content.
- At the end of your response, always return the **full updated plan** in a complete, structured format, even if the change is minor. This helps the user stay oriented.`
    }
]

/**
 * Main function for planner service.
 
 * Planning Steps:
 * 1. Aggregator: fetch recent browser history
 * 2. Filter: filter for most relevant entries based on user goal
 * 3. Retriever: retrieve the content of selected entries
 * 4. Summarizer: summarize each retrieved content
 * 5. Planner: create plan using reasoning model with user goal and summarized content
 * 6. Formatter: format the plan into a consistent structure for display
 
 * Follow-up Steps:
 * 1. Receive user inputs and answer via a chat model
 */
export async function getPlannerResponse(input: string, type: string, isFollowup: boolean = false): Promise<string> {
  try {

    // initial planning request
    if (!isFollowup) {

        const start = Date.now()
        const tokenUsage: Record<string, { input: number; output: number }> = {
          summarization: { input: 0, output: 0 },
          reasoning: { input: 0, output: 0 },
        }

        console.log(`[planner] Received planner input: type=${type} | input=${input}.`)
        conversationHistory.push({ role: 'user', content: `I want to make a ${type} plan about: ${input}.`})

        // Step 1
        // id, url, title, lastVisitTime etc.
        const historyItems = await browser.history.search({
          text: '',
          startTime: 0,
          maxResults: MAX_HISTORY_RETRIEVAL,
        })
        console.log(`[planner] Retrieved ${historyItems.length} history items.`)

        if (historyItems.length === 0) {
          return 'No relevant browser history found to plan from.'
        }

        // Step 2
        // TODO: remove google search pages since sometimes the search term is in title and affects the ranking.
        console.log(`[planner] Filtering history items based on goal: ${input}`)
        const topicEmbedding = await getEmbedding(input)
        if (!topicEmbedding) {
            throw new Error('Failed to compute topic embedding')
        }

        const historyWithScores = await Promise.all(
        historyItems.map(async (item) => {
            const title = item.title || ''
            const emb = await getEmbedding(title)
            if (!emb) return null
            const score = cosineSimilarity(topicEmbedding, emb)
            return { ...item, score }
        })
        )
        const relevantItems = historyWithScores
          .filter((item): item is typeof historyItems[0] & { score: number } => !!item)
          .filter(item => item.score >= HISTORY_SIMILARITY_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RELEVANT_HISTORY)
        
        // const relevantItems = historyItems.slice(0, MAX_RELEVANT_HISTORY)
        console.log(`[planner] Filtered and kept ${relevantItems.length} relevant history items:`)
        for (const item of relevantItems) {
          console.log(`- ${item.score} - ${item.title} (${item.url})`)
        }
        
        if (relevantItems.length === 0) {
          return 'No relevant pages found matching your goal.'
        }

        // Step 3 & 4
        // TODO: step 3 is to use readability.js for retrieval
        //       currently using OpenAI
        const summaries = await Promise.all(
          relevantItems.map(async (item) => {
            const prompt = `Given the goal of planning '${input}', view ONLY this web page ${item.url} and create a comprehensive summary of the content by keeping all the relevant information.`
            const { content, usage } = await getOpenAIWebSearchResponse(prompt, OPENAI_SUMMARY_AND_FOLLOWUP_MODEL)
            tokenUsage.summarization.input += usage.input_tokens
            tokenUsage.summarization.output += usage.output_tokens
            return `Summary from: ${item.title} (${item.url})\n${content}`
          })
        )
        console.log(`[planner] Retrieved and summaried relevant history items.`)
        // console.log(`[planner] Summary 1: ${summaries[0]}.`)
        conversationHistory.push({ role: 'assistant', content: `The following summaries are created from user's recent relevant browsing history: ${summaries.join('\n\n')}.`})


        // Step 5: Construct planner prompt
        const prompt = constructPlannerPrompt(input, type, summaries)

        // Step 5
        console.log('[planner] Sending planning prompt to OpenAI...')
        const { content, usage } = await getOpenAIResponseWithModel(prompt, OPENAI_REASON_MODEL)
        tokenUsage.reasoning.input += usage.input_tokens
        tokenUsage.reasoning.output += usage.output_tokens
        console.log(`[planner] Received response from OpenAI: ${content}`)
        conversationHistory.push({ role: 'assistant', content: `Below is the initial planning reasoning: ${content}.`})
        const end = Date.now()
        
        console.log('[planner] --- Planning Metrics ---')
        console.log(`[planner] Summarization tokens: input=${tokenUsage.summarization.input}, output=${tokenUsage.summarization.output}`)
        console.log(`[planner] Reasoning tokens: input=${tokenUsage.reasoning.input}, output=${tokenUsage.reasoning.output}`)
        console.log(`[planner] Planning completed in ${((end - start) / 1000).toFixed(2)} seconds.`)

        // Step 6
        return await marked.parse(content)

    } else {
        const start = Date.now()
        const tokenUsage: Record<string, { input: number; output: number }> = {
          followup: { input: 0, output: 0 },
        }

        console.log('[planner] Received followup conversation with:', input)
        console.log('[planner] Sending the request to OpenAI...')
        conversationHistory.push({ role: 'user', content: input })
        // console.log('[planner] Current conversation history:', formatConversationHistory(conversationHistory))
        const { content, usage } = await getOpenAIChatResponseWithModel(formatConversationHistory(conversationHistory), OPENAI_SUMMARY_AND_FOLLOWUP_MODEL)
        tokenUsage.followup.input += usage.input_tokens
        tokenUsage.followup.output += usage.output_tokens
        conversationHistory.push({ role: 'assistant', content: content })
        const end = Date.now()

        console.log('[planner] --- Planning Metrics ---')
        console.log(`[planner] Followup tokens: input=${tokenUsage.followup.input}, output=${tokenUsage.followup.output}`)
        console.log(`[planner] Planning completed in ${((end - start) / 1000).toFixed(2)} seconds.`)

        return await marked.parse(content)
    }

    } catch (err) {
        console.error('[planner] Failed to create planner response:', err)
        return 'An error occurred while generating the plan.'
    }
}


/**
 * Helper Functions
 */

function formatConversationHistory(
  convo: { role: 'system' | 'user' | 'assistant' | string; content: string }[]
): string {
  return convo.map(entry => {
    const label =
      entry.role === 'user'
        ? 'User'
        : entry.role === 'assistant'
        ? 'Assistant'
        : entry.role === 'system'
        ? 'System'
        : `(${entry.role})`
    return `${label}: ${entry.content}`
  }).join('\n\n')
}


export const cosineSimilarity = (a: number[], b: number[]): number => {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
  return dot / (normA * normB)
}


function constructPlannerPrompt(goal: string, type: string, content: string[]): string {
    return `You are a planning assistant generating a clear, structured, and goal-aligned ${type} plan for the following objective:
  
${goal}

The user has already conducted research on this topic, and the following summaries capture relevant information from their browsing activity:

${content.join('\n\n')}

Your task is to use this information to create a thoughtful and feasible plan.

Follow these principles:
- Think step-by-step to break down the user's goal into actionable, logically ordered tasks or activities.
- For each task or activity, consider:
  - Why it directly contributes to achieving the user's goal
  - When it makes the most sense to include it (e.g., time of day, sequence, phase, or dependency)
  - How long it might take or how much effort it requires
  - How it relates to other items in the plan (e.g. overlaps, complementarities, conflicts)
  - If there are conflicts (time, resource, cognitive load), resolve them and explain your reasoning
- Use only the user's summarized research to inform your recommendations — do not invent external content
- Organize the plan into a complete, efficient structure that spans the full scope or time period the user implies
- Be realistic about what can be accomplished based on the plan type (e.g., daily time limits, focus span, preparation time)
- Avoid redundancy, overcommitment, or unnecessary switching between tasks or locations

Once you've reasoned through the structure:
- Present the final plan in a **clean, structured format** (e.g., organized by day, phase, or section)
- Do **not include excessive reasoning, internal thoughts or validations of requirements in the final output** — keep it focused and actionable
- Finally, end with a question asking for user's feedback or if they want to make any changes to the plan.
  `
}