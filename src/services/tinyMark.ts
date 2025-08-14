/**
 * TinyMark - a minimal, secure markdown parser
 * Features: headers (h1–h6), paragraphs, **bold**, *italic*, unordered/ordered lists
 * Notes: No nested lists, no inline HTML. Escapes HTML to prevent XSS.
 */

export interface TinyMarkMarkdOptions {
  bold?: boolean // **text** or __text__
  italic?: boolean // *text* or _text_
  headers?: boolean // # ## ### #### ##### ######
  unorderedLists?: boolean // -, *, +
  orderedLists?: boolean // 1. 2. 3.
  paragraphs?: boolean // blank-line separated
}

type RequiredOptions = Required<TinyMarkMarkdOptions>

interface ParserState {
  inUnorderedList: boolean
  inOrderedList: boolean
  orderedListStart: number | null
  paragraphBuffer: string[] // collects lines until a blank line or block break
}

interface InlineRule {
  pattern: RegExp
  replacer: (substring: string, ...args: any[]) => string
}

const NORMALIZE_LINE_ENDINGS_PATTERN = /\r\n?/g
const ESCAPED_MARKDOWN_EMPHASIS_PATTERN = /\\([*_])/g
const HTML_ESCAPE_CHARS = /[&<>"'/]/g
// The Following patters have backtracking removed for performance
const UNESCAPED_SINGLE_ASTERISK_ITALIC_PATTERN = /(?<!\\)\*([^\n*]+?)\*/g
const UNESCAPED_SINGLE_UNDERSCORE_ITALIC_BOUNDARY_PATTERN =
  /(?<!\\)(?<![\p{L}\p{N}])_([^\n_]+?)_(?![\p{L}\p{N}])/gu
const INLINE_BOLD_ASTERISKS = /(?<!\\)\*\*([^\n*]+?)\*\*/g
const UNESCAPED_DOUBLE_UNDERSCORE_BOLD_PATTERN =
  /(?<!\\)(?<![\p{L}\p{N}])__([^\n_]+?)__(?![\p{L}\p{N}])/gu

class TinyMark {
  private readonly options: RequiredOptions
  private state: ParserState
  private readonly re = {
    header: /^(#{1,6})\s+(.+)$/,
    ul: /^[-*+]\s+(.+)$/,
    ol: /^(\d+)\.\s+(.+)$/,
    empty: /^\s*$/,
  } as const
  private readonly inlineRules: InlineRule[]

  constructor(options: TinyMarkMarkdOptions = {}) {
    this.options = {
      bold: options.bold ?? true,
      italic: options.italic ?? true,
      headers: options.headers ?? true,
      unorderedLists: options.unorderedLists ?? true,
      orderedLists: options.orderedLists ?? true,
      paragraphs: options.paragraphs ?? true,
    }

    this.state = this.initialState()
    this.inlineRules = this.buildInlineRules()
  }

  /**
   * Parse markdown string to HTML
   */
  public parse(md: string): string {
    if (!md || typeof md !== 'string') return ''

    // Normalize newlines and trim trailing spaces (but keep intentional spaces)
    const lines = md.replace(NORMALIZE_LINE_ENDINGS_PATTERN, '\n').split('\n')
    const out: string[] = []

    // Reset state for each parse
    this.state = this.initialState()

    for (const line of lines) {
      const trimmed = line.trim()

      // Check for empty lines or end of paragraph
      if (this.re.empty.test(line)) {
        this.flushParagraph(out)
        out.push(...this.closeOpenLists())
        continue
      }

      if (this.options.headers && this.handleHeader(trimmed, out)) continue
      if (this.options.unorderedLists && this.handleUl(trimmed, out)) continue
      if (this.options.orderedLists && this.handleOl(trimmed, out)) continue

      // paragraph fallback
      if (this.options.paragraphs) {
        this.state.paragraphBuffer.push(trimmed)
      }
    }

    // Flush paragraph and close any open lists
    this.flushParagraph(out)
    out.push(...this.closeOpenLists())

    return out.filter(Boolean).join('\n')
  }

  // ---- internals ----

  private handleHeader(trimmed: string, out: string[]): boolean {
    const m = trimmed.match(this.re.header)
    if (!m) return false

    this.flushParagraph(out)
    out.push(...this.closeOpenLists())

    const level = Math.min(6, m[1].length)
    const text = this.processInline(m[2])
    out.push(`<h${level}>${text}</h${level}>`)
    return true
  }

  private handleUl(trimmed: string, out: string[]): boolean {
    const m = trimmed.match(this.re.ul)
    if (!m) return false

    this.flushParagraph(out)
    if (this.state.inOrderedList) {
      out.push('</ol>')
      this.state.inOrderedList = false
      this.state.orderedListStart = null
    }
    if (!this.state.inUnorderedList) {
      out.push('<ul>')
      this.state.inUnorderedList = true
    }

    out.push(`<li>${this.processInline(m[1])}</li>`)
    return true
  }

  private handleOl(trimmed: string, out: string[]): boolean {
    const m = trimmed.match(this.re.ol)
    if (!m) return false

    this.flushParagraph(out)
    const start = parseInt(m[1], 10)

    if (this.state.inUnorderedList) {
      out.push('</ul>')
      this.state.inUnorderedList = false
    }
    if (!this.state.inOrderedList) {
      out.push(start > 1 ? `<ol start="${start}">` : '<ol>')
      this.state.inOrderedList = true
    }

    out.push(`<li>${this.processInline(m[2])}</li>`)
    return true
  }

  private initialState(): ParserState {
    return {
      inUnorderedList: false,
      inOrderedList: false,
      orderedListStart: null,
      paragraphBuffer: [],
    }
  }

  private flushParagraph(out: string[]) {
    if (!this.options.paragraphs) {
      this.state.paragraphBuffer.length = 0
      return
    }
    if (this.state.paragraphBuffer.length === 0) return

    // Join lines with a single space (common Markdown behavior for wrapped lines)
    const text = this.processInline(this.state.paragraphBuffer.join(' '))
    out.push(`<p>${text}</p>`)
    this.state.paragraphBuffer.length = 0
  }

  private closeOpenLists(): string[] {
    const out: string[] = []
    if (this.state.inUnorderedList) {
      out.push('</ul>')
      this.state.inUnorderedList = false
    }
    if (this.state.inOrderedList) {
      out.push('</ol>')
      this.state.inOrderedList = false
      this.state.orderedListStart = null
    }
    return out
  }

  /**
   *
   *
   * @param text
   * @returns
   */
  private processInline(text: string): string {
    // Escape first to prevent HTML injection
    let out = this.escapeHtml(text)

    // Apply inline rules
    for (const rule of this.inlineRules) {
      out = out.replace(rule.pattern, rule.replacer as any)
    }

    // Unescape escaped markers (e.g., \* -> *)
    out = out.replace(ESCAPED_MARKDOWN_EMPHASIS_PATTERN, '$1')

    return out
  }

  private buildInlineRules(): InlineRule[] {
    const rules: InlineRule[] = []

    // Helper: only match when not escaped (negative lookbehind) and try
    // to avoid eating underscores inside words.
    // Note: Lookbehind is widely supported in modern JS engines.
    if (this.options.bold) {
      // **bold** and __bold__

      rules.push(
        {
          // **text**
          pattern: INLINE_BOLD_ASTERISKS,
          replacer: (_s, inner: string) => `<strong>${inner}</strong>`,
        },
        {
          // __text__ but avoid letters/digits on each side to reduce snake_case hits
          pattern: UNESCAPED_DOUBLE_UNDERSCORE_BOLD_PATTERN,
          replacer: (_s, inner: string) => `<strong>${inner}</strong>`,
        },
      )
    }

    if (this.options.italic) {
      // *italic* and _italic_

      rules.push(
        {
          // *text*
          pattern: UNESCAPED_SINGLE_ASTERISK_ITALIC_PATTERN,
          replacer: (_s, inner: string) => `<em>${inner}</em>`,
        },
        {
          // _text_ but avoid snake_case: require non-word boundaries around underscores
          pattern: UNESCAPED_SINGLE_UNDERSCORE_ITALIC_BOUNDARY_PATTERN,
          replacer: (_s, inner: string) => `<em>${inner}</em>`,
        },
      )
    }

    return rules
  }

  private escapeHtml(text: string): string {
    return text.replace(HTML_ESCAPE_CHARS, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;'
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '"':
          return '&quot;'
        case "'":
          return '&#x27;'
        case '/':
          return '&#x2F;'
        default:
          return ch
      }
    })
  }
}

export default TinyMark
