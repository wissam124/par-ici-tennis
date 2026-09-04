import { chromium } from 'playwright'
import { config } from './staticFiles.js'
import { createAuthenticatedPage } from './lib/authenticate.js'
import { getPlanningSlots } from './lib/planning.js'
import { parseDate, validatePlanningDate } from './lib/dates.js'
import { getOfficialLocations, validateConfiguredLocations } from './lib/locations.js'

const planning = async () => {
  const [, , location, dateArgument, ...options] = process.argv
  if (!location || !dateArgument) {
    throw new Error('Usage: npm run planning -- "Poliveau" "DD/MM/YYYY" [--json]')
  }
  const jsonOutput = options.includes('--json')

  const date = parseDate(dateArgument)
  if (!date.isValid()) {
    throw new Error('Invalid date. Expected the format DD/MM/YYYY.')
  }
  validatePlanningDate(date)

  console.error(`Preparing to load the planning for ${location} on ${date.format('DD/MM/YYYY')}...`)
  console.error('Starting the browser...')
  const browser = await chromium.launch({ headless: true, slowMo: 0, timeout: 90000 })

  try {
    console.error('Logging in to Paris Tennis...')
    const page = await createAuthenticatedPage(browser, config)
    console.error('Login successful.')
    const officialLocations = await getOfficialLocations(page)
    validateConfiguredLocations([location], officialLocations, 'command line')
    const slots = await getPlanningSlots({
      page,
      location,
      date,
      onProgress: message => console.error(message),
    })
    const freeCount = slots.filter(slot => slot.status === 'LIBRE').length
    const publicCount = slots.filter(slot => slot.status === 'PUBLIC').length

    console.error(`Planning loaded: ${freeCount} LIBRE and ${publicCount} PUBLIC slot${slots.length === 1 ? '' : 's'} found.\n`)
    if (jsonOutput) {
      console.log(JSON.stringify(slots, null, 2))
    } else if (slots.length === 0) {
      console.log('No LIBRE or PUBLIC slots found.')
    } else {
      const sortedSlots = [...slots].sort((first, second) => {
        const statusOrder = first.status.localeCompare(second.status)

        return statusOrder || Number.parseInt(first.time) - Number.parseInt(second.time)
      })

      console.table(sortedSlots.map(slot => ({
        court: slot.court,
        time: slot.time,
        status: slot.status,
        details: slot.details || '',
      })))
    }
  } finally {
    await browser.close()
  }
}

planning().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
