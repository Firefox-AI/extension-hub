/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT, MessagePageAssistT } from '../types'
import { getPageQandAResponse } from './services/pageQandA'
import { getPageAssistResponse } from './services/pageAssist'
import { getHuggingFaceChatResponse } from './services/huggingface'
import { getPlannerResponse } from './services/planner'
import initContextMenus from './contextMenu'
import { summarizeTabs } from './services/browserHistory'
import { getPlanResponse } from './services/plan-checklist'
import { pageLauncher } from './services/pageLauncher'
import { initEnvironment } from './systemConfig'

// Message handler type definition
type MessageHandler = (data: any) => Promise<void> | void

// Message handlers object
const messageHandlers: Partial<Record<MessageTypesT, MessageHandler>> = {
  page_qa: async (data) => {
    const result = await getPageQandAResponse(data.prompt, data.textContent)
    browser.runtime.sendMessage({
      type: 'page_qa_result',
      result: result,
    })
  },

  page_summarize: async (data) => {
    const result = await getPageAssistResponse({
      prompt: data.prompt,
      textContent: data.textContent,
    })
    browser.runtime.sendMessage({
      type: 'page_summarize_result',
      result: result,
      prompt: data.prompt,
      url: data.url,
      siteName: data.siteName,
    })
  },

  tab_summarize: async (data) => {
    const result = await summarizeTabs({
      prompt: data.prompt,
      textContent: data.textContent,
    })
    browser.runtime.sendMessage({
      type: 'tab_summarize_result',
      result: result,
    })
  },

  chat_message: async (data) => {
    const result = await getHuggingFaceChatResponse(data)
    browser.runtime.sendMessage({
      type: 'chat_message_result',
      result: result,
    })
  },

  planner: async (data) => {
    // Initial planner request
    const result = await getPlannerResponse(data.goal, data.type, false)
    browser.runtime.sendMessage({
      type: 'planner_result',
      result,
    })
  },

  planner_followup: async (data) => {
    // Follow-up input, continue conversation
    const result = await getPlannerResponse(data.followup, data.type, true)
    browser.runtime.sendMessage({
      type: 'planner_result',
      result,
    })
  },

  plan_check_request: async (data) => {
    const result = await getPlanResponse(data)
    browser.runtime.sendMessage({
      type: 'plan_check_result',
      result: result,
    })
  },

  pages_open: (data) => {
    pageLauncher(data.page)
  },
}

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

    const handler = messageHandlers[message.type]
    if (handler) {
      await handler(message.data)

      // Return true for async handlers that need to keep the message port open
      if (message.type === 'planner' || message.type === 'planner_followup') {
        return true
      }
    } else {
      console.warn(`[BG] Unknown message type: ${message.type}`)
    }
  },
)
