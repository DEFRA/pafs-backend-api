import {
  columnLetterToIndex,
  columnIndexToLetter,
  buildCellXml,
  lastColumnLetter
} from './fcerm1-xml-utils.js'
import { FIRST_DATA_ROW, shiftFormulaToRow } from './fcerm1-formula-cells.js'

// ── Parse style indices from template row 7 ───────────────────────────────────

export function parseRowStyleMap(rowXml) {
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

export function normaliseColStyles(sheetXml, maxColIndex) {
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

export function injectDataRows(
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
