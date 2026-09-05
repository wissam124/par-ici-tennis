import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanningSlots } from '../lib/planning.js'
import { parseDate } from '../lib/dates.js'

test('planning data retains LIBRE and PUBLIC slots with court types', () => {
  const planning = {
    courts: [
      { name: ' Court 01 ', type: 'Couvert' },
      { name: 'Court 02', type: 'Découvert' },
    ],
    rows: [
      {
        time: '08h - 09h',
        cells: [
          { status: ' libre ', details: [] },
          { status: 'Club allocation', details: [] },
        ],
      },
      {
        time: '09h - 10h',
        cells: [
          { status: 'PUBLIC', details: ['Réservé le', '04.09.2026 08:00'] },
          { status: 'School', details: [] },
        ],
      },
    ],
  }

  assert.deepEqual(createPlanningSlots(planning, 'Poliveau', parseDate('05/09/2026')), [
    {
      location: 'Poliveau',
      date: '05/09/2026',
      time: '08h - 09h',
      court: 'Court 01',
      courtType: 'Couvert',
      status: 'LIBRE',
    },
    {
      location: 'Poliveau',
      date: '05/09/2026',
      time: '09h - 10h',
      court: 'Court 01',
      courtType: 'Couvert',
      status: 'PUBLIC',
      details: 'Réservé le 04.09.2026 08:00',
    },
  ])
})
