import type { mlBrowserT, TabsCollectionT } from '../types'

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

const lazy: { SmartTabGroupingManager?: any } = {}
ChromeUtils.defineESModuleGetters(lazy, {
  SmartTabGroupingManager:
    'moz-src:///browser/components/tabbrowser/SmartTabGrouping.sys.mjs',
})

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
      },
    }
  }
}
