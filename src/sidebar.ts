import MozAttributeComparison from './features/MozAttributeComparison'
import MozConversationalOnboarding from './features/onboarding/MozConversationalOnboarding'
import MozQuestionAnswer from './features/MozQuestionAnswer'
import MozPageSummarization from './features/page-summarization/MozPageSummarization'
import MozTabs from './features/MozTabs'
import ExtensionHub from './components/ExtensionHub'
import MozChat from './features/chat/MozChat'
import MozPlanner from './features/planner/MozPlanner'
import MozPlanChecklist from './features/MozPlanChecklist'
import MozTabsDebug from './features/MozTabsDebug'
import MozExtensionHubDash from './features/MozExtensionHubDash'

customElements.define('moz-attribute-comparison', MozAttributeComparison)
customElements.define('moz-conversational-onboarding', MozConversationalOnboarding)
customElements.define('moz-question-answer', MozQuestionAnswer)
customElements.define('moz-extension-hub', ExtensionHub)
customElements.define('moz-page-summarization', MozPageSummarization)
customElements.define('moz-tabs', MozTabs)
customElements.define('moz-chat', MozChat)
customElements.define('moz-planner', MozPlanner)
customElements.define('moz-plan-checklist', MozPlanChecklist)
customElements.define('moz-tabs-debug', MozTabsDebug)
customElements.define('moz-extension-hub-dash', MozExtensionHubDash)
