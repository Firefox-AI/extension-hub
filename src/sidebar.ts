import MozQuestionAnswer from './features/MozQuestionAnswer'
import MozPageSummarization from './features/page-summarization/MozPageSummarization'
import MozTabs from './features/MozTabs'
import ExtensionHub from './components/ExtensionHub'
import MozChat from './features/chat/MozChat'
import MozTabsDebug from './features/MozTabsDebug'

customElements.define('moz-question-answer', MozQuestionAnswer)
customElements.define('moz-extension-hub', ExtensionHub)
customElements.define('moz-page-summarization', MozPageSummarization)
customElements.define('moz-tabs', MozTabs)
customElements.define('moz-chat', MozChat)
customElements.define('moz-tabs-debug', MozTabsDebug)
