import type {
  mlBrowserT,
  SemanticMatchT,
  TabsCollectionT,
  UrlbarSuggestionT,
} from '../types'
import { customView } from './features/aimode/utils'

declare const ChromeUtils: any
declare const ExtensionAPI: any
declare const Services: any
interface BrowserTab {
  group?: { tabs: BrowserTab[] }
  label: string
  lastAccessed: number
  linkedBrowser: {
    currentURI: {
      spec: string
    }
  }
}

const lazy: {
  AboutNewTab?: any
  cosSim?: any
  EmbeddingsGenerator?: any
  EveryWindow?: any
  GenAI?: any
  getPlacesSemanticHistoryManager?: any
  SmartTabGroupingManager?: any
  UrlbarController?: any
  UrlbarProvidersManager?: any
  UrlbarQueryContext?: any
} = {}
ChromeUtils.defineESModuleGetters(lazy, {
  AboutNewTab: 'resource:///modules/AboutNewTab.sys.mjs',
  cosSim: 'chrome://global/content/ml/NLPUtils.sys.mjs',
  EmbeddingsGenerator: 'chrome://global/content/ml/EmbeddingsGenerator.sys.mjs',
  EveryWindow: 'resource:///modules/EveryWindow.sys.mjs',
  GenAI: 'resource:///modules/GenAI.sys.mjs',
  getPlacesSemanticHistoryManager:
    'resource://gre/modules/PlacesSemanticHistoryManager.sys.mjs',
  SmartTabGroupingManager:
    'moz-src:///browser/components/tabbrowser/SmartTabGrouping.sys.mjs',
  UrlbarController: 'resource:///modules/UrlbarController.sys.mjs',
  UrlbarProvidersManager: 'resource:///modules/UrlbarProvidersManager.sys.mjs',
  UrlbarQueryContext: 'resource:///modules/UrlbarUtils.sys.mjs',
})

function getAllTabsFromAllWindows(): BrowserTab[] {
  const allTabs: BrowserTab[] = []
  lazy.EveryWindow.readyWindows.forEach((window: any) => {
    allTabs.push(...window.gBrowser.tabs)
  })
  return allTabs
    .sort((a: BrowserTab, b: BrowserTab) => b.lastAccessed - a.lastAccessed)
    .slice(0, 100)
}

