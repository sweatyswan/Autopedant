import { formatDate, formatKm, formatMoney, formatPlate, parseAmount, parseKm } from "@/lib/format"
import type { Customer, ServiceRecord, Vehicle, WorkshopData } from "@/lib/types"

export const CHANGE_STORAGE_KEY = "autopedant.changes.v1"
export const CHANGE_LIMIT = 200

export type ChangeKind =
  | "vehicle.add"
  | "vehicle.update"
  | "vehicle.delete"
  | "record.add"
  | "record.update"
  | "record.delete"

export type ChangeSnapshot = {
  record?: ServiceRecord
  previousRecord?: ServiceRecord
  records?: ServiceRecord[]
  vehicle?: Vehicle
  previousVehicle?: Vehicle
  customer?: Customer
  previousCustomer?: Customer
  createdCustomer?: boolean
}

export type ChangeEvent = {
  id: string
  at: string
  title: string
  detail: string
  vehicleId?: string
  kind?: ChangeKind
  snapshot?: ChangeSnapshot
  reverted?: boolean
}

export function readLocalChanges(): ChangeEvent[] {
  try {
    const stored = localStorage.getItem(CHANGE_STORAGE_KEY)
    if (!stored) {
      return []
    }

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isChangeEvent).sort(byNewest)
  } catch {
    return []
  }
}

export function writeLocalChanges(changes: ChangeEvent[]) {
  localStorage.setItem(CHANGE_STORAGE_KEY, JSON.stringify(changes.slice(0, CHANGE_LIMIT)))
}

export function mergeChanges(...lists: ChangeEvent[][]) {
  const byId = new Map<string, ChangeEvent>()
  for (const list of lists) {
    for (const change of list) {
      const existing = byId.get(change.id)
      byId.set(change.id, existing ? richerChange(existing, change) : change)
    }
  }

  return [...byId.values()].sort(byNewest).slice(0, CHANGE_LIMIT)
}

function richerChange(left: ChangeEvent, right: ChangeEvent) {
  return {
    ...left,
    ...right,
    kind: right.kind ?? left.kind,
    snapshot: right.snapshot ?? left.snapshot,
    reverted: Boolean(right.reverted || left.reverted),
  }
}

export function createChange(input: Omit<ChangeEvent, "id" | "at"> & { at?: string }): ChangeEvent {
  return {
    id: crypto.randomUUID(),
    at: input.at ?? new Date().toISOString(),
    title: input.title,
    detail: input.detail,
    vehicleId: input.vehicleId,
    kind: input.kind,
    snapshot: input.snapshot,
    reverted: input.reverted,
  }
}

export function snapshotOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function canRevertChange(change: ChangeEvent) {
  return !change.reverted
}

export function hydrateChangeForRevert(change: ChangeEvent, data: WorkshopData): ChangeEvent | null {
  if (change.reverted) {
    return null
  }

  if (change.kind && change.snapshot) {
    return change
  }

  return inferChange(change, data)
}

function inferChange(change: ChangeEvent, data: WorkshopData): ChangeEvent | null {
  if (change.title === "Nové vozidlo" && change.vehicleId) {
    const vehicle = data.vehicles.find((item) => item.id === change.vehicleId)
    const customer = vehicle ? data.customers.find((item) => item.id === vehicle.customerId) : undefined
    if (!vehicle || !customer) {
      return null
    }

    return {
      ...change,
      kind: "vehicle.add",
      snapshot: {
        vehicle: snapshotOf(vehicle),
        customer: snapshotOf(customer),
        createdCustomer: data.vehicles.filter((item) => item.customerId === customer.id).length === 1,
      },
    }
  }

  if (change.title === "Nový zákrok" && change.vehicleId) {
    const record = findRecordForChange(change, data)
    if (!record) {
      return null
    }

    return {
      ...change,
      kind: "record.add",
      snapshot: { record: snapshotOf(record) },
    }
  }

  if (change.title === "Upravený zákrok" && change.vehicleId) {
    const record = findRecordForChange(change, data)
    if (!record) {
      return null
    }

    return {
      ...change,
      kind: "record.update",
      snapshot: {
        record: snapshotOf(record),
        previousRecord: snapshotOf(reverseRecord(record, change.detail)),
      },
    }
  }

  return null
}

function findRecordForChange(change: ChangeEvent, data: WorkshopData) {
  const records = data.records.filter((item) => item.vehicleId === change.vehicleId)
  if (records.length === 1) {
    return records[0]
  }

  return records.find((item) => change.detail.includes(formatDate(item.serviceDate))) ?? records[0]
}

