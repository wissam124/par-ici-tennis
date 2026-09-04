import test from 'node:test'
import assert from 'node:assert/strict'
import { getConfiguredDate, parseDate, validatePlanningDate } from '../lib/dates.js'

test('parseDate accepts padded and unpadded dates', () => {
  for (const value of ['2/8/2026', '2/08/2026', '02/8/2026', '02/08/2026']) {
    assert.equal(parseDate(value).format('YYYY-MM-DD'), '2026-08-02')
  }
})

test('parseDate rejects invalid calendar dates and formats', () => {
  assert.equal(parseDate('31/02/2026').isValid(), false)
  assert.equal(parseDate('2026-08-02').isValid(), false)
})

test('validatePlanningDate accepts the seven-day window', () => {
  const today = parseDate('04/09/2026')

  assert.doesNotThrow(() => validatePlanningDate(today, today))
  assert.doesNotThrow(() => validatePlanningDate(parseDate('10/09/2026'), today))
})

test('validatePlanningDate rejects dates outside the seven-day window', () => {
  const today = parseDate('04/09/2026')

  assert.throws(() => validatePlanningDate(parseDate('03/09/2026'), today), /between/)
  assert.throws(() => validatePlanningDate(parseDate('11/09/2026'), today), /between/)
})

test('getConfiguredDate enforces required dates', () => {
  assert.throws(() => getConfiguredDate(null, { required: true }), /required/)
})
