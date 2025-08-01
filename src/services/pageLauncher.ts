// TODO - look into how this could scale to open different pages.
// when we pass a param here.
export const pageLauncher = async () => {
  const targetUrl = browser.runtime.getURL('pages/pages.html')
  const tabs = await browser.tabs.query({ url: targetUrl })
  // If the page is already open, focus it
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    browser.tabs.update(tabs[0].id, { active: true })
  } else {
    browser.tabs.create({ url: targetUrl })
  }
}
