import { readFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { FCERM1_YEARS } from './fcerm1-legacy-columns.js'
import {
  ENCODING,
  columnLetterToIndex,
  lastColumnLetter,
  zipReadText,
  nextRid
} from './fcerm1-xml-utils.js'
import { extractFormulaCells } from './fcerm1-formula-cells.js'
import {
  parseRowStyleMap,
  normaliseColStyles,
  injectDataRows
} from './fcerm1-sheet-xml.js'
import {
  CONTRIBUTORS_SHEET_NAME,
  addContributorsSheetToZip
} from './fcerm1-contributors-sheet.js'

// ── Title cell helper ────────────────────────────────────────────────────────

/**
 * Replace the cell at A1 in the sheet XML with an inline-string cell containing
 * `title`.  The existing style attribute (s="...") is preserved so the merged
 * A1:B2 formatting is retained.  Works for shared-string (t="s"), inline-string,
 * or self-closing cells.
 */
function updateTitleCell(sheetXml, title) {
  return sheetXml.replace(
    /<c r="A1"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/,
    (_, attrs) => {
      const styleMatch = /\bs="([^"]+)"/.exec(attrs)
      const styleAttr = styleMatch ? ` s="${styleMatch[1]}"` : ''
      return `<c r="A1"${styleAttr} t="inlineStr"><is><t>${title}</t></is></c>`
    }
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
  const { includeSecuredConstrained = true, title = null } = options
  const templateBuffer = await readFile(templatePath)
  const zip = new AdmZip(templateBuffer)

  // Extract template row 7 metadata — styles and formula cells to carry forward
  const rawSheetXml = zipReadText(zip, 'xl/worksheets/sheet1.xml')
  const maxColIndex = columnLetterToIndex(lastColumnLetter(columns, years))
  const normalisedXml = normaliseColStyles(rawSheetXml, maxColIndex)
  const sheetXml = title ? updateTitleCell(normalisedXml, title) : normalisedXml
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
  if (title) {
    workbookXml = workbookXml.replace(/<sheet\b[^>]*>/, (match) =>
      match.replace(/\bname="[^"]*"/, `name="${title}"`)
    )
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
  return buildWorkbook(templatePath, presenters, columns, years, {
    ...options,
    title: 'All Proposals'
  })
}
