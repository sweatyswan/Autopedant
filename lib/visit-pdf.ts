import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { recordTotals } from "@/lib/finance"
import { formatDate, formatDisplacement, formatKm, formatMoney, formatNextService, formatPlate } from "@/lib/format"
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
  const paragraphs = text.split(/\n/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      continue
    }

    const words = paragraph.split(" ").filter(Boolean)
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
  }

  return lines.length ? lines : ["–"]
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
  onNewPage?: () => void

  constructor(private pdf: PDFDocument) {
    this.page = pdf.addPage([pageWidth, pageHeight])
  }

  ensure(height: number) {
    if (this.y - height >= margin) {
      return false
    }

    this.page = this.pdf.addPage([pageWidth, pageHeight])
    this.y = pageHeight - margin
    this.onNewPage?.()
    return true
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

function drawVehicleCustomer(writer: PdfWriter, fonts: Fonts, vehicle: Vehicle, customer: Customer) {
  const columnWidth = (contentWidth - 16) / 2
  const spec = [
    vehicle.year > 0 ? `${vehicle.makeModel}, ${vehicle.year}` : vehicle.makeModel,
    vehicle.engineDisplacement > 0 ? formatDisplacement(vehicle.engineDisplacement) : "",
    vehicle.fuel.trim(),
  ]
    .filter(Boolean)
    .join(" · ")
  const left: TextLine[] = [
    { text: formatPlate(vehicle.licensePlate) || vehicle.makeModel, font: fonts.semibold, size: titleSize },
    ...(spec ? [{ text: spec, font: fonts.regular, size: bodySize }] : []),
    ...(vehicle.vin
      ? [{ text: vehicle.vin, font: fonts.regular, size: bodySize, color: muted }]
      : []),
  ]
  const right: TextLine[] = [
    { text: customer.name || "–", font: fonts.semibold, size: titleSize },
    ...(customer.phone
      ? [{ text: customer.phone, font: fonts.regular, size: bodySize, color: muted }]
      : []),
    ...(customer.email
      ? [{ text: customer.email, font: fonts.regular, size: bodySize, color: muted }]
      : []),
  ]
  const pairHeight = Math.max(measureLines(left, columnWidth), measureLines(right, columnWidth))
  writer.ensure(pairHeight)
  const pairTop = writer.y
  writer.block(margin, columnWidth, left)
  writer.y = pairTop
  writer.block(margin + columnWidth + 16, columnWidth, right)
  writer.y = pairTop - pairHeight - 10
}

function drawNextAndNote(writer: PdfWriter, fonts: Fonts, nextService: string, mechanicNote: string) {
  if (!nextService && !mechanicNote) {
    return
  }

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

  if (nextLines.length && !noteLines.length) {
    writer.block(margin, contentWidth, nextLines)
    writer.y -= 10
    return
  }
  if (noteLines.length && !nextLines.length) {
    writer.block(margin, contentWidth, noteLines)
    writer.y -= 10
    return
  }

  const noteWidth = contentWidth * 0.58
  const nextWidth = contentWidth - noteWidth - 16
  const blockHeight = Math.max(measureLines(nextLines, nextWidth), measureLines(noteLines, noteWidth))
  writer.ensure(blockHeight + 6)
  const top = writer.y
  writer.block(margin, nextWidth, nextLines)
  writer.y = top
  writer.block(margin + nextWidth + 16, noteWidth, noteLines)
  writer.y = top - blockHeight - 10
}

function drawItemTable(writer: PdfWriter, items: ServiceItem[], fonts: Fonts) {
  const regular = items.filter((item) => !isDiagnosticAction(item.actionType))
  const diagnostics = items.filter((item) => isDiagnosticAction(item.actionType))

  if (regular.length) {
    drawItemTableKind(writer, regular, fonts, false)
  }
  if (diagnostics.length) {
    if (regular.length) {
      writer.y -= 4
    }
    drawItemTableKind(writer, diagnostics, fonts, true)
  }
}

function drawItemTableKind(writer: PdfWriter, items: ServiceItem[], fonts: Fonts, diagnostic: boolean) {
  if (items.length === 0) {
    return
  }

  const columns = diagnostic
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

  for (const item of items) {
    const cells: TextLine[][] = columns.map((column) => itemPdfCell(item, column.key, fonts))
    const wrapped = cells.map((cell, index) => wrapLines(cell, columns[index].width - 6))
    const rowHeight = Math.max(...wrapped.map((cell) => cell.reduce((sum, line) => sum + line.size + lineGap, 0))) + 6

    if (writer.ensure(rowHeight + 22)) {
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

function drawMoneyTotals(writer: PdfWriter, record: ServiceRecord, fonts: Fonts) {
  const money = recordTotals(record)
  const totals = [
    { label: "Zárobok za prácu", value: formatMoney(money.labor), size: titleSize, color: moneyColor(money.labor) },
    { label: "Zárobok na materiáli", value: formatMoney(money.margin), size: titleSize, color: moneyColor(money.margin) },
    { label: "Hodnota zákroku", value: formatMoney(money.billed), size: displaySize, color: ink },
  ]
  const cellWidth = contentWidth / 3
  const lines = totals.map((cell) => [
    { text: cell.label, font: fonts.regular, size: captionSize, color: muted },
    { text: cell.value, font: fonts.semibold, size: cell.size, color: cell.color },
  ])
  const blockHeight = Math.max(...lines.map((cell) => measureLines(cell, cellWidth - 8)))
  writer.ensure(blockHeight + 10)
  writer.y -= 6
  const top = writer.y
  lines.forEach((cell, index) => {
    writer.y = top
    writer.block(margin + cellWidth * index, cellWidth - 8, cell)
  })
  writer.y = top - blockHeight
}

function drawAccent(writer: PdfWriter) {
  writer.page.drawLine({
    start: { x: margin, y: writer.y },
    end: { x: margin + 52, y: writer.y },
    thickness: 2,
    color: accent,
  })
  writer.y -= 12
}

function visitLeadHeight(nextService: string, mechanicNote: string) {
  return 48 + 32 + 36 + (nextService || mechanicNote ? 40 : 0)
}

function visitLabel(record: ServiceRecord) {
  return `${formatDate(record.serviceDate)} · ${formatKm(record.mileage)}`
}

function drawVisitHeading(writer: PdfWriter, record: ServiceRecord, fonts: Fonts) {
  const date = formatDate(record.serviceDate)
  const km = formatKm(record.mileage)
  const barHeight = 24
  writer.y -= 8
  const top = writer.y
  writer.page.drawRectangle({
    x: margin,
    y: top - barHeight,
    width: contentWidth,
    height: barHeight,
    color: rgb(0.96, 0.96, 0.96),
  })
  const textY = top - 16
  writer.page.drawText(date, {
    x: margin + 8,
    y: textY,
    size: titleSize,
    font: fonts.semibold,
    color: ink,
  })
  const kmWidth = fonts.semibold.widthOfTextAtSize(km, titleSize)
  writer.page.drawText(km, {
    x: margin + contentWidth - 8 - kmWidth,
    y: textY,
    size: titleSize,
    font: fonts.semibold,
    color: ink,
  })
  writer.y = top - barHeight - 10
}

function drawPageNumbers(pdf: PDFDocument, fonts: Fonts) {
  const pages = pdf.getPages()
  const label = (index: number) => `${index + 1} / ${pages.length}`
  pages.forEach((page, index) => {
    const text = label(index)
    const width = fonts.regular.widthOfTextAtSize(text, captionSize)
    page.drawText(text, {
      x: margin + contentWidth - width,
      y: 28,
      size: captionSize,
      font: fonts.regular,
      color: muted,
    })
  })
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

  drawVehicleCustomer(writer, fonts, vehicle, customer)
  drawNextAndNote(writer, fonts, nextService, mechanicNote)
  drawItemTable(writer, record.items, fonts)
  if (!customerView) {
    drawMoneyTotals(writer, record, fonts)
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

export async function historyPdfBytes({
  records,
  vehicle,
  customer,
  customerView,
}: {
  records: ServiceRecord[]
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
  const history = [...records].sort(
    (left, right) => left.serviceDate.localeCompare(right.serviceDate) || left.mileage - right.mileage
  )
  const last = history[history.length - 1]
  const plate = formatPlate(vehicle.licensePlate) || vehicle.makeModel
  let currentVisit = ""
  writer.onNewPage = () => {
    writer.page.drawText(`Autopedant · Servisná história · ${plate}`, {
      x: margin,
      y: pageHeight - margin - captionSize,
      size: captionSize,
      font: fonts.regular,
      color: muted,
    })
    writer.y = pageHeight - margin - captionSize - 10
    if (currentVisit) {
      writer.page.drawText(currentVisit, {
        x: margin,
        y: writer.y - titleSize,
        size: titleSize,
        font: fonts.semibold,
        color: ink,
      })
      writer.y -= titleSize + 12
    }
  }

  writer.block(margin, contentWidth, [
    { text: "Autopedant", font: fonts.regular, size: captionSize, color: muted },
  ])
  writer.y -= 2
  writer.block(margin, contentWidth, [{ text: "Servisná história", font: fonts.semibold, size: displaySize }])
  if (customerView) {
    writer.block(margin, contentWidth, [
      { text: "Zobrazenie pre zákazníka", font: fonts.regular, size: captionSize, color: muted },
    ])
  }
  writer.y -= 2
  drawAccent(writer)

  drawVehicleCustomer(writer, fonts, vehicle, customer)

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
  writer.y -= 8

  for (const record of history) {
    const nextService = formatNextService(record)
    const mechanicNote = record.mechanicNotes.trim()
    currentVisit = ""
    writer.ensure(visitLeadHeight(nextService, mechanicNote))
    drawVisitHeading(writer, record, fonts)
    currentVisit = visitLabel(record)
    drawNextAndNote(writer, fonts, nextService, mechanicNote)
    drawItemTable(writer, record.items, fonts)
    if (!customerView) {
      drawMoneyTotals(writer, record, fonts)
    }
    writer.y -= 12
  }

  drawPageNumbers(pdf, fonts)
  return pdf.save()
}

export async function downloadHistoryPdf(input: {
  records: ServiceRecord[]
  vehicle: Vehicle
  customer: Customer
  customerView: boolean
}) {
  const name = formatPlate(input.vehicle.licensePlate) || input.vehicle.makeModel
  const bytes = await historyPdfBytes(input)
  await savePdfBlob(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `${name} servisna-historia.pdf`)
}
