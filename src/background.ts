/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT } from '../types'
import { getOpenAIResponse } from './services/openai'
import { getMlEngineAIResponse } from './services/mlEngine'
import { getLocalModelResponse } from './services/localModel'
import { getTogeatherAIResponse } from './services/togetherai'
import {
  getHuggingFaceResponse,
  getHuggingFaceChatResponse,
} from './services/huggingface'
import { getPlannerResponse } from './services/planner'
import initContextMenus from './contextMenu'
import { summarizeTabs } from './services/browserHistory'
import { initEnvironment } from './systemConfig'

browser.runtime.onInstalled.addListener(() => {
  browser.menus.removeAll().then(() => {
    // Initialize context menus
    initContextMenus()
  })
  initEnvironment()
})

/**
 * Get AI response for the given prompt and full text.
 * @param data
 * @returns
 */

const buildPrompt = (prompt: string, textContent: string) => {
  return `answer this question:${prompt}, with this data :${textContent}`
}

/**
 * Event Listeners
 */
browser.runtime.onMessage.addListener(
  async (message: { type: MessageTypesT; data: any }) => {
    console.log('[BG] Received message:', message)
    // TODO - probably need to diversify prompts based on type of request
    // const prompt = buildPrompt(message.data.prompt, message.data.textContent)

    if (message.type === 'page_qa') {
      const prompt = buildPrompt(message.data.prompt, message.data.textContent)
      const result = await getOpenAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const prompt = buildPrompt(message.data.prompt, message.data.textContent)
      const result = await getMlEngineAIResponse(prompt)
      // const result = await getLocalModelResponse(prompt)
      // const result = await getHuggingFaceResponse(prompt)
      browser.runtime.sendMessage({
        type: 'page_summarize_result',
        result: result,
        prompt: message.data.prompt,
        url: message.data.url,
        siteName: message.data.siteName,
      })
    }

    if (message.type === 'tab_summarize') {
      const prompt = buildPrompt(message.data.prompt, message.data.textContent)
      const result = await summarizeTabs(prompt)
      browser.runtime.sendMessage({
        type: 'tab_summarize_result',
        result: result,
      })
    }

    if (message.type === 'chat_message') {
      const result = await getHuggingFaceChatResponse(message.data)
      browser.runtime.sendMessage({
        type: 'chat_message_result',
        result: result,
      })
    }
    
    /* Planner
     */
    if (message.type === 'planner') {
      // Initial planner request
      const result = await getPlannerResponse(message.data.goal, message.data.type, false)
      browser.runtime.sendMessage({
        type: 'planner_result',
        result,
      })
      return true
    }

    if (message.type === 'planner_followup') {
      // Follow-up input, continue conversation
      const result = await getPlannerResponse(message.data.followup, message.data.type, true)
      browser.runtime.sendMessage({
        type: 'planner_result',
        result,
      })
      return true
    }
  }
)
