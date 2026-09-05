import { chromium } from 'playwright'
import dayjs from 'dayjs'
import { writeFileSync } from 'fs'
import { createEvent } from 'ics'
import { config } from './staticFiles.js'
import { notify } from './lib/ntfy.js'
import { createAuthenticatedPage } from './lib/authenticate.js'
import { getOfficialLocations, validateConfiguredLocations } from './lib/locations.js'
import { readAvailabilitySlot, submitAvailabilitySearch } from './lib/availability.js'
import { getConfiguredDate, parisToday } from './lib/dates.js'
import { validateBookingConfig } from './lib/config.js'
import { cancelDryRunSelection } from './lib/dry-run.js'

const bookTennis = async () => {
  const DRY_RUN_MODE = process.argv.includes('--dry-run')
  validateBookingConfig(config)
  const configuredDate = getConfiguredDate(config.date)

  if (DRY_RUN_MODE) {
    console.log('----- DRY RUN START -----')
    console.log('Script lancé en mode DRY RUN. Une sélection temporaire sera créée puis annulée ; aucune réservation définitive ne sera envoyée.')
  }

  console.log(`${dayjs().format()} - Starting searching tennis`)
  const browser = await chromium.launch({ headless: true, slowMo: 0, timeout: 90000 })
  let page
  let dryRunSelectionActive = false
  let matchingSlotFound = false

  try {
    console.log(`${dayjs().format()} - Browser started`)
    page = await createAuthenticatedPage(browser, config)

    console.log(`${dayjs().format()} - User connected`)

    console.log(`${dayjs().format()} - Validating configured locations`)
    const officialLocations = await getOfficialLocations(page)
    validateConfiguredLocations(config.locations, officialLocations)
    console.log(`${dayjs().format()} - All configured locations are valid`)

    const locations = !Array.isArray(config.locations) ? Object.keys(config.locations) : config.locations
    const date = configuredDate || parisToday().add(6, 'days')
    const showLocationNames = !process.env.GITHUB_ACTIONS || config.logLocationNames === true
    console.log(`${dayjs().format()} - Requested date: ${date.format('DD/MM/YYYY')}`)
    console.log(`${dayjs().format()} - Requested hours: ${config.hours.map(hour => `${hour}:00`).join(', ')}`)
    console.log('Requested locations and courts:')
    console.table(locations.flatMap((location, index) => {
      const courtNumbers = !Array.isArray(config.locations) ? config.locations[location] : []
      const displayLocation = showLocationNames ? location : `location ${index + 1}`

      return courtNumbers.length > 0
        ? courtNumbers.map(number => ({ location: displayLocation, court: `Court N°${number}` }))
        : [{ location: displayLocation, court: 'All courts' }]
    }))

    locationsLoop:
    for (const [i, location] of locations.entries()) {
      const logLocation = showLocationNames ? location : `location ${i + 1}`
      const courtNumbers = !Array.isArray(config.locations) ? config.locations[location] : []
      console.log(`${dayjs().format()} - Search at ${logLocation}`)
      if (courtNumbers.length > 0) {
        console.log(`${dayjs().format()} - Courts requested at ${logLocation}: ${courtNumbers.map(number => `Court N°${number}`).join(', ')}`)
      } else {
        console.log(`${dayjs().format()} - All courts accepted at ${logLocation}`)
      }
      await submitAvailabilitySearch(page, location, date)

      let selectedHour
      hoursLoop:
      for (const hour of config.hours) {
        const dateDeb = `[datedeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
        if (await page.locator(dateDeb).count()) {
          if (await page.isHidden(dateDeb)) {
            await page.click(`#head${location.replaceAll(' ', '')}${hour}h .panel-title`)
          }

          const slots = await page.locator(dateDeb).all()
          for (const slot of slots) {
            const court = await readAvailabilitySlot(page, slot, dateDeb)
            if (courtNumbers.length > 0 && !courtNumbers.includes(court.courtNumber)) {
              continue
            }

            console.log(`${dayjs().format()} - Checking ${court.court} at ${hour}:00 — ${court.priceType} / ${court.courtType}`)
            if (!config.priceType.includes(court.priceType) || !config.courtType.includes(court.courtType)) {
              console.log(`${dayjs().format()} - Skipping ${court.court}: ${court.priceType} / ${court.courtType} does not match booking preferences`)
              continue
            }
            selectedHour = hour
            console.log(`${dayjs().format()} - Selecting ${court.court} at ${hour}:00`)
            await page.click(court.buttonSelector)
            dryRunSelectionActive = DRY_RUN_MODE

            break hoursLoop
          }
        }
      }

      if (await page.title() !== 'Paris | TENNIS - Reservation') {
        if (selectedHour) {
          throw new Error(`The selected ${selectedHour}:00 slot at ${logLocation} did not open the expected reservation page.`)
        }
        console.log(`${dayjs().format()} - Failed to find reservation for ${logLocation}`)
        continue
      }

      await page.waitForSelector('.order-steps-infos h2 >> text="1 / 3 - Validation du court"')
      matchingSlotFound = true

      for (const [i, player] of config.players.entries()) {
        if (i > 0) {
          await page.click('.addPlayer')
        }
        await page.waitForSelector(`[name="player${i + 1}"]`)
        await page.fill(`[name="player${i + 1}"] >> nth=0`, player.lastName)
        await page.fill(`[name="player${i + 1}"] >> nth=1`, player.firstName)
      }

      await page.keyboard.press('Enter')

      await page.waitForSelector('#order_select_payment_form #paymentMode', { state: 'attached' })
      const paymentMode = page.locator('#order_select_payment_form #paymentMode')
      await paymentMode.evaluate(el => {
        el.removeAttribute('readonly')
        el.style.display = 'block'
      })
      await paymentMode.fill('existingTicket')

      if (DRY_RUN_MODE) {
        console.log(`${dayjs().format()} - Temporary dry-run selection created: ${logLocation}`)
        if (!process.env.GITHUB_ACTIONS) console.log(`pour le ${date.format('YYYY/MM/DD')} à ${selectedHour}h`)
        await cancelDryRunSelection(page)
        dryRunSelectionActive = false
        console.log('----- DRY RUN END -----')
        console.log('Pour réellement réserver un créneau, relancez le script sans le paramètre --dry-run')

        break locationsLoop
      }

      const submit = page.locator('#order_select_payment_form #envoyer')
      await submit.evaluate(el => el.classList.remove('hide'))
      await submit.click()

      await page.waitForSelector('.confirmReservation')

      // Extract reservation details
      const address = (await page.locator('.address').textContent()).trim().replace(/( ){2,}/g, ' ')
      const dateStr = (await page.locator('.date').textContent()).trim().replace(/( ){2,}/g, ' ')
      const court = (await page.locator('.court').textContent()).trim().replace(/( ){2,}/g, ' ')

      if (!process.env.GITHUB_ACTIONS) {
        console.log(`${dayjs().format()} - Réservation faite : ${address}`)
        console.log(`pour le ${dateStr}`)
        console.log(`sur le ${court}`)
      } else {
        console.log('Réservation faite, regardez vos emails ou rendez-vous sur votre compte tennis.paris.fr pour plus de détails sur votre réservation.')
      }

      const [day, month, year] = [date.date(), date.month() + 1, date.year()]
      const hourMatch = dateStr.match(/(\d{2})h/)
      const hour = hourMatch ? Number(hourMatch[1]) : 12
      const start = [year, month, day, hour, 0]
      const duration = { hours: 1, minutes: 0 }
      const event = {
        start,
        duration,
        title: 'Réservation Tennis',
        description: `Court: ${court}\nAdresse: ${address}`,
        location: address,
        status: 'CONFIRMED',
      }

      const createdEvent = createEvent(event)
      if (createdEvent.error) {
        console.log('ICS creation error:', createdEvent.error)

        break
      }

      const { value } = createdEvent
      if (!process.env.GITHUB_ACTIONS) {
        writeFileSync('event.ics', value)
      }
      if (config.ntfy?.enable === true || process.env.NTFY_TOPIC) {
        await notify(Buffer.from(value, 'utf8'), 'event.ics',
          `Confirmation pour le ${date.format('DD/MM/YYYY')} - ${hour}h`, {
            domain: config?.ntfy?.domain || process.env.NTFY_DOMAIN,
            topic: config?.ntfy?.topic || process.env.NTFY_TOPIC,
          })
      }

      break
    }

    if (!matchingSlotFound) {
      console.log(`${dayjs().format()} - Booking search completed successfully.`)
      console.log(`${dayjs().format()} - No matching court was available; no reservation was made.`)
      if (process.env.GITHUB_ACTIONS) {
        console.log('::warning title=No court booked::The search completed successfully, but no matching court was available.')
      }
    }
  } catch (error) {
    process.exitCode = 1
    console.error(error)
    let screenshot
    if (page && !page.isClosed()) {
      try {
        screenshot = await page.screenshot({ path: 'img/failure.png' })
      } catch (screenshotError) {
        console.error('Unable to capture failure screenshot:', screenshotError.message)
      }
    }

    if (dryRunSelectionActive && page && !page.isClosed()) {
      try {
        console.log(`${dayjs().format()} - Cleaning up the dry-run selection after an error...`)
        await cancelDryRunSelection(page)
        dryRunSelectionActive = false
      } catch (cleanupError) {
        console.error(`${dayjs().format()} - First cleanup attempt failed: ${cleanupError.message}`)
      }
    }

    if (screenshot && (config.ntfy?.enable === true || process.env.NTFY_TOPIC)) {
      await notify(screenshot, 'failure.png', 'Erreur lors de l\'execution du programme.', {
        domain: config?.ntfy?.domain || process.env.NTFY_DOMAIN,
        topic: config?.ntfy?.topic || process.env.NTFY_TOPIC,
      })
    }
  } finally {
    if (dryRunSelectionActive && page && !page.isClosed()) {
      try {
        console.log(`${dayjs().format()} - Retrying dry-run cleanup before closing the browser...`)
        await cancelDryRunSelection(page)
        dryRunSelectionActive = false
      } catch (cleanupError) {
        process.exitCode = 1
        console.error(`${dayjs().format()} - WARNING: Unable to confirm cancellation of the temporary dry-run selection: ${cleanupError.message}`)
        console.error('Open Paris Tennis in a browser and cancel any pending reservation before running the script again.')
      }
    }
    await browser.close()
  }
}

bookTennis().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
