import { readFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { FCERM1_YEARS } from './fcerm1-legacy-columns.js'
import { SIZE } from '../../../../common/constants/common.js'

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

// Returns a map of column letter → full cell XML for cells that contain <f> formulas
function extractFormulaCells(rowXml) {
  const formulas = {}
  // [^>]*(?<!/)> matches the opening tag, excluding self-closing tags (which end with "/>")
  // (?:[^<]|<(?!\/c>))* is an unrolled loop that matches cell content without backtracking
  for (const m of rowXml.matchAll(
    /<c r="([A-Z]+)\d+"[^>]*(?<!\/)>(?:[^<]|<(?!\/c>))*<\/c>/g
  )) {
    if (m[0].includes('<f')) {
      formulas[m[1]] = m[0]
    }
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

// ── Build one data row as XML ─────────────────────────────────────────────────

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
    const useValue = !col.condition || col.condition(presenter)

    if (col.dateRange) {
      const startIndex = columnLetterToIndex(col.column)
      years.forEach((year, offset) => {
        const colLetter = columnIndexToLetter(startIndex + offset)
        const value = useValue ? (presenter[col.field](year) ?? 0) : 0
        cellList.push({
          colIndex: startIndex + offset,
          xml: buildCellXml(
            `${colLetter}${rowNumber}`,
            value,
            styleMap[colLetter] ?? defaultStyle
          )
        })
        writtenCols.add(colLetter)
      })
    } else {
      const value = useValue ? presenter[col.field]() : 0
      cellList.push({
        colIndex: columnLetterToIndex(col.column),
        xml: buildCellXml(
          `${col.column}${rowNumber}`,
          value,
          styleMap[col.column] ?? defaultStyle
        )
      })
      writtenCols.add(col.column)
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
  return sheetXml
    .replace(/<row r="7"[^>]*>.*?(<\/sheetData>)/s, `${rows}$1`)
    .replace(
      /<dimension ref="[^"]+"/,
      `<dimension ref="A1:${lastCol}${lastRow}"`
    )
}

// ── Contributors sheet XML ────────────────────────────────────────────────────

const CONTRIBUTORS_SHEET_NAME = 'Funding Contributors'
const CONTRIBUTORS_HEADERS = [
  'Project',
  'Name',
  'Type',
  'Year',
  'Amount',
  'Secured',
  'Constrained'
]
const CONTRIBUTORS_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

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

function buildContributorsSheetXml(rows) {
  const headerRow = `<row r="1">${CONTRIBUTORS_HEADERS.map((h, i) => buildContributorCellXml(CONTRIBUTORS_COLS[i], 1, h)).join('')}</row>`

  const dataRows = rows
    .map((row, i) => {
      const r = i + 2
      const vals = [
        row.project,
        row.name,
        row.type,
        row.year,
        row.amount,
        row.secured,
        row.constrained
      ]
      return `<row r="${r}">${vals.map((v, j) => buildContributorCellXml(CONTRIBUTORS_COLS[j], r, v)).join('')}</row>`
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
  relsXml
) {
  zip.addFile(
    'xl/worksheets/sheet2.xml',
    Buffer.from(buildContributorsSheetXml(allContributorRows), 'utf8')
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
      'utf8'
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
      'utf8'
    )
  )
}

// ── Core builder ──────────────────────────────────────────────────────────────

async function _buildWorkbook(
  templatePath,
  presenters,
  columns,
  years = FCERM1_YEARS
) {
  const templateBuffer = await readFile(templatePath)
  const zip = new AdmZip(templateBuffer)

  // Extract template row 7 metadata — styles and formula cells to carry forward
  const sheetXml = zipReadText(zip, 'xl/worksheets/sheet1.xml')
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
      'utf8'
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
  zip.updateFile('xl/workbook.xml', Buffer.from(workbookXml, 'utf8'))

  // Add contributors sheet XML, rels entry, and content-type registration
  addContributorsSheetToZip(
    zip,
    presenters.flatMap((p) => p.fundingContributorsSheetData()),
    contributorsRid,
    relsXml
  )
  zip.deleteFile('xl/calcChain.xml')

  return zip.toBuffer()
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function buildSingleWorkbook(
  templatePath,
  presenter,
  columns,
  years = FCERM1_YEARS
) {
  return _buildWorkbook(templatePath, [presenter], columns, years)
}

export async function buildMultiWorkbook(
  templatePath,
  presenters,
  columns,
  years = FCERM1_YEARS
) {
  return _buildWorkbook(templatePath, presenters, columns, years)
}
