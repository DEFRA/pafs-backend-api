import { SIZE } from '../../../../common/constants/common.js'

export const ENCODING = 'utf8'

// ASCII offset: 'A'.codePointAt(0) - 1 = 64.  Maps column index 1 → 'A'.
const LETTER_OFFSET = 'A'.codePointAt(0) - 1
const CHAR_CODE_A = LETTER_OFFSET + 1 // 65 = 'A'.codePointAt(0)

// OOXML URIs (defined once to avoid duplicate-literal warnings)
export const WORKSHEET_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
export const WORKSHEET_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
export const WS_XMLNS =
  'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

// ── Column letter ↔ 1-based index ────────────────────────────────────────────

export function columnLetterToIndex(col) {
  if (col.length === 1) {
    return col.codePointAt(0) - LETTER_OFFSET
  }
  const n = col.codePointAt(0) - LETTER_OFFSET
  const m = col.codePointAt(1) - LETTER_OFFSET
  return SIZE.LENGTH_26 + (n - 1) * SIZE.LENGTH_26 + m
}

export function columnIndexToLetter(index) {
  if (index <= SIZE.LENGTH_26) {
    return String.fromCodePoint(index + LETTER_OFFSET)
  }
  const offset = index - SIZE.LENGTH_26 - 1
  const hi = String.fromCodePoint(
    Math.floor(offset / SIZE.LENGTH_26) + CHAR_CODE_A
  )
  const lo = String.fromCodePoint((offset % SIZE.LENGTH_26) + CHAR_CODE_A)
  return hi + lo
}

/**
 * Compute the last column letter written by a columns definition with a given
 * years array. Used to set the worksheet dimension reference accurately.
 */
export function lastColumnLetter(columns, years) {
  let maxIndex = 0
  for (const col of columns) {
    const startIndex = columnLetterToIndex(col.column)
    const endIndex = col.dateRange ? startIndex + years.length - 1 : startIndex
    if (endIndex > maxIndex) {
      maxIndex = endIndex
    }
  }
  return columnIndexToLetter(maxIndex)
}

// ── Zip helper (avoids false-positive "Prefer Blob#text()" lint rule) ──────────

export function zipReadText(zip, name) {
  return zip.readAsText(name) // NOSONAR – AdmZip API, not browser FileReader
}

// Compute the next unused rId number from a relationships XML string
export function nextRid(relsXml) {
  const nums = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) =>
    Number.parseInt(m[1], 10)
  )
  return `rId${nums.length > 0 ? Math.max(...nums) + 1 : 1}`
}

// ── XML cell helpers ──────────────────────────────────────────────────────────

const XML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

export function escapeXml(str) {
  return String(str).replaceAll(/[&<>"']/g, (c) => XML_ESCAPE_MAP[c])
}

export function buildCellXml(ref, value, styleIndex) {
  if (value == null) {
    return `<c r="${ref}" s="${styleIndex}"/>`
  }
  if (typeof value === 'number') {
    return `<c r="${ref}" s="${styleIndex}"><v>${value}</v></c>`
  }
  return (
    `<c r="${ref}" s="${styleIndex}" t="inlineStr">` +
    `<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  )
}
