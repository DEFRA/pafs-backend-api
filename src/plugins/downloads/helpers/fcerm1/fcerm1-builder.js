import { readFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { FCERM1_YEARS } from './fcerm1-legacy-columns.js'
import { SIZE } from '../../../../common/constants/common.js'

const ENCODING = 'utf8'

// ── Last-column resolution ────────────────────────────────────────────────────

/**
 * Compute the last column letter written by a columns definition with a given
 * years array. Used to set the worksheet dimension reference accurately.
 */
function lastColumnLetter(columns, years) {
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

// ── Named constants ───────────────────────────────────────────────────────────

const FIRST_DATA_ROW = SIZE.LENGTH_7

// ASCII offset: 'A'.codePointAt(0) - 1 = 64.  Maps column index 1 → 'A'.
const LETTER_OFFSET = 'A'.codePointAt(0) - 1
const CHAR_CODE_A = LETTER_OFFSET + 1 // 65 = 'A'.codePointAt(0)

// OOXML URIs (defined once to avoid duplicate-literal warnings)
const WORKSHEET_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
const WORKSHEET_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'
const WS_XMLNS =
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

function columnIndexToLetter(index) {
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

// ── Zip helper (avoids false-positive "Prefer Blob#text()" lint rule) ──────────

function zipReadText(zip, name) {
  return zip.readAsText(name) // NOSONAR – AdmZip API, not browser FileReader
}

// Compute the next unused rId number from a relationships XML string
function nextRid(relsXml) {
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

function escapeXml(str) {
  return String(str).replaceAll(/[&<>"']/g, (c) => XML_ESCAPE_MAP[c])
}

function buildCellXml(ref, value, styleIndex) {
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
function extractFormulaCells(rowXml) {
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
function shiftFormulaToRow(cellXml, toRow) {
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

// ── Parse style indices from template row 7 ───────────────────────────────────

function parseRowStyleMap(rowXml) {
  const styleMap = {}
  for (const m of rowXml.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"/g)) {
    styleMap[m[1]] = m[2]
  }
  return styleMap
}

// ── Normalise <cols> column styles ────────────────────────────────────────────
const COL_ENTRY_RE = /<col ([^>]*?)\/>/g
const COL_MIN_RE = /\bmin="(\d+)"/
const COL_MAX_RE = /\bmax="(\d+)"/
const COL_STYLE_RE = /\bstyle="/
const COL_WIDTH_RE = /\bwidth="([^"]+)"/

function _parseColEntries(colsContent, dominantStyle) {
  const covered = new Set()
  const entries = []
  let lastWidth = null
  for (const m of colsContent.matchAll(COL_ENTRY_RE)) {
    const minM = COL_MIN_RE.exec(m[1])
    const maxM = COL_MAX_RE.exec(m[1])
    if (minM && maxM) {
      for (let i = Number(minM[1]); i <= Number(maxM[1]); i++) {
        covered.add(i)
      }
    }
    const widthM = COL_WIDTH_RE.exec(m[1])
    if (widthM) {
      lastWidth = widthM[1]
    }
    const styled = COL_STYLE_RE.test(m[1])
      ? m[1]
      : `${m[1]} style="${dominantStyle}"`
    entries.push(`<col ${styled}/>`)
  }
  return { covered, entries, lastWidth }
}

function _fillColGaps(entries, covered, maxColIndex, dominantStyle, lastWidth) {
  const widthAttr =
    lastWidth === null ? '' : ` width="${lastWidth}" customWidth="1"`
  for (let i = 1; i <= maxColIndex; i++) {
    if (!covered.has(i)) {
      entries.push(
        `<col min="${i}" max="${i}"${widthAttr} style="${dominantStyle}"/>`
      )
    }
  }
}

function normaliseColStyles(sheetXml, maxColIndex) {
  const colsMatch = sheetXml.match(/<cols>([\s\S]*?)<\/cols>/)
  if (!colsMatch) {
    return sheetXml
  }
  const dominantStyleMatch = colsMatch[1].match(/\bstyle="(\d+)"/)
  if (!dominantStyleMatch) {
    return sheetXml
  }
  const dominantStyle = dominantStyleMatch[1]
  const { covered, entries, lastWidth } = _parseColEntries(
    colsMatch[1],
    dominantStyle
  )
  _fillColGaps(entries, covered, maxColIndex, dominantStyle, lastWidth)
  entries.sort(
    (a, b) =>
      Number(COL_MIN_RE.exec(a)?.[1] ?? 0) -
      Number(COL_MIN_RE.exec(b)?.[1] ?? 0)
  )
  return sheetXml.replace(
    /<cols>[\s\S]*?<\/cols>/,
    `<cols>${entries.join('')}</cols>`
  )
}

// ── Build one data row as XML ─────────────────────────────────────────────────

function buildDateRangeCells(
  col,
  presenter,
  rowNumber,
  styleMap,
  defaultStyle,
  years
) {
  const startIndex = columnLetterToIndex(col.column)
  const useValue = !col.condition || col.condition(presenter)
  const cells = []
  for (const [offset, year] of years.entries()) {
    const colLetter = columnIndexToLetter(startIndex + offset)
    const value = useValue ? (presenter[col.field](year) ?? 0) : 0
    cells.push({
      colIndex: startIndex + offset,
      xml: buildCellXml(
        `${colLetter}${rowNumber}`,
        value,
        styleMap[colLetter] ?? defaultStyle
      )
    })
  }
  return cells
}

function buildStaticCell(col, presenter, rowNumber, styleMap, defaultStyle) {
  const useValue = !col.condition || col.condition(presenter)
  const value = useValue ? presenter[col.field]() : 0
  // Don't write empty cells for columns absent from the template's style row —
  // that keeps unstyled columns (e.g. NFM columns II–KS) blank in the output,
  // exactly as they appear in the template.
  if (value == null && !Object.hasOwn(styleMap, col.column)) {
    return null
  }
  return {
    colIndex: columnLetterToIndex(col.column),
    xml: buildCellXml(
      `${col.column}${rowNumber}`,
      value,
      styleMap[col.column] ?? defaultStyle
    )
  }
}

function buildDataRowXml(
  presenter,
  rowNumber,
  styleMap,
  formulaCells,
  columns,
  years
) {
  const defaultStyle = styleMap.A ?? '66'
  const cellList = []
  const writtenCols = new Set()

  for (const col of columns) {
    if (col.export === false) {
      continue
    }
    if (col.dateRange) {
      const rangeCells = buildDateRangeCells(
        col,
        presenter,
        rowNumber,
        styleMap,
        defaultStyle,
        years
      )
      for (const cell of rangeCells) {
        cellList.push(cell)
        writtenCols.add(columnIndexToLetter(cell.colIndex))
      }
    } else {
      const cell = buildStaticCell(
        col,
        presenter,
        rowNumber,
        styleMap,
        defaultStyle
      )
      if (cell !== null) {
        cellList.push(cell)
        writtenCols.add(col.column)
      }
    }
  }

  // Insert formula cells from the template for any column not already written with data
  for (const [col, formulaXml] of Object.entries(formulaCells)) {
    if (!writtenCols.has(col)) {
      cellList.push({
        colIndex: columnLetterToIndex(col),
        xml: shiftFormulaToRow(formulaXml, rowNumber)
      })
    }
  }

  // OOXML requires cells to be in ascending column order within a row
  cellList.sort((a, b) => a.colIndex - b.colIndex)
  const cells = cellList.map((c) => c.xml).join('')

  return (
    `<row r="${rowNumber}" customFormat="false" ht="15" hidden="false" ` +
    `customHeight="true" outlineLevel="0" collapsed="false">${cells}</row>`
  )
}

// ── Inject data rows into sheet1.xml ─────────────────────────────────────────

function injectDataRows(
  sheetXml,
  presenters,
  styleMap,
  formulaCells,
  columns,
  years
) {
  const rows = presenters
    .map((presenter, i) =>
      buildDataRowXml(
        presenter,
        FIRST_DATA_ROW + i,
        styleMap,
        formulaCells,
        columns,
        years
      )
    )
    .join('')

  const lastRow = FIRST_DATA_ROW + presenters.length - 1
  const lastCol = lastColumnLetter(columns, years)

  const sheetDataMatch = sheetXml.match(/<sheetData>(.*?)<\/sheetData>/s)
  const existingContent = sheetDataMatch ? sheetDataMatch[1] : ''
  const headerRows = existingContent.replaceAll(
    /<row r="(\d+)"[^>]*>.*?<\/row>/gs,
    (match, rowNum) => (Number(rowNum) < FIRST_DATA_ROW ? match : '')
  )

  return sheetXml
    .replace(
      /<sheetData>.*?<\/sheetData>/s,
      `<sheetData>${headerRows}${rows}</sheetData>`
    )
    .replace(
      /<dimension ref="[^"]+"/,
      `<dimension ref="A1:${lastCol}${lastRow}"`
    )
}

// ── Contributors sheet XML ────────────────────────────────────────────────────

const CONTRIBUTORS_SHEET_NAME = 'Funding Contributors'
const CONTRIBUTORS_HEADERS_FULL = [
  'Project',
  'Name',
  'Type',
  'Year',
  'Amount',
  'Secured',
  'Constrained'
]
const CONTRIBUTORS_HEADERS_SLIM = ['Project', 'Name', 'Type', 'Year', 'Amount']
const CONTRIBUTORS_COLS_FULL = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const CONTRIBUTORS_COLS_SLIM = ['A', 'B', 'C', 'D', 'E']

function buildContributorCellXml(col, row, value) {
  const ref = `${col}${row}`
  if (value == null) {
    return `<c r="${ref}"/>`
  }
  if (typeof value === 'number') {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function buildContributorsSheetXml(rows, includeSecuredConstrained = true) {
  const headers = includeSecuredConstrained
    ? CONTRIBUTORS_HEADERS_FULL
    : CONTRIBUTORS_HEADERS_SLIM
  const cols = includeSecuredConstrained
    ? CONTRIBUTORS_COLS_FULL
    : CONTRIBUTORS_COLS_SLIM

  const headerRow = `<row r="1">${headers.map((h, i) => buildContributorCellXml(cols[i], 1, h)).join('')}</row>`

  const dataRows = rows
    .map((row, i) => {
      const r = i + SIZE.LENGTH_2
      const vals = includeSecuredConstrained
        ? [
            row.project,
            row.name,
            row.type,
            row.year,
            row.amount,
            row.secured,
            row.constrained
          ]
        : [row.project, row.name, row.type, row.year, row.amount]
      return `<row r="${r}">${vals.map((v, j) => buildContributorCellXml(cols[j], r, v)).join('')}</row>`
    })
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<worksheet ${WS_XMLNS}><sheetData>${headerRow}${dataRows}</sheetData></worksheet>`
  )
}

// ── Add contributors sheet to the zip ────────────────────────────────────────

function addContributorsSheetToZip(
  zip,
  allContributorRows,
  contributorsRid,
  relsXml,
  includeSecuredConstrained = true
) {
  zip.addFile(
    'xl/worksheets/sheet2.xml',
    Buffer.from(
      buildContributorsSheetXml(allContributorRows, includeSecuredConstrained),
      ENCODING
    )
  )

  zip.updateFile(
    'xl/_rels/workbook.xml.rels',
    Buffer.from(
      relsXml.replace(
        '</Relationships>',
        `<Relationship Id="${contributorsRid}" ` +
          `Type="${WORKSHEET_REL_TYPE}" Target="worksheets/sheet2.xml"/>` +
          '</Relationships>'
      ),
      ENCODING
    )
  )

  zip.updateFile(
    '[Content_Types].xml',
    Buffer.from(
      zipReadText(zip, '[Content_Types].xml').replace(
        '</Types>',
        `<Override PartName="/xl/worksheets/sheet2.xml" ` +
          `ContentType="${WORKSHEET_CONTENT_TYPE}"/>` +
          '</Types>'
      ),
      ENCODING
    )
  )
}

// ── Core builder ──────────────────────────────────────────────────────────────

async function buildWorkbook(
  templatePath,
  presenters,
  columns,
  years = FCERM1_YEARS,
  options = {}
) {
  const { includeSecuredConstrained = true } = options
  const templateBuffer = await readFile(templatePath)
  const zip = new AdmZip(templateBuffer)

  // Extract template row 7 metadata — styles and formula cells to carry forward
  const rawSheetXml = zipReadText(zip, 'xl/worksheets/sheet1.xml')
  const maxColIndex = columnLetterToIndex(lastColumnLetter(columns, years))
  const sheetXml = normaliseColStyles(rawSheetXml, maxColIndex)
  const row7Match = sheetXml.match(/<row r="7"[^>]*>.*?<\/row>/s)
  const styleMap = row7Match ? parseRowStyleMap(row7Match[0]) : {}
  const formulaCells = row7Match ? extractFormulaCells(row7Match[0]) : {}

  // Inject data rows, carrying template formula cells into every new row
  zip.updateFile(
    'xl/worksheets/sheet1.xml',
    Buffer.from(
      injectDataRows(
        sheetXml,
        presenters,
        styleMap,
        formulaCells,
        columns,
        years
      ),
      ENCODING
    )
  )

  // Compute the next free rId from the rels file — avoids colliding with existing entries
  const relsXml = zipReadText(zip, 'xl/_rels/workbook.xml.rels')
  const contributorsRid = nextRid(relsXml)

  // Single workbook.xml update: add fullCalcOnLoad and register contributors sheet
  let workbookXml = zipReadText(zip, 'xl/workbook.xml')
  if (!workbookXml.includes('fullCalcOnLoad')) {
    workbookXml = workbookXml.replace('<calcPr ', '<calcPr fullCalcOnLoad="1" ')
  }
  workbookXml = workbookXml.replace(
    '</sheets>',
    `<sheet name="${CONTRIBUTORS_SHEET_NAME}" sheetId="2" r:id="${contributorsRid}"/></sheets>`
  )
  zip.updateFile('xl/workbook.xml', Buffer.from(workbookXml, ENCODING))

  // Add contributors sheet XML, rels entry, and content-type registration
  addContributorsSheetToZip(
    zip,
    presenters.flatMap((p) => p.fundingContributorsSheetData()),
    contributorsRid,
    relsXml,
    includeSecuredConstrained
  )
  zip.deleteFile('xl/calcChain.xml')

  return zip.toBuffer()
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function buildSingleWorkbook(
  templatePath,
  presenter,
  columns,
  years = FCERM1_YEARS,
  options = {}
) {
  return buildWorkbook(templatePath, [presenter], columns, years, options)
}

export async function buildMultiWorkbook(
  templatePath,
  presenters,
  columns,
  years = FCERM1_YEARS,
  options = {}
) {
  return buildWorkbook(templatePath, presenters, columns, years, options)
}
