import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  columnLetterToIndex,
  buildSingleWorkbook,
  buildMultiWorkbook
} from './fcerm1-builder.js'

// ── adm-zip + fs/promises mocks ───────────────────────────────────────────────
// vi.hoisted ensures these are available before vi.mock is processed.
const mocks = vi.hoisted(() => {
  const SHEET_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:NI7"/><sheetData>' +
    '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
    '<c r="A7" s="66"/><c r="B7" s="67"/></row>' +
    '</sheetData></worksheet>'

  const WORKBOOK_XML =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId3"/></sheets>' +
    '<calcPr iterateCount="100" refMode="A1"/></workbook>'

  const RELS_XML =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId3" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
    'Target="worksheets/sheet1.xml"/></Relationships>'

  const CONTENT_TYPES_XML =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ' +
    'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>'

  const zipInstance = {
    readAsText: vi.fn((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return SHEET_XML
      if (name === 'xl/workbook.xml') return WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return RELS_XML
      if (name === '[Content_Types].xml') return CONTENT_TYPES_XML
      return ''
    }),
    updateFile: vi.fn(),
    addFile: vi.fn(),
    deleteFile: vi.fn(),
    toBuffer: vi.fn(() => Buffer.from('mock-zip-output'))
  }

  return {
    AdmZip: vi.fn(function () {
      return zipInstance
    }),
    zip: zipInstance,
    fsReadFile: vi.fn().mockResolvedValue(Buffer.from('template-binary')),
    // Expose raw XML so tests can override and restore readAsText
    SHEET_XML,
    WORKBOOK_XML,
    RELS_XML,
    CONTENT_TYPES_XML
  }
})

vi.mock('adm-zip', () => ({ default: mocks.AdmZip }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.fsReadFile }))
// Use a small fixed year list so dateRange tests are concise and deterministic
vi.mock('./fcerm1-legacy-columns.js', () => ({
  FCERM1_YEARS: [2023, 2024, 2025]
}))

// ── Helper: find updateFile call for a given zip entry ────────────────────────
function getUpdatedXml(entryName) {
  const call = mocks.zip.updateFile.mock.calls.find(([n]) => n === entryName)
  return call ? call[1].toString('utf8') : null
}

// ── columnLetterToIndex ───────────────────────────────────────────────────────

describe('columnLetterToIndex', () => {
  test('A → 1', () => expect(columnLetterToIndex('A')).toBe(1))
  test('B → 2', () => expect(columnLetterToIndex('B')).toBe(2))
  test('Z → 26', () => expect(columnLetterToIndex('Z')).toBe(26))
  test('AA → 27', () => expect(columnLetterToIndex('AA')).toBe(27))
  test('AB → 28', () => expect(columnLetterToIndex('AB')).toBe(28))
  test('AZ → 52', () => expect(columnLetterToIndex('AZ')).toBe(52))
  test('BA → 53', () => expect(columnLetterToIndex('BA')).toBe(53))
  test('BY → 77', () => expect(columnLetterToIndex('BY')).toBe(77))
  test('NI → 373', () => expect(columnLetterToIndex('NI')).toBe(373))
})

// ── buildSingleWorkbook ───────────────────────────────────────────────────────

