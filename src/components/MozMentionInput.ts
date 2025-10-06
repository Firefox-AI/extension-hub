import { LitElement, html, css } from 'lit'

type MentionOptionT = { type: string; value: string; image?: string }

function ellipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

class MozMentionChip extends LitElement {
  option: MentionOptionT = { type: '', value: '' }

  static properties = {
    option: { type: Object },
  }

  render() {
    return html`
      <span class=${`mention ${this.option.type}`} contenteditable="false">
        ${this.option.type === 'tab' && this.option.image
          ? html`<img
              class="favicon"
              src=${this.option.image}
              alt=${this.option.value}
              width="14"
              height="14"
            />`
          : ''}
        ${this.option.type === 'user' ? '@' : ''}
        ${ellipsis(this.option.value, 20)}
      </span>
    `
  }

  static styles = css`
    :host {
      display: inline;
      white-space: nowrap;
      margin: 0;
      padding: 0;
      vertical-align: baseline;
      font-size: 16px;
    }

    .mention {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 4px;
      font-weight: 500;
      padding: 4px;
      line-height: 1;
      margin: 0 -2px;
    }

    .mention.user {
      background: #f9c5fa;
      color: #3a3a3a;
    }

    .mention.tab {
      background: #f9c5fa;
      color: #3a3a3a;
    }
  `
}

customElements.define('mention-chip', MozMentionChip)

/** create the <span class="mention"> chip */
function createMentionChip(option: MentionOptionT): HTMLSpanElement {
  const chip = document.createElement('mention-chip') as MozMentionChip
  chip.option = option
  chip.setAttribute('data-type', option.type)
  chip.setAttribute('data-value', option.value)
  return chip
}

/** create a text node (empty string yields a real node for cursor placement) */
function textNode(string = ''): Text {
  return document.createTextNode(string)
}

/** safely get current Range (if any) */
function currentRange(): Range | null {
  const selection = window.getSelection()
  return selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
}

/** place caret at node/offset */
function setCaret(node: Node, offset: number) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)

  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

const isTextNode = (node: Node | null): node is Text =>
  !!node && node.nodeType === Node.TEXT_NODE

const isElementNode = (node: Node | null): node is HTMLElement =>
  !!node && node.nodeType === Node.ELEMENT_NODE

const isMentionElement = (node: Node | null): node is HTMLElement =>
  !!node && isElementNode(node) && node.nodeName === 'MENTION-CHIP'

const removeDomNode = (node: Node | null): void => {
  node?.parentNode?.removeChild(node)
}

/**
 * Check if there's a mention trigger (@) in the text, this is later used to
 * offset the Range for insertion so the mention chip replaces the trigger+text.
 *
 * @param text
 * @param caretOffset
 * @returns RegExpMatchArray | null
 */
function matchAtTriggerInText(
  text: string,
  caretOffset: number,
): RegExpMatchArray | null {
  // @ then word chars right at the end of the string
  const mentionPattern = /@(\w*)$/
  const before = text.slice(0, caretOffset)
  return before.match(mentionPattern)
}

export class MozMentionInput extends LitElement {
  /** public api */
  placeholder = 'Type some text with @mentions...'
  mentionOptions: MentionOptionT[] = []

  /** internal state */
  private _showMentions = false
  private _onKeyDown!: (e: KeyboardEvent) => void
  private _selectedIndex = -1
  private _filteredMentionOptions: MentionOptionT[] = []

  static properties = {
    placeholder: { type: String },
    mentionOptions: { type: Array },
    _filteredMentionOptions: { type: Array, state: true },
    _selectedIndex: { type: Number, state: true },
    _showMentions: { type: Boolean, state: true },
  }

  private get editableSection(): HTMLDivElement | null {
    return this.renderRoot.querySelector<HTMLDivElement>('.mention-input')
  }

  constructor() {
    super()
    this._filteredMentionOptions = [...this.mentionOptions]
  }

