import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

const DATE_FORMATS = ['D/M/YYYY', 'D/MM/YYYY', 'DD/M/YYYY', 'DD/MM/YYYY']
const PARIS_TIMEZONE = 'Europe/Paris'

export const parseDate = value => {
  const parsed = dayjs(value, DATE_FORMATS, true)

  return parsed.isValid()
    ? dayjs.tz(parsed.format('YYYY-MM-DD'), 'YYYY-MM-DD', PARIS_TIMEZONE)
    : parsed
}

export const parisToday = () => dayjs().tz(PARIS_TIMEZONE).startOf('day')

export const validatePlanningDate = (date, today = parisToday()) => {
  const lastAvailableDay = today.add(6, 'days')
  if (date.isBefore(today, 'day') || date.isAfter(lastAvailableDay, 'day')) {
    throw new Error(`The date must be between ${today.format('DD/MM/YYYY')} and ${lastAvailableDay.format('DD/MM/YYYY')}.`)
  }
}

export const getConfiguredDate = (value, { required = false } = {}) => {
  if (!value) {
    if (required) {
      throw new Error('The date field is required in config.json.')
    }

    return null
  }

  const date = parseDate(value)
  if (!date.isValid()) {
    throw new Error('Invalid date in config.json. Expected the format D/M/YYYY or DD/MM/YYYY.')
  }

  validatePlanningDate(date)

  return date
}
