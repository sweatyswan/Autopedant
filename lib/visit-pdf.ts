import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { recordTotals } from "@/lib/finance"
import { formatDate, formatKm, formatMoney, formatNextService, formatPlate, formatVehicleSpec } from "@/lib/format"
import { diagnosticScopeText, diagnosticStatusText, isDiagnosticAction } from "@/lib/service-catalog"
import type { Customer, ServiceItem, ServiceRecord, Vehicle } from "@/lib/types"

const pageWidth = 595.28
const pageHeight = 841.89
const margin = 45.35
const contentWidth = pageWidth - margin * 2
const ink = rgb(0, 0, 0)
const muted = rgb(0.42, 0.42, 0.42)
const rule = rgb(0.88, 0.88, 0.88)
const accent = rgb(9 / 255, 90 / 255, 124 / 255)
const danger = rgb(185 / 255, 28 / 255, 28 / 255)
const captionSize = 9
const bodySize = 10.5
const titleSize = 12
const displaySize = 14
const lineGap = 3

type SaveFilePicker = (options: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}>

type Fonts = {
  regular: PDFFont
  semibold: PDFFont
}

type TextLine = {
  text: string
  font: PDFFont
  size: number
  color?: ReturnType<typeof rgb>
}

let fontBytes: { regular: ArrayBuffer; semibold: ArrayBuffer } | null = null

