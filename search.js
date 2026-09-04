import { chromium } from 'playwright'
import { config } from './staticFiles.js'
import { createAuthenticatedPage } from './lib/authenticate.js'
import { searchAvailability } from './lib/availability.js'
import { getOfficialLocations, validateConfiguredLocations } from './lib/locations.js'
import { getConfiguredDate } from './lib/dates.js'
import { validateSearchConfig } from './lib/config.js'

const reportProgress = event => {
  if (event.type === 'location-start') {
    console.error(`Searching ${event.location} on ${event.date}...`)

    return
  }

  if (event.type === 'location-retry') {
    console.error(`  Search interrupted (${event.error}); retrying ${event.location}...`)

    return
  }

  if (event.courts.length === 0) {
    console.error(`  ${event.hour}:00 — no availability`)
  }
}

const search = async () => {
  const jsonOutput = process.argv.includes('--json')

  validateSearchConfig(config)
  const date = getConfiguredDate(config.date, { required: true })

  const browser = await chromium.launch({ headless: true, slowMo: 0, timeout: 90000 })

  try {
    const page = await createAuthenticatedPage(browser, config)
    console.error('Validating configured locations...')
    const officialLocations = await getOfficialLocations(page)
    validateConfiguredLocations(config.locations, officialLocations)
    console.error('All configured locations are valid.')
    const availability = await searchAvailability({
      page,
      locations: config.locations,
      date,
      hours: config.hours.map(String),
      onProgress: reportProgress,
    })

    console.error(`Search complete: ${availability.length} available slot${availability.length === 1 ? '' : 's'} found.\n`)
    if (jsonOutput) {
      console.log(JSON.stringify(availability, null, 2))
    } else if (availability.length === 0) {
      console.log('No available slots found.')
    } else {
      console.table(availability.map(slot => ({
        location: slot.location,
        court: slot.court,
        date: slot.date,
        time: `${slot.hour}:00`,
        price: slot.priceType,
        type: slot.courtType,
      })))
    }
  } finally {
    await browser.close()
  }
}

search().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
