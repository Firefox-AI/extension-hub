/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { getTogeatherAIResponse } from './togetherai'

export const summarizeTabs = async (prompt: string) => {
  // Dive more into the conifguration options here:
  const items = await browser.history.search({
    text: '',
    startTime: 0,
    maxResults: 200,
  })

  const formattedPrompt = `Use the following data of recently used tabs : ${JSON.stringify(
    items
  )} to answer the following prompt: ${prompt}.`

  return getTogeatherAIResponse(formattedPrompt)
}
