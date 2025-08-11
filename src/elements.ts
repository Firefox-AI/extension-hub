import ExtensionHub from './components/ExtensionHub'
import MozAttributeComparison from './features/MozAttributeComparison'
import MozChat from './features/chat/MozChat'
import MozConversationalOnboarding from './features/onboarding/MozConversationalOnboarding'
import MozExtensionHubDash from './features/MozExtensionHubDash'
import MozHomepage from './features/MozHomepage'
import MozPageSummarization from './features/page-summarization/MozPageSummarization'
import MozPlanChecklist from './features/MozPlanChecklist'
import MozPlanner from './features/planner/MozPlanner'
import MozQuestionAnswer from './features/MozQuestionAnswer'
import MozTabs from './features/MozTabs'
import MozTabsDebug from './features/MozTabsDebug'

customElements.define('moz-attribute-comparison', MozAttributeComparison)
customElements.define('moz-chat', MozChat)
customElements.define(
  'moz-conversational-onboarding',
  MozConversationalOnboarding,
)
customElements.define('moz-extension-hub-dash', MozExtensionHubDash)
customElements.define('moz-extension-hub', ExtensionHub)
customElements.define('moz-homepage', MozHomepage)
customElements.define('moz-page-summarization', MozPageSummarization)
customElements.define('moz-plan-checklist', MozPlanChecklist)
customElements.define('moz-planner', MozPlanner)
customElements.define('moz-question-answer', MozQuestionAnswer)
customElements.define('moz-tabs-debug', MozTabsDebug)
customElements.define('moz-tabs', MozTabs)
