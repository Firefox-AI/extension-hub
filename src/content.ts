declare class Readability {
  constructor(docClone: Document)
  parse(): {
    title: string
    byline: string
    content: string
    textContent: string
    length: number
    excerpt: string
    siteName: string
  } | null
}

const onUserPrompt = (prompt: string) => {
  const article = new Readability(document.cloneNode(true) as Document).parse()

  // TODO make a better check for article validity
  if (!article) return

  const { textContent } = article
  const payload = {
    prompt,
    fullText: textContent,
  }

  browser.runtime.sendMessage({
    type: 'analyze_page',
    data: payload,
  })
}

// Handle messages from background script
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'user_prompt') onUserPrompt(msg.prompt)
})

console.log('>>> Content script loaded.')
