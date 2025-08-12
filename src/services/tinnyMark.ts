/**
 * SimpleMarkdown - a minimal, secure markdown parser
 * Features: headers (h1–h6), paragraphs, **bold**, *italic*, unordered/ordered lists
 * Notes: No nested lists, no inline HTML. Escapes HTML to prevent XSS.
 */

export interface SimpleMarkdownOptions {
  bold?: boolean // **text** or __text__
  italic?: boolean // *text* or _text_
  headers?: boolean // # ## ### #### ##### ######
  unorderedLists?: boolean // -, *, +
  orderedLists?: boolean // 1. 2. 3.
  paragraphs?: boolean // blank-line separated
}

type RequiredOptions = Required<SimpleMarkdownOptions>

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

const UNESCAPED_SINGLE_ASTERISK_ITALIC_PATTERN = /(?<!\\)\*(.+?)\*/g
const UNESCAPED_SINGLE_UNDERSCORE_ITALIC_BOUNDARY_PATTERN =
  /(?<!\\)(?<!\w)_(.+?)_(?!\w)/g
const NORMALIZE_LINE_ENDINGS_PATTERN = /\r\n?/g
const ESCAPED_MARKDOWN_EMPHASIS_PATTERN = /\\([*_])/g
const INLINE_BOLD_ASTERISKS = /(?<!\\)\*\*(.+?)\*\*/g
const UNESCAPED_DOUBLE_UNDERSCORE_BOLD_PATTERN =
  /(?<!\\)(?<!\w)__(.+?)__(?!\w)/g
const HTML_ESCAPE_CHARS = /[&<>"'/]/g

export class SimpleMarkdown {
  private readonly options: RequiredOptions
  private state: ParserState
  private readonly re = {
    header: /^(#{1,6})\s+(.+)$/,
    ul: /^[-*+]\s+(.+)$/,
    ol: /^(\d+)\.\s+(.+)$/,
    empty: /^\s*$/,
  } as const
  private readonly inlineRules: InlineRule[]

  constructor(options: SimpleMarkdownOptions = {}) {
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

/* Example:
const parser = new SimpleMarkdown();
console.log(parser.parse(`# Title

Wrapped
paragraph
continues here.

- First
- Second with **bold** and *italic*
- Use \\*asterisks\\* literally

10. starts at ten
11. next

Done.`));
*/

// Example usage:
// const parser = new SimpleMarkdown({
//   bold: true,
//   italic: true,
//   headers: true,
//   unorderedLists: true,
//   orderedLists: true,
//   classes: {
//     paragraph: 'text-base',
//     header: 'font-bold',
//     unorderedList: 'list-disc ml-4'
//   }
// });

const mockMark = `
 **Main argument**: The author discusses the structure and properties of protons, emphasizing their role as fundamental particles in atomic nuclei and their classification as baryons. The text highlights the composition of protons (three valence quarks, two up quarks, one down quark) and the strong force mediated by gluons, as well as the historical context of the proton's discovery and its significance in particle physics.

**Key points**:
- Protons are composed of three valence quarks (up, up, down) and are baryons.
- Protons are spin-¹/² fermions and are part of hadrons.
- The strong force (mediated by gluons) holds protons together.
- Protons have a positive charge distribution and are used in particle accelerators.

**Important data**:
- Protons are stable subatomic particles with a positive electric charge.
- Protons are composed of two up quarks and one down quark.
- Protons are classified as baryons.
- Protons are fundamental particles in atomic nuclei.

**Summary**:
The author's main argument is to explain the structure and significance of protons, emphasizing their role in atomic nuclei and their classification as baryons.`

const markdown = `# Main Title

This is a **bold** paragraph with *italic* text.

## Subtitle

Another paragraph here.

### Lists

- First item
- Second item with **bold** text
- Third item

1. First numbered item
2. Second numbered item
3. Third numbered item

Final paragraph.`
