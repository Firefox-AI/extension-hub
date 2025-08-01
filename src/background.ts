/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT, MessagePageAssistT } from '../types'
import { getPageQandAResponse } from './services/pageQandA'
import { getPageAssistResponse } from './services/pageAssist'
import { getHuggingFaceChatResponse } from './services/huggingface'
import { getPlannerResponse} from './services/planner'
import initContextMenus from './contextMenu'
import { summarizeTabs } from './services/browserHistory'
import { getPlanResponse } from './services/plan-checklist'
import { pageLauncher } from './services/pageLauncher'
import { initEnvironment } from './systemConfig'

browser.runtime.onInstalled.addListener(() => {
  browser.menus.removeAll().then(() => {
    // Initialize context menus
    initContextMenus()
  })
  initEnvironment()
})

/**
 * Event Listeners
 */
browser.runtime.onMessage.addListener(
  async (message: { type: MessageTypesT; data: any }) => {
    console.log('[BG] Received message:', message)

    if (message.type === 'page_qa') {
      const result = await getPageQandAResponse(message.data.prompt, message.data.textContent)

      browser.runtime.sendMessage({
        type: 'page_qa_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const result = await getPageAssistResponse(
        message.data as MessagePageAssistT,
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
      const result = await summarizeTabs(message.data.prompt, message.data.textContent)

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

    if (message.type === 'plan_check_request') {
      const result = await getPlanResponse(message.data)
      browser.runtime.sendMessage({
        type: 'plan_check_result',
        result: result,
      })
    }

    if (message.type === 'pages_open') {
      // this could scale to pass a param to say what page to open?
      pageLauncher()
    }
  },
)
