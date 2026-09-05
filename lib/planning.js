const PLANNING_DATA_URL = 'https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&action=ajax_load_planning'

const normalizeText = value => value.trim().replace(/\s+/g, ' ')

export const createPlanningSlots = ({ courts, rows }, location, date) => {
  const slots = []

  for (const row of rows) {
    for (const [index, cell] of row.cells.entries()) {
      const status = normalizeText(cell.status).toUpperCase()
      if (status !== 'LIBRE' && status !== 'PUBLIC') {
        continue
      }

      const details = status === 'PUBLIC' ? cell.details : []
      slots.push({
        location,
        date: date.format('DD/MM/YYYY'),
        time: normalizeText(row.time),
        court: normalizeText(courts[index]?.name || ''),
        courtType: normalizeText(courts[index]?.type || ''),
        status,
        ...(details.length > 0 && { details: normalizeText(details.join(' ')) }),
      })
    }
  }

  return slots
}

const parsePlanning = async (page, location, date) => {
  const table = page.locator('table.reservation')
  await table.waitFor({ state: 'visible' })

  const planning = await table.evaluate(element => {
    const courts = [...element.querySelectorAll('thead tr:last-child th:not(:first-child)')].map(header => {
      const tooltip = header.ownerDocument.createElement('div')
      tooltip.innerHTML = header.querySelector('[data-content]')?.getAttribute('data-content') || ''

      return {
        name: header.querySelector('.title')?.textContent || '',
        type: tooltip.querySelector('span')?.textContent || '',
      }
    })
    const rows = [...element.querySelectorAll('tbody tr')].map(row => {
      const cells = [...row.querySelectorAll('td')]

      return {
        time: cells[0]?.innerText || '',
        cells: cells.slice(1).map(cell => ({
          status: (cell.querySelector('.title-cell') || cell.querySelector('span'))?.innerText || '',
          details: [...cell.querySelectorAll('span')].map(span => span.innerText),
        })),
      }
    })

    return { courts, rows }
  })

  return createPlanningSlots(planning, location, date)
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