  /** lit: called after first render — safe to touch the shadow DOM */
  firstUpdated() {
    const element = this.editableSection
    if (!element) return

    // keep a stable listener ref for add/remove
    this._onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)
    element.addEventListener('keydown', this._onKeyDown)
  }

  disconnectedCallback(): void {
    const el = this.editableSection
    if (el && this._onKeyDown) {
      el.removeEventListener('keydown', this._onKeyDown)
    }
    super.disconnectedCallback()
  }

  /** Keyboard Handlers */

  handleBackspace(
    event: KeyboardEvent,
    anchorNode: Node,
    anchorOffset: number,
  ) {
    // If caret is on a chip element, remove that chip.
    if (isMentionElement(anchorNode)) {
      event.preventDefault()
      removeDomNode(anchorNode)
      return
    }

    // Case 2: caret is inside a text node at offset 0 — look behind
    if (isTextNode(anchorNode) && anchorOffset === 0) {
      const prevSibling = anchorNode.previousSibling
      if (isMentionElement(prevSibling)) {
        event.preventDefault()
        removeDomNode(prevSibling)
      }
      return
    }

    // Case 3: caret is inside a text node at offset > 0 — look behind the caret
    if (isTextNode(anchorNode) && anchorOffset > 0) {
      const textBeforeCaret = anchorNode.textContent?.slice(0, anchorOffset)
      const emptyPattern = /^$/
      if (!textBeforeCaret?.match(emptyPattern)) {
        return
      }

      const prevSibling = anchorNode.previousSibling
      if (!isMentionElement(prevSibling)) {
        return
      }

      event.preventDefault()
      removeDomNode(prevSibling)

      // Place caret at the start of the current text node
      setCaret(anchorNode, 0)
    }
  }

  handleDelete(event: KeyboardEvent, anchorNode: Node, anchorOffset: number) {
    // If caret is at end of a text node, remove next chip if present.
    if (!isTextNode(anchorNode)) return
    const textContent = anchorNode.textContent ?? ''
    if (anchorOffset !== textContent.length) return

    const nextSibling = anchorNode.nextSibling
    if (!isMentionElement(nextSibling)) return

    event.preventDefault()
    removeDomNode(nextSibling)
  }

  handleArrowDown(event: KeyboardEvent) {
    event.preventDefault()

    if (this._selectedIndex === this._filteredMentionOptions.length - 1) {
      this._selectedIndex = 0
      return
    }

    this._selectedIndex = Math.min(
      this._selectedIndex + 1,
      this._filteredMentionOptions.length - 1,
    )
  }

  handleArrowUp(event: KeyboardEvent) {
    event.preventDefault()

    if (this._selectedIndex === 0) {
      this._selectedIndex = this._filteredMentionOptions.length - 1
      return
    }

    this._selectedIndex = Math.max(this._selectedIndex - 1, 0)
  }

  handleArrowLeft(
    event: KeyboardEvent,
    anchorNode: Node,
    anchorOffset: number,
  ) {
    if (!isTextNode(anchorNode)) return

    // Caret is at the start of a text node
    if (anchorOffset === 0) {
      const prevSibling = anchorNode.previousSibling

      if (isMentionElement(prevSibling)) {
        event.preventDefault()

        // If there's a text node before the chip, place caret there
        const secondSibling = prevSibling.previousSibling
        if (
          secondSibling &&
          isTextNode(secondSibling) &&
          secondSibling.textContent !== null
        ) {
          // const beforeText = prevSibling.previousSibling
          setCaret(secondSibling, secondSibling.textContent.length)
        } else {
          // Otherwise, insert a safe empty text node before the chip
          const text = textNode('')
          prevSibling.parentNode?.insertBefore(text, prevSibling)
          setCaret(text, 0)
        }
      }
    }
  }

  handleArrowRight(
    event: KeyboardEvent,
    anchorNode: Node,
    anchorOffset: number,
  ) {
    if (!isTextNode(anchorNode)) return

    const textContent = anchorNode.textContent ?? ''
    // Caret is at the end of a text node
    if (anchorOffset === textContent.length - 1) {
      const nextSibling = anchorNode.nextSibling

      // If the *next* node is a chip, skip over it
      if (isMentionElement(nextSibling)) {
        event.preventDefault()

        // Place caret in a safe text node after the chip
        if (nextSibling.nextSibling && isTextNode(nextSibling.nextSibling)) {
          setCaret(nextSibling.nextSibling, 0)
        } else {
          // Create a placeholder text node if nothing follows
          const text = textNode('')
          nextSibling.parentNode?.insertBefore(text, nextSibling.nextSibling)
          setCaret(text, 0)
        }
      }
    }
  }

  handleEnter(event: KeyboardEvent) {
    event.preventDefault()

    if (!this._showMentions) {
      this.handleSubmit()
      return
    }

    if (this._selectedIndex >= 0) {
      this.selectMention(this._filteredMentionOptions[this._selectedIndex])
    }
  }

  handleEscape(event: KeyboardEvent) {
    event.preventDefault()
    this._showMentions = false
    this._selectedIndex = -1
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const editableSection = this.editableSection
    if (!editableSection) return

    const selection = window.getSelection()
    const anchorNode = selection?.anchorNode
    const anchorOffset = selection?.anchorOffset ?? 0
    if (!anchorNode) return

    const keyMap: Record<string, () => void> = {
      Backspace: () => this.handleBackspace(event, anchorNode, anchorOffset),
      Delete: () => this.handleDelete(event, anchorNode, anchorOffset),
      ArrowDown: () => this.handleArrowDown(event),
      ArrowUp: () => this.handleArrowUp(event),
      ArrowLeft: () => this.handleArrowLeft(event, anchorNode, anchorOffset),
      ArrowRight: () => this.handleArrowRight(event, anchorNode, anchorOffset),
      Enter: () => this.handleEnter(event),
      Escape: () => this.handleEscape(event),
    }

    keyMap[event.key]?.()
  }

  private getMentionFilterText(): { filterText: string; show: boolean } {
    // toggle mention menu based on "@"
    const selectRange = currentRange()
    let filterText = ''
    let show = false

    // Check if caret is in a text node and there's a mention trigger
    if (selectRange && selectRange.startContainer.nodeType === Node.TEXT_NODE) {
      const match = matchAtTriggerInText(
        selectRange.startContainer.textContent ?? '',
        selectRange.startOffset,
      )
      if (match) {
        show = true
        filterText = match[1] // the captured group after @
      }
    }

    return { filterText, show }
  }

  private handleInput = () => {
    const { filterText, show } = this.getMentionFilterText()

    if (show) {
      // Filter options based on what user typed after @
      this._filteredMentionOptions = this.mentionOptions.filter((option) =>
        option.value.toLowerCase().startsWith(filterText.toLowerCase()),
      )
      this._selectedIndex = this._filteredMentionOptions.length > 0 ? 0 : -1
    } else {
      this._filteredMentionOptions = [...this.mentionOptions]
      this._selectedIndex = -1
    }

    this._showMentions = show
  }

  private handleMentionClick = (e: Event) => {
    // place caret right after the chip
    const target = e.currentTarget as HTMLElement
    e.preventDefault()
    e.stopPropagation()

    // Check if the mention target is trying be placed in between two text nodes
    if (target.nextSibling) {
      setCaret(target.nextSibling, 0)
      return
    }
    // otherwise, insert an empty text node after the chip and place caret there
    const text = textNode('')
    target.parentNode?.insertBefore(text, target.nextSibling)
    setCaret(text, 0)
  }

  private selectMention = (option: MentionOptionT) => {
    const editableSection = this.editableSection
    const selectRange = currentRange()

    if (!editableSection || !selectRange) return

    const container = selectRange.startContainer
    const offset = selectRange.startOffset

    // we only handle insertion when caret lives in a text node
    if (container.nodeType !== Node.TEXT_NODE) return

    const text = container.textContent ?? ''
    const matchRegArray = matchAtTriggerInText(text, offset)

    if (!matchRegArray) return

    const start = offset - matchRegArray[0].length
    const end = offset

    // splice the text node into [before][after], insert chip in between
    const before = text.slice(0, start)
    const after = text.slice(end)

    const parent = container.parentNode
    if (!parent) return

    // replace the original text node with: beforeText, chip, space+afterText
    const beforeNode = before ? textNode(before) : null
    const chip = createMentionChip(option)
    // allow clicking chip to move caret
    chip.addEventListener('click', this.handleMentionClick)

    const afterNode = textNode(after)

    // Replace original text node with beforeNode, chip, and afterNode
    parent.replaceChild(afterNode, container)
    parent.insertBefore(chip, afterNode)
    if (beforeNode) parent.insertBefore(beforeNode, chip)

    // Place caret at the start of the afterNode
    setCaret(afterNode, 0)

    editableSection.focus()
    this._showMentions = false
  }

  private buildSubmissionString(): string {
    const root = this.editableSection!
    let result = ''

    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? ''
        return
      }

      if (isMentionElement(node)) {
        const type = node.getAttribute('data-type') ?? 'user'
        const value = node.getAttribute('data-value') ?? ''
        // inline canonical syntax
        result += `@${type}:${value}`
        return
      }

      node.childNodes.forEach(traverse)
    }

    root.childNodes.forEach(traverse)
    return result.trim()
  }

  private handleSubmit = () => {
    const submission = this.buildSubmissionString()
    console.log('Submitting:', submission)
    // bubble a submit event with the built string
    this.dispatchEvent(
      new CustomEvent('mention-input:submit', {
        detail: { value: submission },
      }),
    )
  }

  render() {
    return html`
      <div class="dev-note">
        <b>Developer note:</b> This is a prototype of the @mentions input.
        Except for some CSS and TS this should be compatible to have a good plug
        and play start to a real @mentions implementation on MC.
      </div>
      <div class="mention-input-container">
        <div
          class="mention-input"
          contenteditable="true"
          data-placeholder=${this.placeholder}
          @input=${this.handleInput}
        ></div>

        ${this._showMentions
          ? html`
              <div class="mentions-dropdown" role="listbox">
                ${this._filteredMentionOptions.map(
                  (option, index) => html`
                    <div
                      class="mention-option ${index === this._selectedIndex
                        ? 'selected'
                        : ''}"
                      role="option"
                      @mousedown=${(e: MouseEvent) => {
                        // keep focus in contenteditable while selecting
                        e.preventDefault()
                        this.selectMention(option)
                      }}
                    >
                      ${option.type === 'tab' && option.image
                        ? html`<img
                            class="favicon"
                            src=${option.image}
                            alt=${option.value}
                            width="14"
                            height="14"
                          />`
                        : ''}
                      ${option.type === 'user' ? '@' : ''}
                      ${ellipsis(option.value, 70)}
                    </div>
                  `,
                )}
              </div>
            `
          : null}
        <hr class="mention-hr" />
        <div class="mention-actions">
          <button class="primary-button" @click="${this.handleSubmit}">
            Submit
          </button>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      /* button colors */
      --color-button-bg: #dcbde6;
      --color-button-bg-hover: #d8b5e1;
      --color-button-text: #343434;
      --color-button-clear-bg-hover: #e3e3e3;
      --color-button-clear-bg: transparent;
      --color-button-clear-text: #000000;
      position: relative;
      display: block;
    }

    .dev-note {
      font-size: 14px;
      color: #242424;
      margin-bottom: 24px;
      user-select: none;
    }

    .primary-button {
      background: #de45fc;
      background: linear-gradient(
        90deg,
        rgba(222, 69, 252, 1) 0%,
        rgba(252, 69, 90, 1) 100%
      );
      color: #fff;
      border: none;
      padding: 12px;
      border-radius: 18px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s ease;
    }

    .primary-button:hover {
      background-color: var(--color-button-bg-hover);
    }

    .mention-input-container {
      border: 1px solid #ccc;
      padding: 12px;
      background-color: #fff;
      border-radius: 12px;
    }

    .mention-hr {
      border: solid 0.5px #e0e0e0;
    }

    .mention-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }

    .mention-input-container:has(.mention-input:focus) {
      border-color: #007acc;
      box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
    }

    .mention-input {
      min-height: 20px;
      border-radius: 12px;
      outline: none;
      cursor: text;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 16px;
      line-height: 1.8;
      padding: 8px 12px;
    }

    .mention-input:empty::before {
      content: attr(data-placeholder);
      color: #999;
      pointer-events: none;
    }

    .mentions-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #ffffff;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      margin-top: 4px;
    }

    .mention-option {
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #323232;
    }

    .mention-option.selected {
      background: #007acc;
      color: white;
    }
  `
}

export default MozMentionInput