describe('buildSingleWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.zip.toBuffer.mockReturnValue(Buffer.from('mock-zip-output'))
  })

  test('reads template from the provided path', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    expect(mocks.fsReadFile).toHaveBeenCalledWith('/path/template.xlsx')
  })

  test('passes the template buffer to AdmZip', async () => {
    const templateBuf = Buffer.from('template-bytes')
    mocks.fsReadFile.mockResolvedValue(templateBuf)
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    expect(mocks.AdmZip).toHaveBeenCalledWith(templateBuf)
  })

  test('updates sheet1.xml in the zip', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    expect(mocks.zip.updateFile).toHaveBeenCalledWith(
      'xl/worksheets/sheet1.xml',
      expect.any(Buffer)
    )
  })

  test('injects string presenter value as inline string into row 7', async () => {
    const presenter = {
      nameField: vi.fn(() => 'My Project Name'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<row r="7"')
    expect(xml).toContain('t="inlineStr"')
    expect(xml).toContain('My Project Name')
  })

  test('injects numeric presenter value as a bare number cell', async () => {
    const presenter = {
      amountField: vi.fn(() => 42),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'amountField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<v>42</v>')
    expect(xml).not.toContain('t="inlineStr"')
  })

  test('injects null presenter value as empty styled cell', async () => {
    const presenter = {
      nullField: vi.fn(() => null),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nullField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<c r="A7" s="66"/>')
  })

  test('skips columns with export: false', async () => {
    const presenter = {
      formulaField: vi.fn(() => 'should-not-appear'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      { column: 'AM', field: 'formulaField', scope: 'legacy', export: false }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    expect(presenter.formulaField).not.toHaveBeenCalled()
  })

  test('writes 0 instead of calling field when condition is false', async () => {
    const presenter = {
      conditionalField: vi.fn(() => 999),
      projectProtectsHouseholds: () => false,
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      {
        column: 'A',
        field: 'conditionalField',
        scope: 'legacy',
        condition: (p) => p.projectProtectsHouseholds()
      }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<v>0</v>')
    expect(presenter.conditionalField).not.toHaveBeenCalled()
  })

  test('XML-escapes special characters in string values', async () => {
    const presenter = {
      nameField: vi.fn(() => 'Flood & Erosion <Risk>'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('Flood &amp; Erosion &lt;Risk&gt;')
    expect(xml).not.toContain('<Risk>')
  })

  test('adds fullCalcOnLoad to workbook.xml when absent', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('xl/workbook.xml')
    expect(xml).toContain('fullCalcOnLoad="1"')
  })

  test('calls fundingContributorsSheetData', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    expect(presenter.fundingContributorsSheetData).toHaveBeenCalledOnce()
  })

  test('adds contributors sheet XML to zip', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    expect(mocks.zip.addFile).toHaveBeenCalledWith(
      'xl/worksheets/sheet2.xml',
      expect.any(Buffer)
    )
  })

  test('contributors sheet XML contains the header row', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const sheetCall = mocks.zip.addFile.mock.calls.find(
      ([n]) => n === 'xl/worksheets/sheet2.xml'
    )
    const xml = sheetCall[1].toString('utf8')
    expect(xml).toContain('Project')
    expect(xml).toContain('Amount')
  })

  test('contributors sheet XML includes data rows when contributors exist', async () => {
    const contributor = {
      project: 'REF/001',
      name: 'Local Council',
      type: 'Public',
      year: '2024-2025',
      amount: 5000,
      secured: 'yes',
      constrained: 'no'
    }
    const presenter = {
      fundingContributorsSheetData: vi.fn(() => [contributor])
    }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const sheetCall = mocks.zip.addFile.mock.calls.find(
      ([n]) => n === 'xl/worksheets/sheet2.xml'
    )
    const xml = sheetCall[1].toString('utf8')
    expect(xml).toContain('Local Council')
    expect(xml).toContain('<v>5000</v>')
  })

  test('adds contributors sheet reference to workbook.xml', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('xl/workbook.xml')
    expect(xml).toContain('Funding Contributors')
    // nextRid: mock rels has rId3 as highest → assigns rId4
    expect(xml).toContain('rId4')
  })

  test('adds contributors sheet relationship to workbook.xml.rels', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('xl/_rels/workbook.xml.rels')
    expect(xml).toContain('rId4')
    expect(xml).toContain('sheet2.xml')
  })

  test('adds contributors sheet content type override', async () => {
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('[Content_Types].xml')
    expect(xml).toContain('/xl/worksheets/sheet2.xml')
    expect(xml).toContain('spreadsheetml.worksheet+xml')
  })

  test('returns buffer from zip.toBuffer()', async () => {
    const expected = Buffer.from('xlsx-bytes')
    mocks.zip.toBuffer.mockReturnValue(expected)
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    const result = await buildSingleWorkbook(
      '/path/template.xlsx',
      presenter,
      []
    )

    expect(result).toBe(expected)
  })

  // ── formula cell propagation / dynamic rId ─────────────────────────────

  test('propagates formula cells from template row to each data row', async () => {
    // Template row 7 has a formula cell in column C (not in the column map)
    const sheetWithFormula =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/>' +
      '<c r="C7" s="70"><f>SUM(D7:E7)</f><v>0</v></c>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithFormula
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Project A'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    // Column map only covers A — column C has no entry so its formula should be preserved
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Formula cell should be present in the injected row (row 7, no shift needed)
    expect(xml).toContain('<c r="C7"')
    expect(xml).toContain('<f>SUM(D7:E7)</f>')
  })

  test('shifts formula row references when propagating to a later row', async () => {
    const sheetWithFormula =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/>' +
      '<c r="C7" s="70"><f>SUM(D7:E7)</f><v>0</v></c>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithFormula
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenters = [
      {
        nameField: vi.fn(() => 'P1'),
        fundingContributorsSheetData: vi.fn(() => [])
      },
      {
        nameField: vi.fn(() => 'P2'),
        fundingContributorsSheetData: vi.fn(() => [])
      }
    ]
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildMultiWorkbook('/path/template.xlsx', presenters, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Row 7 formula stays as-is; row 8 formula refs shift from 7 → 8
    expect(xml).toContain('<c r="C7"')
    expect(xml).toContain('<f>SUM(D7:E7)</f>')
    expect(xml).toContain('<c r="C8"')
    expect(xml).toContain('<f>SUM(D8:E8)</f>')
  })

  test('uses next free rId (avoids colliding with existing rels)', async () => {
    // Override rels to simulate a template that already uses rId1 through rId5
    const relsWithFive =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="..." Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId5" Type="..." Target="calcChain.xml"/>' +
      '</Relationships>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return relsWithFive
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    // nextRid should pick rId6 since rId5 is already used
    const relsXml = getUpdatedXml('xl/_rels/workbook.xml.rels')
    const wbXml = getUpdatedXml('xl/workbook.xml')
    expect(relsXml).toContain('Id="rId6"')
    expect(wbXml).toContain('r:id="rId6"')
    expect(relsXml).not.toContain(
      'Id="rId5" Type="..." Target="worksheets/sheet2.xml"'
    )
  })

  // ── dateRange column coverage ──────────────────────────────────────────────

  test('injects one cell per year for a dateRange column', async () => {
    const presenter = {
      annualField: vi.fn(() => 750),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      { column: 'A', field: 'annualField', scope: 'legacy', dateRange: true }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // FCERM1_YEARS mocked as [2023, 2024, 2025] → A(1), B(2), C(3) at row 7
    expect(xml).toContain('<c r="A7"')
    expect(xml).toContain('<c r="B7"')
    expect(xml).toContain('<c r="C7"')
    expect(presenter.annualField).toHaveBeenCalledTimes(3)
    expect(xml).toContain('<v>750</v>')
  })

  test('dateRange column produces two-letter cell refs when column index exceeds 26', async () => {
    const presenter = {
      annualField: vi.fn(() => 100),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    // Z = index 26; offsets 0 → Z (26), 1 → AA (27), 2 → AB (28)
    const columns = [
      { column: 'Z', field: 'annualField', scope: 'legacy', dateRange: true }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<c r="Z7"')
    expect(xml).toContain('<c r="AA7"')
    expect(xml).toContain('<c r="AB7"')
  })

  test('dateRange column falls back to 0 when presenter returns null for a year', async () => {
    const presenter = {
      annualField: vi.fn(() => null),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      { column: 'A', field: 'annualField', scope: 'legacy', dateRange: true }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<v>0</v>')
    expect(presenter.annualField).toHaveBeenCalled()
  })

  test('dateRange column writes 0 for all year cells when condition is false', async () => {
    const presenter = {
      annualField: vi.fn(() => 999),
      isActive: () => false,
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      {
        column: 'A',
        field: 'annualField',
        scope: 'legacy',
        dateRange: true,
        condition: (p) => p.isActive()
      }
    ]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<v>0</v>')
    expect(presenter.annualField).not.toHaveBeenCalled()
  })

  test('uses explicit years param instead of default FCERM1_YEARS for dateRange columns', async () => {
    const presenter = {
      annualField: vi.fn(() => 500),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      { column: 'A', field: 'annualField', scope: 'new', dateRange: true }
    ]
    // Pass 2 years explicitly — should produce exactly 2 cells (A7, B7)
    const customYears = [2026, 2027]

    await buildSingleWorkbook(
      '/path/template.xlsx',
      presenter,
      columns,
      customYears
    )

    expect(presenter.annualField).toHaveBeenCalledTimes(2)
    expect(presenter.annualField).toHaveBeenCalledWith(2026)
    expect(presenter.annualField).toHaveBeenCalledWith(2027)
    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<c r="A7"')
    expect(xml).toContain('<c r="B7"')
  })

  test('does not add fullCalcOnLoad when already present in workbook.xml', async () => {
    const workbookWithCalc = mocks.WORKBOOK_XML.replace(
      '<calcPr ',
      '<calcPr fullCalcOnLoad="1" '
    )
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/workbook.xml') return workbookWithCalc
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('xl/workbook.xml')
    expect((xml.match(/fullCalcOnLoad/g) ?? []).length).toBe(1)
  })

  test('normalises <cols>: adds dominant style to <col> elements missing a style attribute', async () => {
    // Simulates the FCERM1 template where columns A–IH have style="1" but
    // some columns in the II–KS range have a <col> entry without a style attribute.
    const sheetWithMixedColStyles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols>' +
      '<col min="1" max="242" width="14" style="1" customWidth="1"/>' +
      '<col min="243" max="244" width="11" customWidth="1"/>' +
      '</cols>' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/><c r="B7" s="67"/>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithMixedColStyles
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // The entry for 243–244 that had no style should now have style="1"
    expect(xml).toContain(
      '<col min="243" max="244" width="11" customWidth="1" style="1"/>'
    )
    // The already-styled entry should be unchanged
    expect(xml).toContain(
      '<col min="1" max="242" width="14" style="1" customWidth="1"/>'
    )
  })

  test('normalises <cols>: inserts entries for columns entirely absent from the col section', async () => {
    // Simulates the pattern seen in the FCERM1 template where some columns in the
    // II–KS range (e.g. IU=255, IW=257) have NO <col> element at all.
    // Those columns fall through to Excel's default style (which has borders).
    // buildSingleWorkbook is called with columns covering index 255 and 257 so
    // normaliseColStyles fills the gaps.
    const sheetWithGaps =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols>' +
      '<col min="1" max="254" width="14" style="1" customWidth="1"/>' +
      '<col min="256" max="256" width="11" style="1" customWidth="1"/>' +
      '</cols>' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/><c r="B7" s="67"/>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithGaps
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }
    // IU=255 (index 255) and IW=257 (index 257) are in the data range but missing from cols
    // columnLetterToIndex('IW') = 257 → maxColIndex=257 covers both gaps
    const columns = [{ column: 'IW', field: 'f', export: false }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Both missing columns should now have explicit <col> entries with style="1"
    // and carry the last-seen width from the preceding col entry (width="11" from col 256)
    expect(xml).toContain(
      '<col min="255" max="255" width="11" customWidth="1" style="1"/>'
    )
    expect(xml).toContain(
      '<col min="257" max="257" width="11" customWidth="1" style="1"/>'
    )
    // The existing entries should be preserved (potentially reordered but present)
    expect(xml).toContain('min="1" max="254"')
    expect(xml).toContain('min="256" max="256"')
  })

  test('uses default style 66 when template row 7 has no styled cells', async () => {
    // Row 7 exists but has no <c s="..."> cells — parseRowStyleMap returns {}
    // and defaultStyle falls back to '66'.
    const sheetEmptyRow7 =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7"></row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetEmptyRow7
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Project'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('s="66"')
  })

  test('handles template with no row 7 element without crashing', async () => {
    // Covers the `row7Match ? ... : {}` false branch — styleMap = {} when row 7 is absent
    const sheetNoRow7 =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData></sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetNoRow7
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await expect(
      buildSingleWorkbook('/path/template.xlsx', presenter, [])
    ).resolves.toBeInstanceOf(Buffer)
  })

  test('removes pre-populated template rows beyond the data area', async () => {
    // Simulates the new FCERM1 template which has styled placeholder rows 8–10
    // (with e.g. borders in II–KS columns).  Only the one data row (row 7) and
    // any header rows (< 7) should appear in the output.
    const sheetWithExtraRows =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI10"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/><c r="B7" s="67"/>' +
      '</row>' +
      '<row r="8"><c r="II8" s="99"/></row>' +
      '<row r="9"><c r="II9" s="99"/></row>' +
      '<row r="10"><c r="II10" s="99"/></row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithExtraRows
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Single Project'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Only the one injected data row should exist — template rows 8–10 must be gone
    expect(xml).toContain('<row r="7"')
    expect(xml).not.toContain('<row r="8"')
    expect(xml).not.toContain('<row r="9"')
    expect(xml).not.toContain('<row r="10"')
    // The styled cells from the template placeholder rows must not appear
    expect(xml).not.toContain('s="99"')
  })

  test('preserves template header rows before the data area', async () => {
    const sheetWithHeaders =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Title Row</t></is></c></row>' +
      '<row r="6"><c r="A6" t="inlineStr"><is><t>Column Labels</t></is></c></row>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/><c r="B7" s="67"/>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithHeaders
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Project'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Header rows 1 and 6 must be preserved
    expect(xml).toContain('<row r="1"')
    expect(xml).toContain('Title Row')
    expect(xml).toContain('<row r="6"')
    expect(xml).toContain('Column Labels')
    // Data is in row 7
    expect(xml).toContain('<row r="7"')
    expect(xml).toContain('Project')
  })

  // ── Branch-coverage edge cases ────────────────────────────────────────────

  test('null value in a column absent from template row 7 is not written to XML', async () => {
    // Row 7 has A=66, B=67 but no entry for C.
    // When the presenter returns null for column C (no data), no <c> element should
    // appear in the output — matching the template's own blank appearance for that column.
    const presenter = {
      nullField: vi.fn(() => null),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'C', field: 'nullField' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).not.toContain('<c r="C7"')
  })

  test('non-null value in a column absent from template row 7 uses defaultStyle', async () => {
    // Row 7 has A=66 only. Column C has no style entry → uses defaultStyle (66).
    // Data is still written (only null is suppressed).
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      valueField: vi.fn(() => 42),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'C', field: 'valueField' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<c r="C7" s="66">')
    expect(xml).toContain('<v>42</v>')
  })

  test('null value in a column present in template row 7 is still written as empty styled cell', async () => {
    // A is in the template styleMap — a null value should produce an empty styled cell.
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nullField: vi.fn(() => null),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nullField' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<c r="A7" s="66"/>')
  })

  test('lastColumnLetter: skips update when a column ends before the current max', async () => {
    // Column A (dateRange, 3 years) → endIndex 3. Column B (no dateRange) → endIndex 2.
    // Second iteration takes the false branch of `if (endIndex > maxIndex)`.
    const presenter = {
      annualField: vi.fn(() => 10),
      nameField: vi.fn(() => 'Name'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [
      { column: 'A', field: 'annualField', scope: 'legacy', dateRange: true },
      { column: 'B', field: 'nameField', scope: 'legacy' }
    ]

    // Should complete without error — lastColumnLetter correctly picks 'C' (index 3)
    const result = await buildSingleWorkbook(
      '/path/template.xlsx',
      presenter,
      columns
    )
    expect(result).toBeInstanceOf(Buffer)
  })

  test('nextRid returns rId1 when relationships XML has no existing rIds', async () => {
    const emptyRels =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return emptyRels
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = { fundingContributorsSheetData: vi.fn(() => []) }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    // nextRid returns rId1 when nums is empty (false branch of nums.length > 0)
    const relsXml = getUpdatedXml('xl/_rels/workbook.xml.rels')
    expect(relsXml).toContain('Id="rId1"')
  })

  test('extractFormulaCells: skips non-self-closing cells that contain no formula', async () => {
    // Cell D7 is non-self-closing (<c ...>...</c>) but has no <f> — takes the false branch
    const sheetWithValueCell =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"/>' +
      '<c r="D7" s="70"><v>42</v></c>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithValueCell
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Project'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    // D7 has no formula so it should NOT be propagated as a formula cell
    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).not.toContain('<c r="D7"')
  })

  test('buildDataRowXml: skips formula cell when its column is already written as data', async () => {
    // Template row has a formula in column A; column A is also in the data column map.
    // writtenCols.has('A') is true → false branch of `if (!writtenCols.has(col))`
    const sheetWithFormulaInDataCol =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:NI7"/><sheetData>' +
      '<row r="7" customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' +
      '<c r="A7" s="66"><f>SUM(B7:C7)</f><v>0</v></c>' +
      '</row>' +
      '</sheetData></worksheet>'
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return sheetWithFormulaInDataCol
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
    const presenter = {
      nameField: vi.fn(() => 'Overwritten'),
      fundingContributorsSheetData: vi.fn(() => [])
    }
    // Column A is in the data map — data takes precedence over the template formula
    const columns = [{ column: 'A', field: 'nameField', scope: 'legacy' }]

    await buildSingleWorkbook('/path/template.xlsx', presenter, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    // Data value should be present, not the formula
    expect(xml).toContain('Overwritten')
    expect(xml).not.toContain('<f>SUM(B7:C7)</f>')
  })

  test('contributors sheet uses empty cell tag for null contributor fields', async () => {
    const contributor = {
      project: 'REF/002',
      name: 'Unknown',
      type: null,
      year: '2025',
      amount: null,
      secured: null,
      constrained: null
    }
    const presenter = {
      fundingContributorsSheetData: vi.fn(() => [contributor])
    }

    await buildSingleWorkbook('/path/template.xlsx', presenter, [])

    const sheetCall = mocks.zip.addFile.mock.calls.find(
      ([n]) => n === 'xl/worksheets/sheet2.xml'
    )
    const xml = sheetCall[1].toString('utf8')
    // null fields produce bare empty cell tags (no value, no type)
    expect(xml).toContain('<c r="C2"/>')
    expect(xml).toContain('<c r="E2"/>')
  })
})

// ── buildMultiWorkbook ────────────────────────────────────────────────────────

describe('buildMultiWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.zip.toBuffer.mockReturnValue(Buffer.from('mock-zip-output'))
    // Restore readAsText to its default XML responses in case a previous test overrode it
    mocks.zip.readAsText.mockImplementation((name) => {
      if (name === 'xl/worksheets/sheet1.xml') return mocks.SHEET_XML
      if (name === 'xl/workbook.xml') return mocks.WORKBOOK_XML
      if (name === 'xl/_rels/workbook.xml.rels') return mocks.RELS_XML
      if (name === '[Content_Types].xml') return mocks.CONTENT_TYPES_XML
      return ''
    })
  })

  test('reads the template file exactly once', async () => {
    const presenters = [
      { f: vi.fn(() => 'a'), fundingContributorsSheetData: vi.fn(() => []) },
      { f: vi.fn(() => 'b'), fundingContributorsSheetData: vi.fn(() => []) }
    ]

    await buildMultiWorkbook('/path/template.xlsx', presenters, [])

    expect(mocks.fsReadFile).toHaveBeenCalledOnce()
  })

  test('places each presenter in consecutive rows starting at 7', async () => {
    const presenters = [
      {
        f: vi.fn(() => 'row-a'),
        fundingContributorsSheetData: vi.fn(() => [])
      },
      {
        f: vi.fn(() => 'row-b'),
        fundingContributorsSheetData: vi.fn(() => [])
      },
      { f: vi.fn(() => 'row-c'), fundingContributorsSheetData: vi.fn(() => []) }
    ]
    const columns = [{ column: 'A', field: 'f', scope: 'legacy' }]

    await buildMultiWorkbook('/path/template.xlsx', presenters, columns)

    const xml = getUpdatedXml('xl/worksheets/sheet1.xml')
    expect(xml).toContain('<row r="7"')
    expect(xml).toContain('<row r="8"')
    expect(xml).toContain('<row r="9"')
  })

  test('calls fundingContributorsSheetData once per presenter', async () => {
    const presenters = [
      { f: vi.fn(() => 'a'), fundingContributorsSheetData: vi.fn(() => []) },
      { f: vi.fn(() => 'b'), fundingContributorsSheetData: vi.fn(() => []) }
    ]

    await buildMultiWorkbook('/path/template.xlsx', presenters, [])

    expect(presenters[0].fundingContributorsSheetData).toHaveBeenCalledOnce()
    expect(presenters[1].fundingContributorsSheetData).toHaveBeenCalledOnce()
  })

  test('collects contributor rows from all presenters', async () => {
    const contributorA = {
      project: 'P1',
      name: 'Council A',
      type: 'Public',
      year: '2024',
      amount: 1000,
      secured: 'yes',
      constrained: 'no'
    }
    const contributorB = {
      project: 'P2',
      name: 'Council B',
      type: 'Private',
      year: '2025',
      amount: 2000,
      secured: 'no',
      constrained: 'yes'
    }
    const presenters = [
      {
        f: vi.fn(() => 'a'),
        fundingContributorsSheetData: vi.fn(() => [contributorA])
      },
      {
        f: vi.fn(() => 'b'),
        fundingContributorsSheetData: vi.fn(() => [contributorB])
      }
    ]

    await buildMultiWorkbook('/path/template.xlsx', presenters, [])

    const sheetCall = mocks.zip.addFile.mock.calls.find(
      ([n]) => n === 'xl/worksheets/sheet2.xml'
    )
    const xml = sheetCall[1].toString('utf8')
    expect(xml).toContain('Council A')
    expect(xml).toContain('Council B')
  })

  test('returns buffer from zip.toBuffer()', async () => {
    const expected = Buffer.from('multi-xlsx')
    mocks.zip.toBuffer.mockReturnValue(expected)
    const presenters = [
      { f: vi.fn(() => 'v'), fundingContributorsSheetData: vi.fn(() => []) }
    ]

    const result = await buildMultiWorkbook(
      '/path/template.xlsx',
      presenters,
      []
    )

    expect(result).toBe(expected)
  })
})
