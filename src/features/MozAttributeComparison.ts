import { LitElement, html, css } from 'lit'
import { PageContentT } from '../../types'
import { MlEngineService } from '../services/mlEngine'
import { getOpenAIResponse } from '../services/openai'

const DEFAULT_ATTRIBUTES = [
  'Safety ratings and certifications',
  'Weight capacity',
  'Foldability',
  'Storage space',
  'Price range',
  'Brand reputation',
  'Customer reviews',
  'Warranty',
  'Ease of use',
  'Wheel size',
].join('\n')

const DEFAULT_INTENT = "buy baby strollers"
const criteriaPromptTemplate = ({ userRequest }: { userRequest: string }) => `
You are a shopping expert model.

When considering the topic of ${userRequest}, there are several quality criteria that are relevant, frequently considered and cover a broad range of perspectives. These criteria help shoppers choose the most suitable product for their needs.
On top of the criteria add 5 more different, more diverse and more important.

## Output:
Return a list of 10+ quality criteria that match the user’s request and any relevant use case.
Use one line per item, starting each with a dash or number. **Do not** include explanations, reasons, or annotations. Just the list of important criteria.
`
const getImportantCriteriaFromOpenAI = async (
  userRequest: string,
  model = 'gpt-4o',
  temperature = 0.2,
  max_tokens = 256
): Promise<string[]> => {
  console.log("inside getImportantCriteriaFromOpenAI");
  const prompt = criteriaPromptTemplate({ userRequest })

  const response = await getOpenAIResponse({
    model,
    temperature,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that produces criteria as a numbered list without explanation.',
      },
      { role: 'user', content: prompt },
    ],
  })

  console.log(`response = ${JSON.stringify(response)}`)

  const raw = response?.choices?.[0]?.message?.content || ''

  const lines = raw
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line && /^[-\d]/.test(line))

  const criteria = lines.map((line: string) => line.replace(/^[-*\d.\s]+/, '').trim())


  // Deduplicate and clean
  const seen = new Set<string>()
  const unique = criteria.filter((item: string) => {
    if (seen.has(item)) return false
    seen.add(item)
    return true
  })

  return unique
}

