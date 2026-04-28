import { SIZE } from '../../../../common/constants/common.js'

export const FIRST_DATA_ROW = SIZE.LENGTH_7

// ── Extract and propagate formula cells from template row ────────────────────

// Returns true only if a cell XML contains a formula with a non-empty body.
// Shared-formula participants have <f .../> (self-closing, no body) and are excluded.
function hasMeaningfulFormula(cellXml) {
  if (!cellXml.includes('<f')) {
    return false
  }
  const fContent = (cellXml.match(/<f[^>]*>([^<]*)<\/f>/) ?? [])[1] ?? ''
  return Boolean(fContent.trim())
}

// Strips t="shared", ref="...", si="..." attrs so each copied row gets a standalone formula.
// Each attribute is always preceded by a single space in OOXML; using literal prefixes
// avoids leading-quantifier backtracking flagged by static-analysis tools.
function stripSharedFormulaAttrs(cellXml) {
  return cellXml.replace(/<f([^>]*)>/, (_, attrs) => {
    let cleaned = attrs
    // Literal string split — no regex needed for an exact-match removal
    cleaned = cleaned.split(' t="shared"').join('')
    // Cell range is always column letters, digits, colon, dollar — no ambiguous chars
    cleaned = cleaned.replace(/ ref="[A-Z0-9:$]+"/, '')
    // si value is always a non-negative integer
    cleaned = cleaned.replace(/ si="\d+"/, '')
    return `<f${cleaned}>`
  })
}

// Locate the next cell element in rowXml starting from pos.
// Returns { cellXml, nextPos } where cellXml is null for self-closing cells,
// or null when there are no more cells / the XML is malformed.
// Uses indexOf only — no regex — to avoid backtracking hotspots.
function findCellBounds(rowXml, pos) {
  const CELL_END = '</c>'
  const cellStart = rowXml.indexOf('<c ', pos)
  if (cellStart === -1) {
    return null
  }
  const tagEnd = rowXml.indexOf('>', cellStart)
  if (tagEnd === -1) {
    return null
  }
  // Self-closing cell (<c ... />) — carries no formula; advance past it
  if (rowXml[tagEnd - 1] === '/') {
    return { cellXml: null, nextPos: tagEnd + 1 }
  }
  const cellEnd = rowXml.indexOf(CELL_END, tagEnd)
  if (cellEnd === -1) {
    return null
  }
  return {
    cellXml: rowXml.slice(cellStart, cellEnd + CELL_END.length),
    nextPos: cellEnd + CELL_END.length
  }
}

// Returns a map of column letter → full cell XML for cells that contain formulas.
// Shared-formula participants (<f t="shared" si="N"/> with no body) are skipped.
// Shared-formula primary cells have the shared-formula attrs stripped so each
// copied row carries a standalone, independently-shiftable formula.
export function extractFormulaCells(rowXml) {
  const formulas = {}
  let pos = 0
  let bounds = findCellBounds(rowXml, pos)

  while (bounds !== null) {
    if (bounds.cellXml !== null) {
      const colMatch = /^<c r="([A-Z]+)\d+"/.exec(bounds.cellXml)
      if (colMatch && hasMeaningfulFormula(bounds.cellXml)) {
        formulas[colMatch[1]] = stripSharedFormulaAttrs(bounds.cellXml)
      }
    }
    pos = bounds.nextPos
    bounds = findCellBounds(rowXml, pos)
  }

  return formulas
}

// Shift all row-number references inside a formula cell from FIRST_DATA_ROW to toRow
export function shiftFormulaToRow(cellXml, toRow) {
  if (toRow === FIRST_DATA_ROW) {
    return cellXml
  }
  const from = String(FIRST_DATA_ROW)
  return (
    cellXml
      // Shift the cell's r attribute: r="AN7" → r="AN8"
      .replace(new RegExp(`(r="[A-Z]+)${from}"`), `$1${toRow}"`)
      // Shift every column-ref row number inside the formula text
      .replaceAll(
        new RegExp(String.raw`([A-Z]{1,3})${from}(?!\d)`, 'g'),
        (_, col) => `${col}${toRow}`
      )
  )
}
