import test from 'node:test'
import assert from 'node:assert/strict'
import { readAvailabilitySlot } from '../lib/availability.js'

const createPage = court => ({
  locator: () => ({
    locator: selector => selector === '.court'
      ? { textContent: async () => court }
      : { innerHTML: async () => 'Tarif plein<br>Couvert' },
  }),
})

test('readAvailabilitySlot extracts reusable booking metadata', async () => {
  const slot = { getAttribute: async () => '1050' }

  assert.deepEqual(await readAvailabilitySlot(createPage(' Court N°2 - Synthétique - Eclairé '), slot, '[datedeb="date"]'), {
    buttonSelector: '[courtid="1050"][datedeb="date"]',
    court: 'Court N°2 - Synthétique - Eclairé',
    courtNumber: 2,
    courtId: '1050',
    priceType: 'Tarif plein',
    courtType: 'Couvert',
  })
})

test('readAvailabilitySlot reports an unrecognised court label clearly', async () => {
  const slot = { getAttribute: async () => '1050' }

  await assert.rejects(readAvailabilitySlot(createPage('Central court'), slot, '[datedeb="date"]'), /Unable to extract a court number/)
})