export const getTopKCriteria = (criteria: string[], k = 5): string[] => {
  return criteria
    .filter(q => q && !q.endsWith(':') && !q.endsWith(',') && !/\(\s*$/.test(q))
    .slice(0, k)
}

type ClassificationResultT = {
  sequence: string
  labels: string[]
  scores: number[]
}

class MozAttributeComparison extends LitElement {
  attrs: string = DEFAULT_ATTRIBUTES
  intent: string = DEFAULT_INTENT
  isLoading: boolean = false
  result: ClassificationResultT | null = null
  error: string | null = null

  private mlEngineService: MlEngineService

  static properties = {
    attrs: { type: String },
    isLoading: { type: Boolean },
    result: { type: Object },
    error: { type: String },
  }

  constructor() {
    super()
    this.mlEngineService = new MlEngineService({
      modelHub: "huggingface",
      taskName: 'zero-shot-classification',
      modelId: 'Xenova/mobilebert-uncased-mnli',
    })
  }

  static styles = css`
    :host {
      --color-bg: #202020;
      --color-link: #1e90ff;
      --color-fg: #ffffff;
      --color-border: #007bff;
      --color-input-bg: #424242;
      --color-secondary-hover: #585858;
      --color-loader-bg: #424242;
      --color-response-bg: #2d2c2c;
      --color-gradient-start: #2e3133;
      --color-gradient-end: #4b4e52;
      --color-primary-disabled: #6d6d6d;
      --color-error: #ff4d4d;
    }

    a {
      color: var(--color-link);
    }

    .wrapper {
      display: block;
      color: var(--color-fg);
      background-color: var(--color-bg);
      padding: 10px;
      user-select: text !important;
      -moz-user-select: text !important;
    }

    .container {
      min-height: calc(100vh - 140px);
      display: flex;
      padding: 10px 14px;
      background: linear-gradient(
        135deg,
        var(--color-gradient-start) 0%,
        var(--color-gradient-end) 100%
      );
      flex-direction: column;
      border-radius: 8px;
      font-size: 14px;
    }

    .text-area {
      padding: 8px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--color-input-bg);
      color: var(--color-fg);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      min-height: 120px;
      width: 100%;
      box-sizing: border-box;
    }

    .primary-button {
      padding: 8px 12px;
      background-color: var(--color-border);
      color: var(--color-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;
    }

    .primary-button:disabled {
      background-color: var(--color-primary-disabled);
      cursor: not-allowed;
    }

    .label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      font-size: 14px;
    }

    .field {
      margin-bottom: 12px;
    }

    @keyframes pulse {
      0% {
        background-color: var(--color-loader-bg);
      }
      50% {
        background-color: var(--color-secondary-hover);
      }
      100% {
        background-color: var(--color-loader-bg);
      }
    }

    .loader {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      background-color: var(--color-loader-bg);
      border-radius: 4px;
      color: var(--color-fg);
      animation: pulse 1.5s infinite;
      margin: 10px 0;
    }

    .response {
      padding: 12px;
      background-color: var(--color-response-bg);
      border-radius: 4px;
      color: var(--color-fg);
      overflow-y: auto;
      flex-grow: 1;
      line-height: 1.5;
      margin: 10px 0;
    }

    .error-message {
      padding: 12px;
      background-color: var(--color-error);
      border-radius: 4px;
      color: var(--color-fg);
      margin: 10px 0;
    }

    .controls-section {
      margin-bottom: 15px;
      flex-shrink: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th,
    td {
      border: 1px solid var(--color-secondary-hover);
      padding: 8px;
      text-align: left;
    }

    th {
      background-color: var(--color-input-bg);
    }
  `

  handleAttributesChange = (event: Event) => {
    const textarea = event.target as HTMLTextAreaElement
    this.attrs = textarea.value
  }

  handleIntentChange = async (event: Event) => {
    const textarea = event.target as HTMLTextAreaElement
    this.intent = textarea.value
    console.log(`this.intent = ${this.intent}`)
    // new openAI call to get the criteria to fill this.attrs

    try {
      const criteria = await getImportantCriteriaFromOpenAI(this.intent)
      console.log(`criteria = ${JSON.stringify(criteria)}`);
      this.attrs = criteria.join('\n')
      if (this.attrs.length === 0) {
        this.attrs = DEFAULT_ATTRIBUTES
      }
    } catch (err) {
      console.error('Failed to fetch criteria from OpenAI:', err)
      this.error = 'Could not generate attribute criteria from AI'
    }
  }

  handleCompare = async () => {
    this.isLoading = true
    this.result = null
    this.error = null

    try {
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!activeTab.id) {
        throw new Error('Could not find active tab.')
      }

      const pageContent: PageContentT | null = await browser.tabs.sendMessage(
        activeTab.id,
        {
          type: 'get_page_content',
        },
      )

      if (!pageContent || !pageContent.textContent) {
        throw new Error('Could not get page content.')
      }

      const labels = this.attrs
        .split('\n')
        .map(label => label.trim())
        .filter(Boolean)

      if (labels.length === 0) {
        throw new Error('Please provide at least one attribute.')
      }

      const classificationResult = await this.mlEngineService.getAIResponse<
        ClassificationResultT
      >({
        args: [
          // Some reason too long text results in equal scores for all labels
          pageContent.textContent.replace(/\s+/g, ' ').slice(0, 2000),
          labels,
        ],
        options: { multi_label: true },
      })

      if (!classificationResult) {
        throw new Error('Failed to get a valid response from the model.')
      }

      this.result = classificationResult
    } catch (err) {
      if (err instanceof Error) {
        this.error = err.message
      } else {
        this.error = 'An unknown error occurred.'
      }
      console.error('Error during attribute comparison:', err)
    } finally {
      this.isLoading = false
    }
  }

  render() {
    const { result } = this

    return html`
      <div class="wrapper">
        <div class="container">
          <div class="controls-section">
            <div class="field">

              <label class="label">User intent (buy strollers):</label>
              <textarea
                class="text-area"
                @input="${this.handleIntentChange}"
                .value="${this.intent}"
              ></textarea>

              <label class="label">Attributes (one per line):</label>
              <textarea
                class="text-area"
                @input="${this.handleAttributesChange}"
                .value="${this.attrs}"
                rows="10"
              ></textarea>
            </div>
            <button
              class="primary-button"
              @click="${this.handleCompare}"
              ?disabled="${this.isLoading}"
            >
              ${this.isLoading
                ? 'Analyzing...'
                : 'Compare Attributes on This Page'}
            </button>
          </div>

          ${this.isLoading
            ? html`
                <div class="loader">Loading...</div>
              `
            : ''}
          ${this.error
            ? html`
                <div class="error-message">${this.error}</div>
              `
            : ''}
          ${result
            ? html`
                <div class="response">
                  <h3>Comparison Results:</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Attribute</th>
                        <th>Match Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.labels.map(
                        (label: string, index: number) => html`
                          <tr>
                            <td>${label}</td>
                            <td>
                              ${(result.scores[index] * 100).toFixed(2)}%
                            </td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </div>
              `
            : ''}
        </div>
      </div>
    `
  }
}

export default MozAttributeComparison
