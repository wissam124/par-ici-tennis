import dayjs from 'dayjs'
import { SEARCH_URL } from './availability.js'

export const cancelDryRunSelection = async (page, log = console.log) => {
  log(`${dayjs().format()} - Cancelling the temporary dry-run selection...`)

  const previousButton = page.locator('#previous').filter({ visible: true })
  if (await previousButton.count() > 0) {
    await previousButton.click()
  }

  const cancelButton = page.locator('#btnCancelBooking').filter({ visible: true })
  await cancelButton.waitFor({ state: 'visible', timeout: 10000 })
  await cancelButton.click()

  // A pending server-side selection redirects this URL back to the reservation
  // flow, so seeing the search input confirms that cancellation really cleared it.
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.tokens-input-text').waitFor({ state: 'visible', timeout: 10000 })
  log(`${dayjs().format()} - Temporary selection cancelled successfully.`)
}
