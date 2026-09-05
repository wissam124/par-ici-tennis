import test from 'node:test'
import assert from 'node:assert/strict'
import { validateBookingConfig, validateSearchConfig } from '../lib/config.js'

const validConfig = {
  locations: { Poliveau: [1] },
  hours: ['19', '21'],
  priceType: ['Tarif plein'],
  courtType: ['Couvert'],
  players: [{ firstName: 'Ada', lastName: 'Lovelace' }],
}

test('valid search and booking configurations pass', () => {
  assert.doesNotThrow(() => validateSearchConfig(validConfig))
  assert.doesNotThrow(() => validateBookingConfig(validConfig))
})

test('search configuration rejects invalid hours', () => {
  assert.throws(() => validateSearchConfig({ ...validConfig, hours: ['22'] }), /Invalid hour/)
})

test('booking configuration rejects invalid court numbers', () => {
  assert.throws(() => validateBookingConfig({
    ...validConfig,
    locations: { Poliveau: ['one'] },
  }), /positive integers/)
})

test('booking configuration rejects unsupported price and court types', () => {
  assert.throws(() => validateBookingConfig({ ...validConfig, priceType: ['Free'] }), /priceType/)
  assert.throws(() => validateBookingConfig({ ...validConfig, courtType: ['Clay'] }), /courtType/)
})

test('booking configuration rejects a non-boolean logLocationNames value', () => {
  assert.throws(() => validateBookingConfig({ ...validConfig, logLocationNames: 'yes' }), /logLocationNames/)
})

test('booking configuration rejects incomplete players', () => {
  assert.throws(() => validateBookingConfig({
    ...validConfig,
    players: [{ firstName: '', lastName: 'Lovelace' }],
  }), /firstName and lastName/)
})
