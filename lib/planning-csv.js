import { parseDate } from './dates.js'

const csvValue = value => {
  const escaped = String(value).replaceAll('"', '""')

  return `"${escaped}"`
}

export const createPlanningCsv = (slots, locations) => {
  const arrondissementByLocation = new Map(locations.map(location => [location.name, location.arrondissement]))
  const header = ['location name', 'arrondissement', 'court number', 'day', 'date', 'hourly slot', 'status']
  const rows = slots.map(slot => [
    slot.location,
    arrondissementByLocation.get(slot.location) || '',
    slot.court.match(/\d+/)?.[0] || slot.court,
    parseDate(slot.date).format('dddd'),
    slot.date,
    slot.time,
    slot.status,
  ])

  return '\uFEFF' + [header, ...rows].map(row => row.map(csvValue).join(',')).join('\n') + '\n'
}