export default class extends ExtensionAPI {
  getAPI(context: any): { extensionHub: mlBrowserT['extensionHub'] } {
    let urlbarFocusEnabled = false

    return {
      extensionHub: {
        async getTabs(): Promise<TabsCollectionT> {
          const {
            selectedTab,
            tabs,
          }: { selectedTab: BrowserTab; tabs: BrowserTab[] } =
            Services.wm.getMostRecentBrowserWindow().gBrowser

          const current: { tabs: BrowserTab[] } = selectedTab.group ?? {
            tabs: [selectedTab],
          }
          const recent: BrowserTab[] = [...tabs]
            .sort(
              (a: BrowserTab, b: BrowserTab) => b.lastAccessed - a.lastAccessed,
            )
            .slice(0, 5)

          const manager = new lazy.SmartTabGroupingManager()
          const smart: BrowserTab[] = await manager.smartTabGroupingForGroup(
            current,
            tabs,
          )

          const tabCollections = {
            current: current.tabs,
            recent,
            smart,
            smarter: [...current.tabs, ...smart],
            start: tabs.slice(0, 5),
            tail: tabs.slice(-5),
          }

          return Object.fromEntries(
            Object.entries(tabCollections).map(([key, val]) => [
              key,
              val.map((tab: BrowserTab) => ({
                title: tab.label,
                url: tab.linkedBrowser.currentURI.spec,
              })),
            ]),
          ) as TabsCollectionT
        },

        async semanticTabs(searchString: string): Promise<SemanticMatchT[]> {
          try {
            const tabs = getAllTabsFromAllWindows()

            const fakeTab: BrowserTab = {
              label: searchString,
              lastAccessed: Date.now(),
              linkedBrowser: {
                currentURI: {
                  spec: 'http://example.com',
                },
              },
            }

            const fakeGroup = { tabs: [fakeTab] }
            const allTabsWithFake = [...tabs, fakeTab]

            const manager = new lazy.SmartTabGroupingManager()
            const smartTabs: BrowserTab[] =
              await manager.smartTabGroupingForGroup(fakeGroup, allTabsWithFake)

            // Filter and score tabs based on search string similarity
            const matches = smartTabs.slice(0, 5).map((tab) => ({
              title: tab.label,
              url: tab.linkedBrowser.currentURI.spec,
              score: 0,
            }))

            return matches
          } catch (error) {
            console.error('Failed to get semantic tabs:', error)
            return []
          }
        },

        async domainTabs(domain: string): Promise<SemanticMatchT[]> {
          try {
            let res = getAllTabsFromAllWindows()
              .filter((tab) =>
                tab.linkedBrowser.currentURI.spec.includes(domain),
              )
              .slice(0, 10)
              .map((tab) => ({
                title: tab.label,
                url: tab.linkedBrowser.currentURI.spec,
                score: 0,
              }))
            return res
          } catch (error) {
            console.error('Failed to get domain tabs:', error)
            return []
          }
        },

        async semanticHistory(searchString: string): Promise<SemanticMatchT[]> {
          try {
            const PlacesSemanticHistoryManager =
              lazy.getPlacesSemanticHistoryManager()
            const results = await PlacesSemanticHistoryManager.infer({
              searchString,
            })

            return (
              results.results
                ?.slice(0, 5)
                .map((item: any) => ({
                  title: item.title || 'Untitled',
                  excerpt: item.url.slice(0, 100),
                  url: item.url,
                  score: item.distance || 0,
                }))
                .sort(
                  (a: SemanticMatchT, b: SemanticMatchT) =>
                    (b.score ?? 0) - (a.score ?? 0),
                ) || []
            )
          } catch (error) {
            console.error('Failed to get semantic history:', error)
            return []
          }
        },

        async semanticStories(searchString: string): Promise<SemanticMatchT[]> {
          try {
            // Get stories from AboutNewTab
            const stories =
              lazy.AboutNewTab.activityStream.store.getState().DiscoveryStream
                .feeds.data[
                'https://merino.services.mozilla.com/api/v1/curated-recommendations'
              ]?.data?.recommendations || []

            if (stories.length === 0) {
              return []
            }

            const generator = new lazy.EmbeddingsGenerator()

            // Prepare texts for embedding
            const storyTexts = stories
              .slice(0, 10)
              .map(
                (story: any) =>
                  (story.title || '') + ' ' + (story.excerpt || ''),
              )
            const allTexts = [searchString, ...storyTexts]

            // Generate embeddings
            const embeddings = await generator.embedMany(allTexts)
            const contextEmbedding = embeddings[0]
            const storyEmbeddings = embeddings.slice(1)

            // Calculate similarities
            const matches = stories
              .slice(0, 10)
              .map((story: any, index: number) => ({
                title: story.title || 'Untitled Story',
                url: story.url,
                excerpt: story.excerpt,
                score: lazy.cosSim(contextEmbedding, storyEmbeddings[index]),
              }))
              .filter((match: SemanticMatchT) => (match.score ?? 0) > 0.2)
              .sort(
                (a: SemanticMatchT, b: SemanticMatchT) =>
                  (b.score ?? 0) - (a.score ?? 0),
              )
              .slice(0, 5)

            return matches
          } catch (error) {
            console.error('Failed to get semantic stories:', error)
            return []
          }
        },

        async askChat(prompt: string): Promise<void> {
          try {
            // Hack to remove the default prefix for this prompt
            Services.prefs.setStringPref('browser.ml.chat.prompt.prefix', '')
            const window = Services.wm.getMostRecentBrowserWindow()
            await lazy.GenAI.handleAskChat({ value: prompt }, { window })
            Services.prefs.clearUserPref('browser.ml.chat.prompt.prefix')
          } catch (error) {
            console.error('Failed to ask chat:', error)
          }
        },

        async getBoolPref(prefName: string): Promise<boolean> {
          try {
            return Services.prefs.getBoolPref(prefName, false)
          } catch (error) {
            console.error(`Failed to get bool pref ${prefName}:`, error)
            return false
          }
        },

        async findInPage(query: string): Promise<boolean> {
          try {
            const window = Services.wm.getMostRecentBrowserWindow()
            const finder = window.gBrowser.selectedBrowser.finder
            return finder.fastFind(query)
          } catch (error) {
            console.error('Failed to find in page:', error)
            return false
          }
        },

        async getUrlbarSuggestions(
          searchString: string,
        ): Promise<UrlbarSuggestionT[]> {
          try {
            if (!searchString.trim()) {
              return []
            }

            // Create a UrlbarQueryContext for the search
            const context = new lazy.UrlbarQueryContext({
              searchString: searchString.trim(),
              allowAutofill: false,
              isPrivate: false,
              maxResults: 20,
              userContextId: 0,
            })

            const window = Services.wm.getMostRecentBrowserWindow()
            // Create UrlbarController as shown in your example
            const controller = new lazy.UrlbarController({
              input: {
                isPrivate: false,
                onFirstResult() {},
                window,
              },
            })

            // Start the query and wait for results
            await lazy.UrlbarProvidersManager.startQuery(context, controller)

            // Process the results
            const suggestions = []

            for (const result of context.results) {
              let suggestion = {
                type: '' as 'search' | 'navigate' | 'action',
                text: '',
                title: '',
                url: '',
                icon: '',
                description: '',
              }

              // Map Firefox result types to our suggestion types
              switch (result.type) {
                case 1: // Tab switch
                  suggestion.type = 'action'
                  suggestion.text = `tab switch: ${result.payload.title || result.payload.url || ''}`
                  suggestion.title = result.payload.title || ''
                  suggestion.url = result.payload.url || ''
                  suggestion.icon = result.payload.icon || ''
                  break

                case 2: // Search suggestion
                  suggestion.type = 'search'
                  suggestion.text =
                    result.payload.suggestion ||
                    result.payload.query ||
                    searchString
                  suggestion.title = result.payload.suggestion || ''
                  suggestion.description = result.payload.description || ''
                  suggestion.icon = result.payload.icon || ''
                  break

                case 3: // URL/bookmark
                  suggestion.type = 'navigate'
                  suggestion.text =
                    result.payload.displayUrl || result.payload.url || ''
                  suggestion.title = result.payload.title || ''
                  suggestion.url = result.payload.url || ''
                  suggestion.icon = result.payload.icon || ''
                  break

                default:
                  continue // Skip unknown types
              }

              // Only add non-empty suggestions
              if (suggestion.text.trim()) {
                suggestions.push(suggestion)
              }
            }

            return suggestions
          } catch (error) {
            console.error('Failed to get urlbar suggestions:', error)
            return []
          }
        },

        async setUrlbarRedirect(enabled: boolean): Promise<boolean> {
          try {
            const window = Services.wm.getMostRecentBrowserWindow()
            const sidebar = window.SidebarController
            const urlbar = window.gURLBar

            if (enabled) {
              if (urlbarFocusEnabled) return true

              // Apply AI mode UI changes
              const urlbarElement = window.document.getElementById('urlbar')
              if (urlbarElement) {
                urlbarElement.style.opacity = '0.1'
              }

              const sidebarPanelHeader =
                sidebar.browser.contentDocument.getElementById(
                  'sidebar-panel-header',
                )
              if (sidebarPanelHeader) {
                sidebarPanelHeader.hidden = true
              }

              // Create focus handler if it doesn't exist yet
              if (!urlbar._aiModeFocusHandler) {
                urlbar._aiModeFocusHandler = (saveUrl: boolean) => {
                  // Store current URL for AI Mode component to retrieve
                  if (saveUrl) {
                    const currentUrl =
                      window.gBrowser.selectedBrowser.currentURI.spec
                    if (currentUrl && !currentUrl.startsWith('about:')) {
                      urlbar.lastFocusedUrl = currentUrl
                    }
                  }

                  // Directly focus the sidebar
                  try {
                    if (
                      sidebar &&
                      sidebar.browser &&
                      sidebar.browser.contentDocument
                    ) {
                      sidebar.show('extensionhub_mozilla_org-sidebar-action')
                      sidebar.browser.focus()
                      const browserElement =
                        sidebar.browser.contentDocument.querySelector('browser')
                      if (browserElement) {
                        browserElement.focus()
                      }
                    }
                  } catch (error) {
                    console.error('Failed to redirect focus to sidebar:', error)
                  }
                }
              }

              urlbar.addEventListener('focus', urlbar._aiModeFocusHandler)
              urlbar._aiModeFocusHandler(false) // Initial focus redirect
              urlbarFocusEnabled = true
            } else {
              if (!urlbarFocusEnabled) return true

              // Restore original UI
              const urlbarElement = window.document.getElementById('urlbar')
              if (urlbarElement) {
                urlbarElement.style.opacity = ''
              }

              const sidebarPanelHeader =
                sidebar.browser.contentDocument.getElementById(
                  'sidebar-panel-header',
                )
              if (sidebarPanelHeader) {
                sidebarPanelHeader.hidden = false
              }

              // Remove the event listener if it exists
              if (urlbar._aiModeFocusHandler) {
                urlbar.removeEventListener('focus', urlbar._aiModeFocusHandler)
                urlbar._aiModeFocusHandler = null
              }

              urlbarFocusEnabled = false
            }

            return true
          } catch (error) {
            console.error('Failed to set urlbar redirect:', error)
            return false
          }
        },

        async setNewTabOverride(enabled: boolean): Promise<boolean> {
          try {
            if (enabled) {
              // Point new tab to AI mode page
              lazy.AboutNewTab.newTabURL =
                context.extension.baseURL + 'pages/aiModePage.html'
            } else {
              // Restore new tab behavior
              lazy.AboutNewTab.resetNewTabURL()
            }

            return true
          } catch (error) {
            console.error('Failed to set new tab override:', error)
            return false
          }
        },

        async setFirefoxViewOverride(enabled: boolean): Promise<boolean> {
          try {
            const window = Services.wm.getMostRecentBrowserWindow()

            if (enabled) {
              // Replace FirefoxViewHandler.openTab with custom function
              if (
                window.FirefoxViewHandler &&
                window.FirefoxViewHandler.openTab
              ) {
                // Store original function
                if (!window.FirefoxViewHandler._originalOpenTab) {
                  window.FirefoxViewHandler._originalOpenTab =
                    window.FirefoxViewHandler.openTab
                }
                // Replace with custom function
                window.FirefoxViewHandler.openTab = () =>
                  customView(window, context, this)
              }
            } else {
              // Restore FirefoxViewHandler.openTab
              if (
                window.FirefoxViewHandler &&
                window.FirefoxViewHandler._originalOpenTab
              ) {
                window.FirefoxViewHandler.openTab =
                  window.FirefoxViewHandler._originalOpenTab
                window.FirefoxViewHandler._originalOpenTab = null
              }
            }

            return true
          } catch (error) {
            console.error('Failed to set Firefox View override:', error)
            return false
          }
        },

        async updateUIForAIMode(enabled: boolean): Promise<boolean> {
          try {
            await this.setUrlbarRedirect(enabled)
            await this.setNewTabOverride(enabled)
            await this.setFirefoxViewOverride(enabled)
            return true
          } catch (error) {
            console.error('Failed to update UI for AI mode:', error)
            return false
          }
        },

        async getLastFocusedUrl(): Promise<string | null> {
          const window = Services.wm.getMostRecentBrowserWindow()
          const urlbar = window.gURLBar
          const url = urlbar.lastFocusedUrl
          urlbar.lastFocusedUrl = null // Clear after retrieval
          return url
        },

        async closeSidebar(): Promise<boolean> {
          try {
            const window = Services.wm.getMostRecentBrowserWindow()
            const sidebar = window.SidebarController
            sidebar.hide()
            return true
          } catch (error) {
            console.error('Failed to close sidebar:', error)
            return false
          }
        },
      },
    }
  }
}
