import { engineDisplacements } from "@/lib/types"

export function formatMoney(value: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(part: number, whole: number) {
  if (whole === 0) {
    return ""
  }

  return `${Math.round((part / whole) * 100)}%`
}

export function formatKm(value: number) {
  return `${new Intl.NumberFormat("sk-SK").format(value)} km`
}

export function formatNextService(record: {
  nextServiceDate?: string
  nextServiceMileage?: number
}) {
  const date = record.nextServiceDate ? formatMonthYear(record.nextServiceDate) : ""
  const km =
    record.nextServiceMileage !== undefined ? formatKm(record.nextServiceMileage) : ""

  if (date && km) {
    return `${date} · ${km}`
  }

  return date || km
}

export function formatDate(iso: string) {
  const [year, month, day] = iso.split("-")
  if (!year || !month || !day) {
    return iso
  }

  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function formatMonthYear(iso: string) {
  const [year, month] = iso.split("-")
  if (!year || !month) {
    return iso
  }

  return `${Number(month)}. ${year}`
}

export function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("sk")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function formatDisplacement(liters: number) {
  return `${new Intl.NumberFormat("sk-SK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(liters)} l`
}

export function formatVehicleSpec(vehicle: {
  makeModel: string
  year: number
  engineDisplacement: number
  fuel: string
}) {
  return `${vehicle.makeModel}, ${vehicle.year} · ${formatDisplacement(vehicle.engineDisplacement)} · ${vehicle.fuel}`
}

export function parseDisplacement(value: string) {
  const liters = parseAmount(value)
  if (liters === null) {
    return null
  }

  return (
    engineDisplacements.find((option) => Math.round(option * 10) === Math.round(liters * 10)) ??
    null
  )
}

export function formatPlate(value: string) {
  return normalizeCode(value)
}

export function formatAmountInput(value: number) {
  if (value === 0) {
    return ""
  }

  return String(value).replace(".", ",")
}

export function parseAmount(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }

  const amount = Number(trimmed.replace(/\s/g, "").replace(",", "."))
  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }

  return Math.round(amount * 100) / 100
}

export function todayISO() {
  return toISODate(new Date())
}

export function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = fromISODate(value)
  return (
    !Number.isNaN(date.getTime()) &&
    toISODate(date) === value
  )
}
