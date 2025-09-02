import ExtensionHub from './components/ExtensionHub'
import MozAIMode from './features/aimode/MozAIMode'
import MozAttributeComparison from './features/MozAttributeComparison'
import MozChat from './features/chat/MozChat'
import MozConversationalOnboarding from './features/onboarding/MozConversationalOnboarding'
import MozExtensionHubDash from './features/MozExtensionHubDash'
import MozAiModePage from './features/aimode/MozAIModePage'
import MozPageSummarization from './features/page-summarization/MozPageSummarization'
import MozPlanChecklist from './features/MozPlanChecklist'
import MozPlanner from './features/planner/MozPlanner'
import MozQuestionAnswer from './features/MozQuestionAnswer'
import MozSemanticSearch from './features/MozSemanticSearch'
import MozTabs from './features/MozTabs'
import MozTabsDebug from './features/MozTabsDebug'

customElements.define('moz-ai-mode', MozAIMode)
customElements.define('moz-attribute-comparison', MozAttributeComparison)
customElements.define('moz-chat', MozChat)
customElements.define(
  'moz-conversational-onboarding',
  MozConversationalOnboarding,
)
customElements.define('moz-extension-hub-dash', MozExtensionHubDash)
customElements.define('moz-extension-hub', ExtensionHub)
customElements.define('moz-ai-mode-page', MozAiModePage)
customElements.define('moz-page-summarization', MozPageSummarization)
customElements.define('moz-plan-checklist', MozPlanChecklist)
customElements.define('moz-planner', MozPlanner)
customElements.define('moz-question-answer', MozQuestionAnswer)
customElements.define('moz-semantic-search', MozSemanticSearch)
customElements.define('moz-tabs-debug', MozTabsDebug)
customElements.define('moz-tabs', MozTabs)
