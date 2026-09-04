const LOCATIONS_URL = 'https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennisParisien&view=les_tennis_parisiens'

const normalizeName = name => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase()

export const parseOfficialLocations = html => {
  const marker = html.search(/var\s+tennis\s*=/)
  if (marker < 0) {
    throw new Error('Could not find location metadata on the Paris Tennis directory page.')
  }

  const start = html.indexOf('{', marker)
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const character = html[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        const directory = JSON.parse(html.slice(start, index + 1))
        const locations = new Map()

        for (const feature of directory.features) {
          const location = feature.properties.general
          const key = normalizeName(location._nomSrtm)
          if (!locations.has(key)) {
            locations.set(key, {
              name: location._nomSrtm,
              arrondissement: location._arrondissement,
            })
          }
        }

        return [...locations.values()]
      }
    }
  }

  throw new Error('Could not parse location metadata from the Paris Tennis directory page.')
}

export const getOfficialLocations = async page => {
  await page.goto(LOCATIONS_URL)
  await page.waitForLoadState('domcontentloaded')

  const html = await page.content()
  return parseOfficialLocations(html)
}

export const validateConfiguredLocations = (configuredLocations, officialLocations, source = 'config.json') => {
  const names = Array.isArray(configuredLocations)
    ? configuredLocations
    : Object.keys(configuredLocations || {})
  const officialNames = new Set(officialLocations.map(location => normalizeName(location.name)))
  const invalidNames = names.filter(name => !officialNames.has(normalizeName(name)))

  if (invalidNames.length > 0) {
    throw new Error(`Invalid location${invalidNames.length === 1 ? '' : 's'} in ${source}: ${invalidNames.join(', ')}`)
  }
}