function publicFontUrl(file: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${basePath}/fonts/${file}`
}

async function loadFonts() {
  if (fontBytes) {
    return fontBytes
  }

  const [regular, semibold] = await Promise.all([
    fetch(publicFontUrl("NotoSans-Regular.ttf")).then((response) => {
      if (!response.ok) {
        throw new Error("Font sa nenačítal.")
      }
      return response.arrayBuffer()
    }),
    fetch(publicFontUrl("NotoSans-SemiBold.ttf")).then((response) => {
      if (!response.ok) {
        throw new Error("Font sa nenačítal.")
      }
      return response.arrayBuffer()
    }),
  ])

  fontBytes = { regular, semibold }
  return fontBytes
}

function moneyColor(value: number) {
  if (value > 0) {
    return accent
  }

  if (value < 0) {
    return danger
  }

  return ink
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return ["–"]
  }

  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word
      continue
    }

    let chunk = ""
    for (const char of word) {
      const nextChunk = chunk + char
      if (font.widthOfTextAtSize(nextChunk, size) <= maxWidth) {
        chunk = nextChunk
      } else {
        if (chunk) {
          lines.push(chunk)
        }
        chunk = char
      }
    }
    current = chunk
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function measureLines(lines: TextLine[], width: number) {
  return wrapLines(lines, width).reduce((sum, line) => sum + line.size + lineGap, 0)
}

function wrapLines(lines: TextLine[], width: number) {
  return lines.flatMap((line) =>
    wrapText(line.font, line.text, line.size, width).map((text) => ({ ...line, text }))
  )
}

async function savePdfBlob(blob: Blob, filename: string) {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

class PdfWriter {
  page: PDFPage
  y = pageHeight - margin

  constructor(private pdf: PDFDocument) {
    this.page = pdf.addPage([pageWidth, pageHeight])
  }

  ensure(height: number) {
    if (this.y - height >= margin) {
      return
    }

    this.page = this.pdf.addPage([pageWidth, pageHeight])
    this.y = pageHeight - margin
  }

  text(x: number, line: TextLine) {
    this.page.drawText(line.text, {
      x,
      y: this.y - line.size,
      size: line.size,
      font: line.font,
      color: line.color ?? ink,
    })
    this.y -= line.size + lineGap
  }

  block(x: number, width: number, lines: TextLine[]) {
    const wrapped = wrapLines(lines, width)
    this.ensure(measureLines(lines, width))
    const start = this.y
    for (const line of wrapped) {
      this.ensure(line.size + lineGap)
      this.text(x, line)
    }
    return start - this.y
  }

  rule() {
    this.page.drawLine({
      start: { x: margin, y: this.y },
      end: { x: margin + contentWidth, y: this.y },
      thickness: 0.6,
      color: rule,
    })
  }
}

export async function downloadVisitPdf({
  record,
  vehicle,
  customer,
  customerView,
}: {
  record: ServiceRecord
  vehicle: Vehicle
  customer: Customer
  customerView: boolean
}) {
  const bytes = await loadFonts()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts: Fonts = {
    regular: await pdf.embedFont(bytes.regular, { subset: true }),
    semibold: await pdf.embedFont(bytes.semibold, { subset: true }),
  }
  const writer = new PdfWriter(pdf)
  const money = recordTotals(record)
  const nextService = formatNextService(record)
  const mechanicNote = record.mechanicNotes.trim()

  writer.block(margin, contentWidth, [
    { text: "Autopedant", font: fonts.regular, size: captionSize, color: muted },
  ])
  writer.y -= 2
  writer.block(margin, contentWidth, [
    { text: "Servisný zákrok", font: fonts.semibold, size: displaySize },
    {
      text: `${formatDate(record.serviceDate)} · ${formatKm(record.mileage)}`,
      font: fonts.semibold,
      size: titleSize,
    },
  ])
  writer.y -= 8

  const columnWidth = (contentWidth - 16) / 2
  const left: TextLine[] = [
    { text: formatPlate(vehicle.licensePlate), font: fonts.semibold, size: titleSize },
    { text: formatVehicleSpec(vehicle), font: fonts.regular, size: bodySize },
    { text: vehicle.vin || "–", font: fonts.regular, size: bodySize, color: muted },
  ]
  const right: TextLine[] = [
    { text: customer.name || "–", font: fonts.semibold, size: titleSize },
    { text: customer.phone || "–", font: fonts.regular, size: bodySize, color: muted },
    { text: customer.email || "–", font: fonts.regular, size: bodySize, color: muted },
  ]
  const pairHeight = Math.max(measureLines(left, columnWidth), measureLines(right, columnWidth))
  writer.ensure(pairHeight)
  const pairTop = writer.y
  writer.block(margin, columnWidth, left)
  writer.y = pairTop
  writer.block(margin + columnWidth + 16, columnWidth, right)
  writer.y = pairTop - pairHeight - 10

  if (nextService || mechanicNote) {
    const noteWidth = contentWidth * 0.58
    const nextWidth = contentWidth - noteWidth - 16
    const nextLines: TextLine[] = nextService
      ? [
          { text: "Ďalší servis", font: fonts.regular, size: captionSize, color: muted },
          { text: nextService, font: fonts.regular, size: bodySize },
        ]
      : []
    const noteLines: TextLine[] = mechanicNote
      ? [
          { text: "Poznámka mechanika", font: fonts.regular, size: captionSize, color: muted },
          { text: mechanicNote, font: fonts.regular, size: bodySize },
        ]
      : []
    const blockHeight = Math.max(measureLines(nextLines, nextWidth), measureLines(noteLines, noteWidth))
    writer.ensure(blockHeight)
    const top = writer.y
    if (nextLines.length) {
      writer.block(margin, nextWidth, nextLines)
    }
    writer.y = top
    if (noteLines.length) {
      writer.block(margin + nextWidth + 16, noteWidth, noteLines)
    }
    writer.y = top - blockHeight - 10
  }

  if (record.items.length > 0) {
    const onlyDiagnostic = record.items.every((item) => isDiagnosticAction(item.actionType))
    const columns = onlyDiagnostic
      ? [
          { key: "action", width: 90, label: "Úkon" },
          { key: "scope", width: 140, label: "Rozsah" },
          { key: "note", width: contentWidth - 90 - 140 - 88, label: "Poznámka" },
          { key: "status", width: 88, label: "Stav" },
        ]
      : [
          { key: "action", width: 78, label: "Úkon" },
          { key: "part", width: 168, label: "Náhradný diel" },
          { key: "material", width: 96, label: "Typ materiálu" },
          { key: "quantity", width: 72, label: "Množstvo" },
          { key: "brand", width: contentWidth - 78 - 168 - 96 - 72, label: "Značka" },
        ]

    const drawHeader = () => {
      writer.ensure(22)
      writer.rule()
      writer.y -= 8
      let x = margin
      const top = writer.y
      for (const column of columns) {
        writer.y = top
        writer.text(x, { text: column.label, font: fonts.regular, size: captionSize, color: muted })
        x += column.width
      }
      writer.rule()
      writer.y -= 6
    }

    drawHeader()

    for (const item of record.items) {
      const cells: TextLine[][] = columns.map((column) => itemPdfCell(item, column.key, fonts))
      const wrapped = cells.map((cell, index) => wrapLines(cell, columns[index].width - 6))
      const rowHeight = Math.max(...wrapped.map((cell) => cell.reduce((sum, line) => sum + line.size + lineGap, 0))) + 6

      writer.ensure(rowHeight + 22)
      if (writer.y === pageHeight - margin) {
        drawHeader()
      }

      const top = writer.y
      let x = margin
      wrapped.forEach((cell, index) => {
        writer.y = top
        for (const line of cell) {
          writer.text(x, line)
        }
        x += columns[index].width
      })
      writer.y = top - rowHeight
      writer.rule()
      writer.y -= 6
    }
  }

  if (!customerView) {
    const totals = [
      { label: "Zárobok za prácu", value: formatMoney(money.labor), size: titleSize, color: moneyColor(money.labor) },
      { label: "Zárobok na materiáli", value: formatMoney(money.margin), size: titleSize, color: moneyColor(money.margin) },
      { label: "Hodnota zákroku", value: formatMoney(money.billed), size: displaySize, color: ink },
    ]
    writer.ensure(40)
    writer.y -= 8
    const cellWidth = contentWidth / 3
    const top = writer.y
    totals.forEach((cell, index) => {
      writer.y = top
      writer.block(margin + cellWidth * index, cellWidth - 8, [
        { text: cell.label, font: fonts.regular, size: captionSize, color: muted },
        { text: cell.value, font: fonts.semibold, size: cell.size, color: cell.color },
      ])
    })
  }

  const filename = `${formatPlate(vehicle.licensePlate)} ${record.serviceDate}.pdf`
  const blob = new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" })
  await savePdfBlob(blob, filename)
}

function visitCountLabel(count: number) {
  const tens = count % 100
  const ones = count % 10
  if (count === 1) {
    return "1 zákrok"
  }
  if (ones >= 2 && ones <= 4 && (tens < 10 || tens >= 20)) {
    return `${count} zákroky`
  }
  return `${count} zákrokov`
}

function labeledLine(label: string, value: string, fonts: Fonts): TextLine[] {
  return [
    { text: label, font: fonts.regular, size: captionSize, color: muted },
    { text: value, font: fonts.regular, size: bodySize },
  ]
}

function itemPdfCell(item: ServiceItem, key: string, fonts: Fonts): TextLine[] {
  if (isDiagnosticAction(item.actionType)) {
    const scope = diagnosticScopeText(item)
    const note = item.diagnosticNote?.trim() || "–"
    const status = diagnosticStatusText(item.diagnosticResolved)
    if (key === "action") {
      return [{ text: item.actionType, font: fonts.semibold, size: bodySize }]
    }
    if (key === "scope") {
      return [{ text: scope, font: fonts.regular, size: bodySize }]
    }
    if (key === "note") {
      return [{ text: note, font: fonts.regular, size: bodySize }]
    }
    if (key === "status") {
      return [{ text: status, font: fonts.regular, size: bodySize }]
    }
    if (key === "part") {
      return labeledLine("Rozsah", scope, fonts)
    }
    if (key === "material") {
      return labeledLine("Poznámka", note, fonts)
    }
    if (key === "quantity") {
      return labeledLine("Stav", status, fonts)
    }
    return [{ text: "–", font: fonts.regular, size: bodySize }]
  }

  if (key === "action") {
    return [{ text: item.actionType, font: fonts.semibold, size: bodySize }]
  }
  if (key === "part" || key === "scope") {
    return [
      { text: item.partName || "–", font: fonts.regular, size: bodySize },
      { text: item.category, font: fonts.regular, size: captionSize, color: muted },
    ]
  }
  if (key === "material" || key === "note") {
    return [{ text: item.materialType || "–", font: fonts.regular, size: bodySize }]
  }
  if (key === "quantity" || key === "status") {
    return [{ text: item.quantity || "–", font: fonts.regular, size: bodySize }]
  }
  return [{ text: item.partBrand || "–", font: fonts.regular, size: bodySize }]
}

function itemLine(item: ServiceRecord["items"][number]) {
  if (isDiagnosticAction(item.actionType)) {
    return [item.actionType, diagnosticScopeText(item), item.diagnosticNote?.trim(), diagnosticStatusText(item.diagnosticResolved)]
      .filter((part) => part && part !== "–")
      .join(" · ")
  }

  return [item.actionType, item.partName || item.category, item.quantity, item.materialType, item.partBrand]
    .filter((part) => part && part !== "–")
    .join(" · ")
}

export async function downloadHistoryPdf({
  records,
  vehicle,
  customer,
}: {
  records: ServiceRecord[]
  vehicle: Vehicle
  customer: Customer
}) {
  const bytes = await loadFonts()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts: Fonts = {
    regular: await pdf.embedFont(bytes.regular, { subset: true }),
    semibold: await pdf.embedFont(bytes.semibold, { subset: true }),
  }
  const writer = new PdfWriter(pdf)
  const history = [...records].sort(
    (left, right) => left.serviceDate.localeCompare(right.serviceDate) || left.mileage - right.mileage
  )
  const last = history[history.length - 1]

  writer.block(margin, contentWidth, [
    { text: "Autopedant", font: fonts.regular, size: captionSize, color: muted },
  ])
  writer.y -= 2
  writer.block(margin, contentWidth, [{ text: "Servisná história", font: fonts.semibold, size: displaySize }])
  writer.y -= 8

  const columnWidth = (contentWidth - 16) / 2
  const left: TextLine[] = [
    { text: formatPlate(vehicle.licensePlate) || vehicle.makeModel, font: fonts.semibold, size: titleSize },
    { text: formatVehicleSpec(vehicle), font: fonts.regular, size: bodySize },
    { text: vehicle.vin || "–", font: fonts.regular, size: bodySize, color: muted },
  ]
  const right: TextLine[] = [
    { text: customer.name || "–", font: fonts.semibold, size: titleSize },
    { text: customer.phone || "–", font: fonts.regular, size: bodySize, color: muted },
    { text: customer.email || "–", font: fonts.regular, size: bodySize, color: muted },
  ]
  const pairHeight = Math.max(measureLines(left, columnWidth), measureLines(right, columnWidth))
  writer.ensure(pairHeight)
  const pairTop = writer.y
  writer.block(margin, columnWidth, left)
  writer.y = pairTop
  writer.block(margin + columnWidth + 16, columnWidth, right)
  writer.y = pairTop - pairHeight - 8

  writer.block(margin, contentWidth, [
    {
      text: last
        ? `${visitCountLabel(history.length)} · Posledný servis ${formatDate(last.serviceDate)} · ${formatKm(last.mileage)}`
        : "Žiadny servisný záznam",
      font: fonts.regular,
      size: bodySize,
      color: muted,
    },
  ])
  writer.y -= 6

  for (const record of history) {
    const nextService = formatNextService(record)
    const note = record.mechanicNotes.trim()
    const items = record.items.map((item) => itemLine(item)).filter(Boolean)
    const visitLines: TextLine[] = [
      {
        text: `${formatDate(record.serviceDate)} · ${formatKm(record.mileage)}`,
        font: fonts.semibold,
        size: titleSize,
      },
      ...items.map((text) => ({ text, font: fonts.regular, size: bodySize })),
    ]
    if (nextService) {
      visitLines.push({ text: `Ďalší servis ${nextService}`, font: fonts.regular, size: captionSize, color: muted })
    }
    if (note) {
      visitLines.push({ text: note, font: fonts.regular, size: bodySize })
    }

    const blockHeight = measureLines(visitLines, contentWidth) + 16
    writer.ensure(blockHeight)
    if (writer.y < pageHeight - margin - 2) {
      writer.rule()
      writer.y -= 8
    }
    writer.block(margin, contentWidth, visitLines)
    writer.y -= 6
  }

  const name = formatPlate(vehicle.licensePlate) || vehicle.makeModel
  const blob = new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" })
  await savePdfBlob(blob, `${name} servisna-historia.pdf`)
}
