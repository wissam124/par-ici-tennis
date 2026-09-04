import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanningCsv } from '../lib/planning-csv.js'

test('planning CSV includes arrondissement and status', () => {
  const csv = createPlanningCsv([
    {
      location: 'Poliveau',
      court: 'Court 01',
      date: '05/09/2026',
      time: '08h - 09h',
      status: 'PUBLIC',
    },
  ], [{ name: 'Poliveau', arrondissement: 5 }])

  assert.equal(csv, [
    '"location name","arrondissement","court number","day","date","hourly slot","status"',
    '"Poliveau","5","01","Saturday","05/09/2026","08h - 09h","PUBLIC"',
    '',
  ].join('\n'))
})

test('planning CSV escapes quotes', () => {
  const csv = createPlanningCsv([
    {
      location: 'Court "Test"',
      court: 'Central',
      date: '05/09/2026',
      time: '08h - 09h',
      status: 'LIBRE',
    },
  ], [{ name: 'Court "Test"', arrondissement: 1 }])

  assert.match(csv, /"Court ""Test"""/)
})
