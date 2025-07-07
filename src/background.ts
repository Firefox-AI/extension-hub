/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT } from '../types'
import { getOpenAIResponse } from './services/openai'
import { getLocalAIResponse } from './services/mlEngine'
import { getTogeatherAIResponse } from './services/togetherai'
import initConextMenus from './contextMenu'

/**
 * Get AI response for the given prompt and full text.
 * @param data
 * @returns
 */

const buildPrompt = (prompt: string, fullText: string) => {
  return `answer this question:${prompt}, with this data :${fullText}`
}

const summarizeTabs = async (prompt: string) => {
  // Dive more into the conifguration options here:
  const items = await browser.history.search({
    text: '',
    startTime: 0,
    maxResults: 200,
  })

  const formattedPrompt = `Use the following data of recently used tabs : ${JSON.stringify(
    items
  )} to answer the following prompt: ${prompt}.`

  // You can switch between different AI services here
  // return getOpenAIResponse(formattedPrompt)
  return getTogeatherAIResponse(formattedPrompt)
}

/**
 * Event Listeners
 */
browser.runtime.onMessage.addListener(
  async (message: { type: MessageTypesT; data: any }) => {
    // TODO - probably need to diversify prompts based on type of request
    const prompt = buildPrompt(message.data.prompt, message.data.fullText)

    if (message.type === 'analyze_page') {
      const result = await getTogeatherAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const result = await getTogeatherAIResponse(prompt)
      browser.runtime.sendMessage({
        type: 'page_summarize_result',
        result: result,
      })
    }

    if (message.type === 'tab_summarize') {
      const result = await summarizeTabs(prompt)
      browser.runtime.sendMessage({
        type: 'tab_summarize_result',
        result: result,
      })
    }
  }
)

// Initialize context menus
initConextMenus()
