/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT, MessagePageAssistT } from '../types'
import { getPageQandAResponse } from './services/pageQandA'
import { getPageAssistResponse } from './services/pageAssist'
import { getHuggingFaceChatResponse } from './services/huggingface'
import initContextMenus from './contextMenu'
import { summarizeTabs } from './services/browserHistory'
import { getPlanResponse } from './services/plan-checklist'
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
    // TODO - probably need to diversify prompts based on type of request, may need to
    // set the patter to send textContent and prompt separately into each unique service
    const prompt = buildPrompt(message.data.prompt, message.data.textContent)

    if (message.type === 'page_qa') {
      const result = await getPageQandAResponse(prompt)

      browser.runtime.sendMessage({
        type: 'page_qa_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const result = await getPageAssistResponse(
        message.data as MessagePageAssistT
      )

      browser.runtime.sendMessage({
        type: 'page_summarize_result',
        result: result,
        prompt: message.data.prompt,
        url: message.data.url,
        siteName: message.data.siteName,
      })
    }

    if (message.type === 'tab_summarize') {
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

    if (message.type === 'plan_check_request') {
      const result = await getPlanResponse(message.data)
      browser.runtime.sendMessage({
        type: 'plan_check_result',
        result: result,
      })
    }
  }
)