function reverseRecord(record: ServiceRecord, detail: string): ServiceRecord {
  const next = snapshotOf(record)
  const labor = previousMoney(detail, "práca")
  if (labor !== null) {
    next.laborCost = labor
  }

  const material = previousMoney(detail, "materiál")
  if (material !== null) {
    next.materialEarnings = material
  }

  const billed = previousMoney(detail, "obrat")
  if (billed !== null) {
    next.billedAmount = billed
  }

  const km = detail.match(/tachometer ([^→]+) →/)
  if (km) {
    const parsed = parseKm(km[1].replace(/km/gi, "").trim())
    if (parsed !== null) {
      next.mileage = parsed
    }
  }

  const date = detail.match(/dátum ([^→]+) →/)
  if (date) {
    const iso = parseSlovakDate(date[1].trim())
    if (iso) {
      next.serviceDate = iso
    }
  }

  return next
}

function previousMoney(detail: string, label: string) {
  const match = detail.match(new RegExp(`${label} ([^→]+) →`))
  if (!match) {
    return null
  }

  return parseAmount(match[1].replace(/€/g, "").replace(/\u00a0/g, " ").trim())
}

function parseSlovakDate(value: string) {
  const match = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/)
  if (!match) {
    return null
  }

  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
}

export function vehicleChangeDetail(customer: Customer, vehicle: Vehicle) {
  const plate = formatPlate(vehicle.licensePlate)
  return [customer.name, plate || vehicle.makeModel].filter(Boolean).join(" · ")
}

export function vehicleChangeNote(
  previous: Vehicle,
  next: Vehicle,
  previousCustomer?: Customer,
  nextCustomer?: Customer
) {
  const notes: string[] = []
  if (previous.licensePlate !== next.licensePlate) {
    notes.push("EČV")
  }
  if (previous.vin !== next.vin) {
    notes.push("VIN")
  }
  if (previous.makeModel !== next.makeModel) {
    notes.push("model")
  }
  if (previous.year !== next.year) {
    notes.push("rok")
  }
  if (previous.engineDisplacement !== next.engineDisplacement) {
    notes.push("objem")
  }
  if (previous.fuel !== next.fuel) {
    notes.push("palivo")
  }
  if (previous.firstRegistrationDate !== next.firstRegistrationDate) {
    notes.push("prvá evidencia")
  }
  if (previous.customerId !== next.customerId || previousCustomer?.name !== nextCustomer?.name) {
    notes.push("zákazník")
  }
  if (previousCustomer?.phone !== nextCustomer?.phone || previousCustomer?.email !== nextCustomer?.email) {
    notes.push("kontakt")
  }

  return notes.join(", ")
}

export function recordChangeDetail(customer: Customer | undefined, vehicle: Vehicle | undefined, record: ServiceRecord) {
  const plate = vehicle ? formatPlate(vehicle.licensePlate) : ""
  return [customer?.name, plate || vehicle?.makeModel, formatDate(record.serviceDate)].filter(Boolean).join(" · ")
}

export function recordChangeNote(previous: ServiceRecord | undefined, next: ServiceRecord) {
  if (!previous) {
    return ""
  }

  const notes: string[] = []
  if (previous.serviceDate !== next.serviceDate) {
    notes.push(`dátum ${formatDate(previous.serviceDate)} → ${formatDate(next.serviceDate)}`)
  }
  if (previous.mileage !== next.mileage) {
    notes.push(`tachometer ${formatKm(previous.mileage)} → ${formatKm(next.mileage)}`)
  }
  if (previous.laborCost !== next.laborCost) {
    notes.push(`práca ${formatMoney(previous.laborCost)} → ${formatMoney(next.laborCost)}`)
  }
  if ((previous.materialEarnings ?? 0) !== (next.materialEarnings ?? 0)) {
    notes.push(`materiál ${formatMoney(previous.materialEarnings ?? 0)} → ${formatMoney(next.materialEarnings ?? 0)}`)
  }
  if ((previous.billedAmount ?? 0) !== (next.billedAmount ?? 0)) {
    notes.push(`obrat ${formatMoney(previous.billedAmount ?? 0)} → ${formatMoney(next.billedAmount ?? 0)}`)
  }
  if (previous.mechanicNotes !== next.mechanicNotes) {
    notes.push("poznámka")
  }
  if (JSON.stringify(previous.items) !== JSON.stringify(next.items)) {
    notes.push("položky")
  }

  return notes.join(", ")
}

function isChangeEvent(value: unknown): value is ChangeEvent {
  if (!value || typeof value !== "object") {
    return false
  }

  const change = value as ChangeEvent
  return Boolean(change.id && change.at && change.title)
}

function byNewest(left: ChangeEvent, right: ChangeEvent) {
  return right.at.localeCompare(left.at)
}
