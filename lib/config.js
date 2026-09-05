const PRICE_TYPES = new Set(['Tarif plein', 'Tarif réduit'])
const COURT_TYPES = new Set(['Découvert', 'Couvert'])

const hasLocations = locations => Array.isArray(locations)
  ? locations.length > 0
  : locations !== null
    && typeof locations === 'object'
    && Object.keys(locations).length > 0

const validateStringArray = (value, field, acceptedValues) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`The ${field} field must be a non-empty array.`)
  }

  const invalid = value.filter(item => typeof item !== 'string' || !acceptedValues.has(item))
  if (invalid.length > 0) {
    throw new Error(`Invalid ${field} value${invalid.length === 1 ? '' : 's'}: ${invalid.join(', ')}`)
  }
}

export const validateSearchConfig = config => {
  if (!hasLocations(config.locations)) {
    throw new Error('The locations field must contain at least one tennis location.')
  }
  if (!Array.isArray(config.hours) || config.hours.length === 0) {
    throw new Error('The hours field must contain at least one hour.')
  }

  const invalidHours = config.hours.filter(hour => {
    const value = Number(hour)

    return !Number.isInteger(value) || value < 8 || value > 21
  })
  if (invalidHours.length > 0) {
    throw new Error(`Invalid hour${invalidHours.length === 1 ? '' : 's'}: ${invalidHours.join(', ')}. Expected whole hours from 8 to 21.`)
  }
}

export const validateBookingConfig = config => {
  validateSearchConfig(config)
  validateStringArray(config.priceType, 'priceType', PRICE_TYPES)
  validateStringArray(config.courtType, 'courtType', COURT_TYPES)
  if (config.logLocationNames !== undefined && typeof config.logLocationNames !== 'boolean') {
    throw new Error('The logLocationNames field must be a boolean.')
  }

  if (!Array.isArray(config.players) || config.players.length > 3) {
    throw new Error('The players field must be an array containing at most three players.')
  }
  for (const player of config.players) {
    if (!player || typeof player.firstName !== 'string' || !player.firstName.trim()
      || typeof player.lastName !== 'string' || !player.lastName.trim()) {
      throw new Error('Each player must have a non-empty firstName and lastName.')
    }
  }

  if (!Array.isArray(config.locations)) {
    for (const [location, courtNumbers] of Object.entries(config.locations)) {
      if (!Array.isArray(courtNumbers) || courtNumbers.some(number => !Number.isInteger(number) || number < 1)) {
        throw new Error(`Court numbers for ${location} must be positive integers.`)
      }
    }
  }
}
