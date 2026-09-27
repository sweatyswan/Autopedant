import { formatDate, formatKm, formatMoney, formatPlate } from "@/lib/format"
import type { Customer, ServiceRecord, Vehicle } from "@/lib/types"

export const CHANGE_STORAGE_KEY = "autopedant.changes.v1"
export const CHANGE_LIMIT = 200

export type ChangeEvent = {
  id: string
  at: string
  title: string
  detail: string
  vehicleId?: string
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
      byId.set(change.id, change)
    }
  }

  return [...byId.values()].sort(byNewest).slice(0, CHANGE_LIMIT)
}

export function createChange(input: Omit<ChangeEvent, "id" | "at"> & { at?: string }): ChangeEvent {
  return {
    id: crypto.randomUUID(),
    at: input.at ?? new Date().toISOString(),
    title: input.title,
    detail: input.detail,
    vehicleId: input.vehicleId,
  }
}

export function vehicleChangeDetail(customer: Customer, vehicle: Vehicle) {
  const plate = formatPlate(vehicle.licensePlate)
  return [customer.name, plate || vehicle.makeModel].filter(Boolean).join(" · ")
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
