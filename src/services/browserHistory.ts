/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { getTogeatherAIResponse } from './togetherai'
import { MessageSummarizeTabsT } from '../../types'

const buildPrompt = (prompt: string, textContent: string) => {
  return `answer this question:${prompt}, with this data :${textContent}`
}

export const summarizeTabs = async (
  summarizeTabsData: MessageSummarizeTabsT,
) => {
  const prompt = buildPrompt(
    summarizeTabsData.prompt,
    summarizeTabsData.textContent,
  )

  // Dive more into the conifguration options here:
  const items = await browser.history.search({
    text: '',
    startTime: 0,
    maxResults: 200,
  })

  const formattedPrompt = `Use the following data of recently used tabs : ${JSON.stringify(
    items,
  )} to answer the following prompt: ${prompt}.`

  return getTogeatherAIResponse(formattedPrompt)
}
