import { chromium } from 'playwright'
import { config } from './staticFiles.js'
import { createAuthenticatedPage } from './lib/authenticate.js'
import { getPlanningSlots } from './lib/planning.js'
import { formatAvailabilityHour } from './lib/availability.js'
import { getOfficialLocations } from './lib/locations.js'
import { parseDate, parisToday, validatePlanningDate } from './lib/dates.js'

const readOptions = argumentsList => {
  const options = {}
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (!argument.startsWith('--')) throw new Error(`Unknown argument: ${argument}`)
    const name = argument.slice(2)
    if (!['location', 'date', 'time'].includes(name)) throw new Error(`Unknown option: --${name}`)
    const value = argumentsList[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}.`)
    options[name] = value
    index += 1
  }
  return options
}

const usage = 'Usage: npm run planning-search -- [--location "Poliveau"] [--date "DD/MM/YYYY"] [--time "09"]'

const planningSearch = async () => {
  const options = readOptions(process.argv.slice(2))
  if (options.date) {
    options.date = parseDate(options.date)
    if (!options.date.isValid()) throw new Error('Invalid date. Expected the format DD/MM/YYYY.')
    validatePlanningDate(options.date)
  }
  if (options.time && !/^\d{1,2}$/.test(options.time)) {
    throw new Error('Invalid time. Expected an hour such as 9 or 09.')
  }
  const requestedTime = options.time ? formatAvailabilityHour(options.time) : null
  const dates = options.date
    ? [options.date]
    : Array.from({ length: 7 }, (_, index) => parisToday().add(index, 'day'))

  console.error('Starting the browser...')
  const browser = await chromium.launch({ headless: true, slowMo: 0, timeout: 90000 })
  try {
    console.error('Logging in to Paris Tennis...')
    const page = await createAuthenticatedPage(browser, config)
    console.error('Login successful.')
    console.error('Discovering locations from the Paris Tennis directory...')
    const officialLocations = await getOfficialLocations(page)
    const locations = options.location
      ? officialLocations.filter(location => location.name.localeCompare(options.location, 'fr', { sensitivity: 'base' }) === 0)
      : officialLocations
    if (options.location && locations.length === 0) throw new Error(`Invalid location: ${options.location}`)

    const slots = []
    const totalQueries = locations.length * dates.length
    let completedQueries = 0
    console.error(`Searching ${totalQueries} planning combination${totalQueries === 1 ? '' : 's'}...`)
    for (const location of locations) {
      for (const date of dates) {
        completedQueries += 1
        console.error(`[${completedQueries}/${totalQueries}] ${location.name} — ${date.format('DD/MM/YYYY')}`)
        const results = await getPlanningSlots({ page, location: location.name, date })
        slots.push(...results
          .filter(slot => slot.status === 'LIBRE' && (!requestedTime || slot.time.startsWith(`${requestedTime}h`)))
          .map(slot => ({ ...slot, arrondissement: location.arrondissement })))
      }
    }

    slots.sort((first, second) => first.date.localeCompare(second.date)
      || Number(first.arrondissement) - Number(second.arrondissement)
      || first.location.localeCompare(second.location, 'fr')
      || Number.parseInt(first.time) - Number.parseInt(second.time)
      || first.court.localeCompare(second.court, 'fr'))

    if (slots.length === 0) {
      console.log('No LIBRE slots found.')
    } else {
      console.table(slots.map(slot => ({
        location: slot.location,
        arrondissement: slot.arrondissement,
        date: slot.date,
        day: parseDate(slot.date).format('dddd'),
        court: slot.court,
        type: slot.courtType,
        time: slot.time,
      })))
    }
  } finally {
    await browser.close()
  }
}

planningSearch().catch(error => {
  console.error(`${error.message}\n${usage}`)
  process.exitCode = 1
})
