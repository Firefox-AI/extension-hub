/**
 * Page Launcher Service
 * 
 * This service is responsible for launching a specific page in the browser. To get a full page
 * experience.
 * 
 * How to use :
 * 
 * - Add new html page to the `pages` directory.
 * - In the page make sure to include the <script src="../dist/elements.js" type="module"></script> script.
 * - Create a new "feature" lit component in src/features/optional-folder/featureName.ts
 * - Register the component in the `src/elements.ts` file, all functionality and styling should be done in the component.
 * - In the side bar for example you can call 

  browser.runtime.sendMessage({
    type: 'pages_open',
    data: { page: nameOfThePage.html },
  })
    
 */
export const pageLauncher = async (page: string) => {
  const targetUrl = browser.runtime.getURL(`pages/${page}`)
  const tabs = await browser.tabs.query({ url: targetUrl })
  // If the page is already open, focus it
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    browser.tabs.update(tabs[0].id, { active: true })
  } else {
    browser.tabs.create({ url: targetUrl })
  }
}
