const PLANNING_DATA_URL = 'https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&action=ajax_load_planning'

const normalizeText = value => value.trim().replace(/\s+/g, ' ')

const parsePlanning = async (page, location, date) => {
  const table = page.locator('table.reservation')
  await table.waitFor({ state: 'visible' })

  const courts = await table.locator('thead tr:last-child th:not(:first-child)').evaluateAll(headers => headers.map(header => {
    const tooltip = header.ownerDocument.createElement('div')
    tooltip.innerHTML = header.querySelector('[data-content]')?.getAttribute('data-content') || ''

    return {
      name: header.querySelector('.title')?.textContent || '',
      type: tooltip.querySelector('span')?.textContent || '',
    }
  }))
  const rows = await table.locator('tbody tr').all()
  const slots = []

  for (const row of rows) {
    const cells = await row.locator('td').all()
    const time = normalizeText(await cells[0].innerText())

    for (let index = 1; index < cells.length; index += 1) {
      const cell = cells[index]
      const title = cell.locator('.title-cell')
      const statusElement = await title.count() > 0 ? title : cell.locator('span').first()
      const status = normalizeText(await statusElement.innerText()).toUpperCase()
      if (status !== 'LIBRE' && status !== 'PUBLIC') {
        continue
      }

      const details = status === 'PUBLIC' ? await cell.locator('span').allTextContents() : []
      slots.push({
        location,
        date: date.format('DD/MM/YYYY'),
        time,
        court: normalizeText(courts[index - 1]?.name || ''),
        courtType: normalizeText(courts[index - 1]?.type || ''),
        status,
        ...(details.length > 0 && { details: normalizeText(details.join(' ')) }),
      })
    }
  }

  return slots
}

export const getPlanningSlots = async ({
  page,
  location,
  date,
  onProgress = () => {},
}) => {
  onProgress(`Loading planning data for ${date.format('DD/MM/YYYY')}...`)
  const response = await page.context().request.post(PLANNING_DATA_URL, {
    form: {
      date_selected: date.format('DD/MM/YYYY'),
      name_tennis: location,
    },
  })
  if (!response.ok()) {
    throw new Error(`Planning request failed with HTTP ${response.status()}.`)
  }
  const planningHtml = await response.text()
  if (planningHtml.includes('Aucun créneau pour la date sélectionnée')) {
    onProgress('No planning slots exist for this date.')

    return []
  }

  await page.setContent(planningHtml)
  if (await page.locator('table.reservation').count() === 0) {
    throw new Error('The planning response did not contain the expected table.')
  }
  onProgress('The planning table has been refreshed.')
  onProgress('Reading LIBRE and PUBLIC slots...')

  return parsePlanning(page, location, date)
}
