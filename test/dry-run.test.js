import test from 'node:test'
import assert from 'node:assert/strict'
import { cancelDryRunSelection } from '../lib/dry-run.js'
import { SEARCH_URL } from '../lib/availability.js'

const createPage = ({ previousVisible = true, searchVisible = true } = {}) => {
  const actions = []
  const locator = selector => ({
    filter: () => locator(selector),
    count: async () => selector === '#previous' && previousVisible ? 1 : 0,
    click: async () => actions.push(`click ${selector}`),
    waitFor: async () => {
      if (selector === '.tokens-input-text' && !searchVisible) {
        throw new Error('Search page was not restored.')
      }
      actions.push(`wait ${selector}`)
    },
  })

  return {
    actions,
    locator,
    goto: async url => actions.push(`goto ${url}`),
  }
}

test('dry-run cleanup cancels and verifies the availability page', async () => {
  const page = createPage()

  await cancelDryRunSelection(page, () => {})

  assert.deepEqual(page.actions, [
    'click #previous',
    'wait #btnCancelBooking',
    'click #btnCancelBooking',
    `goto ${SEARCH_URL}`,
    'wait .tokens-input-text',
  ])
})

test('dry-run cleanup fails when the availability page is not restored', async () => {
  const page = createPage({ previousVisible: false, searchVisible: false })

  await assert.rejects(cancelDryRunSelection(page, () => {}), /Search page was not restored/)
  assert.equal(page.actions.includes('click #previous'), false)
  assert.equal(page.actions.includes('click #btnCancelBooking'), true)
})
