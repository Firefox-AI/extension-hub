/**
 * Simple service for checking if current page allows content scripts
 */

export interface PageCheckResult {
  isRestricted: boolean
  reason: string
}

export class PageRestrictionService {
  private static instance: PageRestrictionService
  private defaultResponse = {
    isRestricted: false,
    reason: 'Page allows content scripts',
  }
  private readonly restrictionChecks = [
    {
      test: (url: string) =>
        url.startsWith('about:') && !url.startsWith('about:reader'),
      reason: 'Firefox internal pages are protected for security',
    },
    {
      test: (url: string) => url.startsWith('chrome:'),
      reason: 'Browser internal pages cannot be accessed',
    },
    {
      test: (url: string) =>
        url.startsWith('moz-extension:') || url.startsWith('chrome-extension:'),
      reason: 'Extension pages cannot access other extensions',
    },
    {
      test: (url: string) =>
        url.includes('addons.mozilla.org') ||
        url.includes('chrome.google.com/webstore'),
      reason: 'Add-on store pages are protected',
    },
    {
      test: (url: string) => url.startsWith('file:'),
      reason: 'Local file access is restricted by default',
    },
    {
      test: (url: string) =>
        url.startsWith('data:') || url.startsWith('javascript:'),
      reason: 'Data and JavaScript URLs cannot be accessed',
    },
  ]

  private constructor() {}

  public static getInstance(): PageRestrictionService {
    if (!PageRestrictionService.instance) {
      PageRestrictionService.instance = new PageRestrictionService()
    }
    return PageRestrictionService.instance
  }

  /**
   * The main purpose of this function is to check if we can access the DOM of the current page.
   * without throwing an error, if error occurs we can assume that the page is in reader mode or some other protected state.
   * @param tabId
   */
  private async checkReaderModeInTab(tabId: number) {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.querySelector('body')
      },
    })
  }

  /**
   * Check if a specific URL is restricted
   */
  private checkUrl(url: string): PageCheckResult {
    for (const check of this.restrictionChecks) {
      if (check.test(url)) {
        return {
          isRestricted: true,
          reason: check.reason,
        }
      }
    }

    return this.defaultResponse
  }

  /**
   * Check if the current active page is restricted
   */
  private async checkCurrentPage(): Promise<PageCheckResult> {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })

      const { url } = tabs[0]

      if (!url) {
        return {
          isRestricted: true,
          reason: 'Could not determine current page',
        }
      }

      // First check URL-based restrictions
      const urlCheck = this.checkUrl(url)
      if (urlCheck.isRestricted) {
        return urlCheck
      }

      await this.checkReaderModeInTab(tabs[0].id!)
      return this.defaultResponse
    } catch (error) {
      return {
        isRestricted: true,
        reason:
          'Could not access tab information, your page is most likely in reader mode or some other protected page.',
      }
    }
  }

  public async checkPageRestricted(): Promise<PageCheckResult> {
    const check = await this.checkCurrentPage()
    return check
  }
}

export const pageRestrictionService = PageRestrictionService.getInstance()
