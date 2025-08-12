import type { mlBrowserT, TabsCollectionT, SemanticMatchT } from '../types'

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
              .filter((match: SemanticMatchT) => (match.score ?? 0) > 0.25)
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
      },
    }
  }
}
