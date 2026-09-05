export const SEARCH_URL = 'https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&view=recherche_creneau#!'

const normalizeLocations = locations => {
  if (Array.isArray(locations)) {
    return locations.map(name => ({ name, courtNumbers: [] }))
  }

  return Object.entries(locations || {}).map(([name, courtNumbers]) => ({
    name,
    courtNumbers: Array.isArray(courtNumbers) ? courtNumbers : [],
  }))
}

const getCourtNumber = court => {
  const match = court.match(/Court N°(\d+)/)

  return match ? Number(match[1]) : null
}

export const readAvailabilitySlot = async (page, slot, slotSelector) => {
  const courtId = await slot.getAttribute('courtid')
  if (!courtId) {
    throw new Error('An available slot did not contain a court ID.')
  }

  const buttonSelector = `[courtid="${courtId}"]${slotSelector}`
  const row = page.locator(`.row.tennis-court:has(${buttonSelector})`)
  const court = (await row.locator('.court').textContent()).trim().replace(/\s+/g, ' ')
  const courtNumber = getCourtNumber(court)
  if (courtNumber === null) {
    throw new Error(`Unable to extract a court number from "${court}".`)
  }

  const priceDescription = await row.locator('.price-description').innerHTML()
  const [priceType = '', courtType = ''] = priceDescription.split('<br>')

  return {
    buttonSelector,
    court,
    courtNumber,
    courtId,
    priceType: priceType.trim(),
    courtType: courtType.trim(),
  }
}

const selectLocation = async (page, location) => {
  const input = page.locator('.tokens-input-text')
  await input.pressSequentially(`${location} `)

  const suggestion = page
    .locator('.tokens-suggestions-list-element')
    .filter({ has: page.getByText(location, { exact: true }) })
    .first()

  await suggestion.waitFor({ state: 'visible' })
  await suggestion.click()

  const visibleSuggestionList = page.locator('.tokens-suggestion-selector').filter({ visible: true })
  try {
    await visibleSuggestionList.waitFor({ state: 'hidden', timeout: 3000 })
  } catch {
    await page.keyboard.press('Escape')
    await visibleSuggestionList.waitFor({ state: 'hidden', timeout: 3000 })
  }
}

export const submitAvailabilitySearch = async (page, location, date) => {
  await page.goto(SEARCH_URL)
  await selectLocation(page, location)

  await page.click('#when')
  const dateOption = page.locator(`[dateiso="${date.format('DD/MM/YYYY')}"]`).filter({ visible: true })
  await dateOption.click()
  await page.waitForSelector('.date-picker', { state: 'hidden' })
  await page.click('#rechercher')
  await page.waitForLoadState('domcontentloaded')
}

const searchLocationOnce = async (page, location, date, hours, onProgress) => {
  await submitAvailabilitySearch(page, location.name, date)

  const availability = []

  for (const hour of hours) {
    const hourAvailability = []
    const slotSelector = `[datedeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
    const slots = await page.locator(slotSelector).all()

    for (const slot of slots) {
      const court = await readAvailabilitySlot(page, slot, slotSelector)

      if (location.courtNumbers.length > 0 && !location.courtNumbers.includes(court.courtNumber)) {
        continue
      }

      hourAvailability.push({
        location: location.name,
        court: court.court,
        courtNumber: court.courtNumber,
        courtId: court.courtId,
        date: date.format('DD/MM/YYYY'),
        hour,
        available: true,
        priceType: court.priceType,
        courtType: court.courtType,
      })
    }

    availability.push(...hourAvailability)
    onProgress({
      type: 'hour-result',
      location: location.name,
      hour,
      courts: hourAvailability.map(result => result.court),
    })
  }

  return availability
}

const searchLocation = async (page, location, date, hours, onProgress) => {
  onProgress({
    type: 'location-start',
    location: location.name,
    date: date.format('DD/MM/YYYY'),
  })

  try {
    return await searchLocationOnce(page, location, date, hours, onProgress)
  } catch (error) {
    onProgress({
      type: 'location-retry',
      location: location.name,
      error: error.message.split('\n')[0],
    })

    return searchLocationOnce(page, location, date, hours, onProgress)
  }
}

export const searchAvailability = async ({
  page,
  locations,
  date,
  hours,
  onProgress = () => {},
}) => {
  const availability = []

  for (const location of normalizeLocations(locations)) {
    availability.push(...await searchLocation(page, location, date, hours, onProgress))
  }

  return availability
}
