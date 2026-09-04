import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOfficialLocations, validateConfiguredLocations } from '../lib/locations.js'

const directoryHtml = `
  <script>
    var   tennis = {
      "features": [
        {"properties":{"general":{"_nomSrtm":"Poliveau","_arrondissement":5}}},
        {"properties":{"general":{"_nomSrtm":"Poliveau","_arrondissement":5}}},
        {"properties":{"general":{"_nomSrtm":"Thiéré","_arrondissement":11}}}
      ]
    };
  </script>
`

test('parseOfficialLocations handles whitespace and removes duplicates', () => {
  assert.deepEqual(parseOfficialLocations(directoryHtml), [
    { name: 'Poliveau', arrondissement: 5 },
    { name: 'Thiéré', arrondissement: 11 },
  ])
})

test('location validation ignores case, accents, spaces, and punctuation', () => {
  const official = parseOfficialLocations(directoryHtml)

  assert.doesNotThrow(() => validateConfiguredLocations(['POLIVEAU', 'Thiere'], official))
})

test('location validation reports invalid names and their source', () => {
  const official = parseOfficialLocations(directoryHtml)

  assert.throws(
    () => validateConfiguredLocations(['Unknown'], official, 'command line'),
    /Invalid location in command line: Unknown/,
  )
})

test('parseOfficialLocations reports missing metadata', () => {
  assert.throws(() => parseOfficialLocations('<html></html>'), /Could not find/)
})
