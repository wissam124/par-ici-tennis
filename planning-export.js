import { chromium } from 'playwright'
import { renameSync, writeFileSync } from 'fs'
import { extname } from 'path'
import { config } from './staticFiles.js'
import { createAuthenticatedPage } from './lib/authenticate.js'
import { getPlanningSlots } from './lib/planning.js'
import { getOfficialLocations } from './lib/locations.js'
import { parseDate, validatePlanningDate } from './lib/dates.js'
import { createPlanningCsv } from './lib/planning-csv.js'

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const exportPlanning = async () => {
  const [, , startArgument, endArgument, outputArgument] = process.argv
  if (!startArgument || !endArgument) {
    throw new Error('Usage: npm run planning-export -- "DD/MM/YYYY" "DD/MM/YYYY" [output.csv]')
  }

  const startDate = parseDate(startArgument)
  const endDate = parseDate(endArgument)
  if (!startDate.isValid() || !endDate.isValid() || endDate.isBefore(startDate, 'day')) {
    throw new Error('Invalid date range. Expected two dates in DD/MM/YYYY format, with the start date first.')
  }
  validatePlanningDate(startDate)
  validatePlanningDate(endDate)

  const dates = []
  for (let date = startDate; !date.isAfter(endDate, 'day'); date = date.add(1, 'day')) {
    dates.push(date)
  }

  const output = outputArgument || `planning-${startDate.format('YYYY-MM-DD')}-to-${endDate.format('YYYY-MM-DD')}.csv`
  const slots = []
  const failures = []
  let locations
  let consecutiveFailures = 0
  let aborted = false

  console.error('Starting the browser...')
  const browser = await chromium.launch({ headless: true, slowMo: 0, timeout: 90000 })

  try {
    console.error('Logging in to Paris Tennis...')
    const page = await createAuthenticatedPage(browser, config)
    console.error('Login successful.')
    console.error('Discovering locations from the Paris Tennis directory...')
    locations = await getOfficialLocations(page)
    console.error(`Discovered ${locations.length} official locations.`)

    const total = locations.length * dates.length
    console.error(`Preparing ${total} planning queries for ${locations.length} locations and ${dates.length} days.`)

    let completed = 0
    queriesLoop:
    for (const location of locations) {
      for (const date of dates) {
        completed += 1
        console.error(`[${completed}/${total}] ${location.name} — ${date.format('DD/MM/YYYY')}`)

        let lastError
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const results = await getPlanningSlots({ page, location: location.name, date })
            slots.push(...results)
            console.error(`  Found ${results.length} LIBRE/PUBLIC slot${results.length === 1 ? '' : 's'}.`)
            lastError = null
            consecutiveFailures = 0
            break
          } catch (error) {
            lastError = error
            if (attempt < 3) {
              const delay = attempt === 1 ? 1000 : 3000
              console.error(`  Query failed (${error.message.split('\n')[0]}). Retrying in ${delay / 1000}s...`)
              await wait(delay)
            }
          }
        }

        if (lastError) {
          failures.push({ location: location.name, date: date.format('DD/MM/YYYY'), error: lastError.message.split('\n')[0] })
          console.error(`  Failed after retry: ${failures.at(-1).error}`)
          consecutiveFailures += 1
          if (consecutiveFailures >= 5) {
            aborted = true
            console.error('Stopping after five consecutive failed queries; the service may be unavailable or rate-limiting requests.')
            break queriesLoop
          }
        }

        await wait(150)
      }
    }
  } finally {
    await browser.close()
  }

  const csv = createPlanningCsv(slots, locations)
  const extension = extname(output)
  const baseOutput = extension ? output.slice(0, -extension.length) : output
  const finalOutput = failures.length > 0 || aborted ? `${baseOutput}.partial${extension || '.csv'}` : output
  const temporaryOutput = `${finalOutput}.tmp`
  writeFileSync(temporaryOutput, csv)
  renameSync(temporaryOutput, finalOutput)

  console.error(`CSV written to ${finalOutput} with ${slots.length} rows.`)
  if (failures.length > 0) {
    console.error(`${failures.length} queries failed: ${JSON.stringify(failures, null, 2)}`)
    process.exitCode = 1
  }
}

exportPlanning().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
