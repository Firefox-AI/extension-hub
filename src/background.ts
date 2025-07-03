/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT } from '../types'
import { getOpenAIResponse, getLocalAIResponse } from './services/inference'

/**
 * Get AI response for the given prompt and full text.
 * @param data
 * @returns
 */
async function generateResponse(data: { prompt: string; fullText: string }) {
  try {
    const buildPrompt = `answer this question:${data.prompt}, with this data :${data.fullText}`
    console.log('Sending prompt to OpenAI:')
    const result = await getOpenAIResponse(buildPrompt)
    return result
  } catch (err) {
    console.warn('Error generating response:', err)
  }
}

async function generateLocalAIResponse(data: {
  prompt: string
  fullText: string
}) {
  try {
    const buildPrompt = `answer this question:${data.prompt} with the data provided:${data.fullText}`
    console.log('Sending prompt to local AI engine:')
    const result = await getLocalAIResponse(buildPrompt)
    return result
  } catch (err) {
    console.warn('Error generating local AI response:', err)
  }
}

/**
 * Event Listeners
 */
browser.runtime.onMessage.addListener(
  async (message: { type: MessageTypesT; data: any }) => {
    if (message.type === 'analyze_page') {
      const result = await generateResponse(message.data)

      browser.runtime.sendMessage({
        type: 'ai_result',
        result: result,
      })
    }

    if (message.type === 'page_summarize') {
      const result = await generateLocalAIResponse(message.data)

      browser.runtime.sendMessage({
        type: 'page_summarize_result',
        result: result,
      })
    }
  }
)
