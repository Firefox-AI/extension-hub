/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageTypesT } from '../types'
import { getOpenAIResponse } from './services/inference'

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
  }
)
