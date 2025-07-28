import { TabsCollectionT } from '../../types'
import { getOpenAIResponse } from './openai'

export type PlannerType = 'trip' | 'shopping' | 'party' | 'generic'

export type PlanItemT = {
  completed: boolean
  id: string
  searchQuery?: string
  text: string
}

export type PlanDataT = {
  customPrompt?: string
  plannerType: PlannerType
  tabSet: keyof TabsCollectionT
}

export type PlanResultT = {
  explanation: string
  items: PlanItemT[]
}

export type PlanRequestMessageData = {
  planData: PlanDataT
  tabsContent: string
  existingPlan?: PlanResultT
}

export const PLANNER_PROMPTS = {
  trip: 'Create a detailed trip itinerary and planning checklist',
  shopping: 'Create a comprehensive shopping plan and checklist',
  party: 'Create a detailed party planning checklist and timeline',
  generic: 'Create a comprehensive plan and checklist',
}

const buildPlanPrompt = (
  planData: PlanDataT,
  tabsContent: string,
  existingPlan?: PlanResultT
) => {
  let prompt = PLANNER_PROMPTS[planData.plannerType]

  if (planData.customPrompt) {
    prompt += `. Additional instructions: ${planData.customPrompt}`
  }

  if (existingPlan) {
    const completedItems = existingPlan.items.filter((item) => item.completed)
    const pendingItems = existingPlan.items.filter((item) => !item.completed)

    prompt += `\n\nThis is an UPDATE to an existing plan. Here's the original plan context:\n\nORIGINAL PLAN: "${
      existingPlan.explanation
    }"\n\nCOMPLETED ITEMS (preserve these unless truly obsolete):\n${completedItems
      .map((item) => `- ${item.text}`)
      .join('\n')}\n\nPENDING ITEMS:\n${pendingItems
      .map((item) => `- ${item.text}`)
      .join(
        '\n'
      )}\n\nIMPORTANT:\n- Keep all completed items unless they're truly no longer relevant\n- Update pending items based on the new browser tabs context\n- Add new relevant items if the updated tabs suggest additional tasks\n- Maintain the overall plan coherence while incorporating new information\n- Focus on providing updated next steps and refined task descriptions`
  } else {
    prompt +=
      '. Provide both an explanation/overview and a structured list of actionable items.'
  }

  return `${prompt}\n\nBased on these browser tabs:\n${tabsContent}\n\nReturn the response in this JSON format:\n{\n  "explanation": "A clear explanation of the plan and approach",\n  "items": [\n    {\n      "id": "unique-id",\n      "text": "Actionable item description",\n      "completed": false,\n      "searchQuery": "relevant google search query"\n    }\n  ]\n}`
}

// Helper function for smarter item matching
const findMatchingItem = (
  newItem: PlanItemT,
  existingItems: PlanItemT[]
): PlanItemT | null => {
  // Strategy 1: Exact text match
  let match = existingItems.find(
    (existing) =>
      existing.text.toLowerCase().trim() === newItem.text.toLowerCase().trim()
  )
  if (match) return match

  // Strategy 2: Strong substring match (both directions, 50%+ overlap)
  match = existingItems.find((existing) => {
    const existingText = existing.text.toLowerCase()
    const newText = newItem.text.toLowerCase()
    const minLength = Math.min(existingText.length, newText.length)
    const overlapThreshold = Math.max(minLength * 0.5, 20)

    return (
      existingText.includes(newText.substring(0, overlapThreshold)) ||
      newText.includes(existingText.substring(0, overlapThreshold))
    )
  })
  if (match) return match

  // Strategy 3: Keyword-based matching
  const getKeywords = (text: string) =>
    text
      .toLowerCase()
      .split(/[\s\-_.,!?;:()[\]{}]+/)
      .filter((word) => word.length > 3)
      .slice(0, 5) // Top 5 keywords

  const newKeywords = getKeywords(newItem.text)
  match = existingItems.find((existing) => {
    const existingKeywords = getKeywords(existing.text)
    const commonKeywords = newKeywords.filter((keyword) =>
      existingKeywords.includes(keyword)
    )
    return commonKeywords.length >= 2 // At least 2 common keywords
  })

  return match || null
}

export const processPlanRequest = async (
  planData: PlanDataT,
  tabsContent: string,
  existingPlan?: PlanResultT
): Promise<PlanResultT> => {
  const planPrompt = buildPlanPrompt(planData, tabsContent, existingPlan)
  const aiResponse = await getOpenAIResponse({
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Answering this question to the best of your ability, try and only use the context provided with the question. If the information is not present in the context say you do not know.',
      },
      { role: 'user', content: planPrompt },
    ],
  })

  let planResult: PlanResultT
  try {
    const rawResponse = aiResponse.choices[0].message.content
    const cleanedResponse = rawResponse
      .trim()
      .replace(/^```json\s*|```$/g, '') // remove code fences
      .replace(/[“”]/g, '"') // fix smart quotes if present
      .replace(/[^\x20-\x7E\s\n\r\t{}[\]":,.-]/g, '') // strip any weird Unicode control chars

    planResult = JSON.parse(cleanedResponse) as PlanResultT
    // Ensure each item has a unique ID and proper fields
    planResult.items = planResult.items.map((item, index) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${index}`,
      completed: item.completed || false,
      searchQuery: item.searchQuery || undefined,
    }))

    // Enhanced merging logic for updates
    if (existingPlan) {
      const existingItems = existingPlan.items
      const existingCompleted = existingItems.filter((item) => item.completed)
      const existingPending = existingItems.filter((item) => !item.completed)

      // Process each new item with smarter matching
      planResult.items = planResult.items.map((newItem) => {
        const matchingCompleted = findMatchingItem(newItem, existingCompleted)
        const matchingPending = findMatchingItem(newItem, existingPending)

        if (matchingCompleted) {
          // Keep completed status and preserve original ID
          return {
            ...newItem,
            id: matchingCompleted.id,
            completed: true,
          }
        } else if (matchingPending) {
          // Update pending item but preserve ID
          return {
            ...newItem,
            id: matchingPending.id,
            completed: false,
          }
        }

        // This is a new item, keep AI's suggestion
        return newItem
      })

      // Always preserve completed items that weren't matched/updated
      const newItemIds = planResult.items.map((item) => item.id)
      existingCompleted.forEach((existing) => {
        if (!newItemIds.includes(existing.id)) {
          // Add back unmatched completed items
          planResult.items.push({
            ...existing,
            // Mark as potentially outdated but keep completed
            text: existing.text + ' (from previous plan)',
          })
        }
      })
    }
  } catch (parseError) {
    // Fallback if JSON parsing fails
    console.error('Error parsing AI response:', parseError)
    planResult = {
      explanation: aiResponse.choices[0]?.message?.content || 'Error generating plan',
      items: [],
    }
  }

  return planResult
}

export const getPlanResponse = async (
  messageData: PlanRequestMessageData
): Promise<PlanResultT> => {
  try {
    const { planData, tabsContent, existingPlan } = messageData
    return await processPlanRequest(planData, tabsContent, existingPlan)
  } catch (error) {
    console.error('Error processing plan request:', error)
    return {
      explanation:
        'Sorry, there was an error generating your plan. Please try again.',
      items: [],
    }
  }
}
