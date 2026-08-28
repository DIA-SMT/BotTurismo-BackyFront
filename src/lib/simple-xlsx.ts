const encoder = new TextEncoder()

// Nombres de estilo disponibles para las celdas. El índice se corresponde con
// los <cellXfs> de styles.xml (más abajo): mantener ambos sincronizados.
export type XlsxCellStyle =
  | 'default'
  | 'title'
  | 'subtitle'
  | 'meta'
  | 'header'
  | 'cell'
  | 'cellCenter'
  | 'bold'
  | 'total'
  | 'totalCenter'

const styleIndex: Record<XlsxCellStyle, number> = {
  default: 0,
  title: 1,
  subtitle: 2,
  meta: 3,
  header: 4,
  cell: 5,
  cellCenter: 6,
  bold: 7,
  total: 8,
  totalCenter: 9,
}

export interface XlsxCell {
  value: string | number | null | undefined
  style?: XlsxCellStyle
}

type XlsxRowInput = Array<string | XlsxCell>

interface XlsxWorksheet {
  name: string
  rows: XlsxRowInput[]
  /** Ancho de cada columna en caracteres (unidad de Excel). */
  colWidths?: number[]
  /** Rangos combinados, ej: 'A1:H1'. */
  merges?: string[]
  /** Alto puntual de filas (clave 1-based, alto en puntos). */
  rowHeights?: Record<number, number>
  /** Congela las primeras N filas al hacer scroll. */
  freezeTopRows?: number
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnNumberToName(columnNumber: number) {
  let current = columnNumber
  let result = ''

  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }

  return result
}

function buildWorksheetXml(worksheet: XlsxWorksheet) {
  const rowXml = worksheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((rawCell, columnIndex) => {
          const cell: XlsxCell = typeof rawCell === 'string' ? { value: rawCell } : rawCell
          const style = styleIndex[cell.style || 'default']
          const styleAttr = style ? ` s="${style}"` : ''
          const cellReference = `${columnNumberToName(columnIndex + 1)}${rowIndex + 1}`

          if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
            return `<c r="${cellReference}"${styleAttr} t="n"><v>${cell.value}</v></c>`
          }
          const text = cell.value == null ? '' : String(cell.value)
          if (!text) {
            // Una celda vacía con estilo se emite igual (para bordes/relleno).
            return style ? `<c r="${cellReference}"${styleAttr}/>` : ''
          }
          return `<c r="${cellReference}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
        })
        .join('')

      const height = worksheet.rowHeights?.[rowIndex + 1]
      const heightAttr = height ? ` ht="${height}" customHeight="1"` : ''
      return cells ? `<row r="${rowIndex + 1}"${heightAttr}>${cells}</row>` : `<row r="${rowIndex + 1}"${heightAttr} />`
    })
    .join('')

  const sheetViewsXml = worksheet.freezeTopRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${worksheet.freezeTopRows}" topLeftCell="A${worksheet.freezeTopRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : ''

  const colsXml = worksheet.colWidths?.length
    ? `<cols>${worksheet.colWidths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  const mergesXml = worksheet.merges?.length
    ? `<mergeCells count="${worksheet.merges.length}">${worksheet.merges
        .map((range) => `<mergeCell ref="${range}"/>`)
        .join('')}</mergeCells>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${sheetViewsXml}${colsXml}<sheetData>${rowXml}</sheetData>${mergesXml}
</worksheet>`
}

function buildWorkbookXml(worksheets: XlsxWorksheet[]) {
  const sheets = worksheets
    .map(
      (worksheet, index) =>
        `<sheet name="${escapeXml(worksheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`
}

function buildWorkbookRelsXml(worksheets: XlsxWorksheet[]) {
  const sheetRels = worksheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')

  const stylesRel = `<Relationship Id="rId${worksheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  ${stylesRel}
</Relationships>`
}

function buildContentTypesXml(worksheets: XlsxWorksheet[]) {
  const sheetOverrides = worksheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${sheetOverrides}
</Types>`
}

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

// Paleta institucional: azul #126FF5 para encabezados, celeste #EEF6FF para
// totales, bordes gris suave. Los índices de <cellXfs> están mapeados en
// styleIndex (arriba).
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF0B3E91"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FF1F2933"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FF5A6673"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F2933"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF126FF5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF6FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB9C4D0"/></left>
      <right style="thin"><color rgb="FFB9C4D0"/></right>
      <top style="thin"><color rgb="FFB9C4D0"/></top>
      <bottom style="thin"><color rgb="FFB9C4D0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
</Properties>`

function buildCoreXml() {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Exportación Bus Turístico</dc:title>
  <dc:creator>Bus Turístico SMT</dc:creator>
  <cp:lastModifiedBy>Bus Turístico SMT</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[i] = crc >>> 0
  }
  return table
}

const crcTable = makeCrcTable()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildZip(entries: Array<{ name: string; data: Uint8Array }>) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const fileName = encoder.encode(entry.name)
    const fileData = Buffer.from(entry.data)
    const checksum = crc32(entry.data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(fileData.length, 18)
    localHeader.writeUInt32LE(fileData.length, 22)
    localHeader.writeUInt16LE(fileName.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, Buffer.from(fileName), fileData)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(fileData.length, 20)
    centralHeader.writeUInt32LE(fileData.length, 24)
    centralHeader.writeUInt16LE(fileName.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, Buffer.from(fileName))
    offset += localHeader.length + fileName.length + fileData.length
  }

  const centralDirectoryOffset = offset
  const centralDirectory = Buffer.concat(centralParts)
  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(centralDirectoryOffset, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, endRecord])
}

export function buildSimpleXlsxBuffer(worksheets: XlsxWorksheet[]) {
  const entries = [
    { name: '[Content_Types].xml', data: encoder.encode(buildContentTypesXml(worksheets)) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'docProps/app.xml', data: encoder.encode(appXml) },
    { name: 'docProps/core.xml', data: encoder.encode(buildCoreXml()) },
    { name: 'xl/workbook.xml', data: encoder.encode(buildWorkbookXml(worksheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(buildWorkbookRelsXml(worksheets)) },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml) },
    ...worksheets.map((worksheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(buildWorksheetXml(worksheet)),
    })),
  ]

  return buildZip(entries)
}
