import { SIZE } from '../../../../common/constants/common.js'
import {
  ENCODING,
  escapeXml,
  WS_XMLNS,
  WORKSHEET_REL_TYPE,
  WORKSHEET_CONTENT_TYPE,
  zipReadText
} from './fcerm1-xml-utils.js'

// ── Contributors sheet XML ────────────────────────────────────────────────────

export const CONTRIBUTORS_SHEET_NAME = 'Funding Contributors'

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

export function addContributorsSheetToZip(
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
