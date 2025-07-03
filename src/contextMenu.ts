export enum ContextMenuIds {
  TEXT_SELECTION = 'text-selection',
  TEXT_SELECTION_SUMMARIZATION = 'text-selection-summarization',
}

const initConextMenus = () => {
  // Create a context menu item for text selection
  browser.menus.create({
    id: ContextMenuIds.TEXT_SELECTION,
    title: 'Send Text to Extension Hub',
    contexts: ['selection'],
  })

  // Create a context menu item for summarizing selected text
  browser.menus.create({
    id: ContextMenuIds.TEXT_SELECTION_SUMMARIZATION,
    title: 'Summarize Selected Text',
    contexts: ['selection'],
  })
}

export default initConextMenus
