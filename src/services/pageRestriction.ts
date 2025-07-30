/**
 * Simple service for checking if current page allows content scripts
 */

export interface PageCheckResult {
  isRestricted: boolean
  reason: string
  isReaderMode?: boolean
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

  // This is just a placeholder I think we should
  // come back and return the page content somehow instead of just seeing that
  // it is reader mode and failing the request
  private async checkReaderModeInTab(tabId: number): Promise<PageCheckResult> {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      // type script is complaing about this return type but this is correct
      func: () => {
        // Multiple checks reader mode and CSP issues
        const checks = {
          hasReaderTitle: !!document.getElementById('reader-title'),
          hasReaderCSS: !!document.querySelector(
            'link[href*="aboutReader.css"]',
          ),
          hasReaderCSP:
            document
              .querySelector('meta[http-equiv="Content-Security-Policy"]')
              ?.getAttribute('content')
              ?.includes('default-src chrome:') || false,
        }

        // Return true if any reader mode indicator is found
        const isReaderMode = Object.values(checks).some((check) => check)

        return {
          isReaderMode,
        }
      },
    })

    return {
      isRestricted: result[0].result.isReaderMode,
      reason: result[0].result.isReaderMode
        ? 'Page is in reader mode'
        : 'Page is not in reader mode',
    }
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

      // Check for reader mode by trying to execute a simple script
      // Reader mode will block this due to CSP
      const readerModeCheck = await this.checkReaderModeInTab(tabs[0].id!)
      if (readerModeCheck.isReaderMode) {
        return readerModeCheck
      }

      return this.defaultResponse
    } catch (error) {
      return {
        isRestricted: true,
        reason:
          'Could not access tab information, your page is most likley in reader mode.',
      }
    }
  }

  public async checkPageRestricted(): Promise<PageCheckResult> {
    const check = await this.checkCurrentPage()
    return check
  }
}

export const pageRestrictionService = PageRestrictionService.getInstance()
