import { formatNextService, normalizeCode, normalizeName } from "@/lib/format"
import type { Customer, ServiceRecord, Vehicle } from "@/lib/types"

export type ListSort = "last" | "next" | "customer"

export type ListSortDirection = "asc" | "desc"

export type ListFilters = {
  year?: number
  monthFrom?: number
  monthTo?: number
  brand: string
}

export function vehicleBrand(makeModel: string) {
  return makeModel.trim().split(/\s+/)[0] ?? ""
}

export function latestRecord<T extends { serviceDate: string; mileage: number }>(records: T[]) {
  return [...records].sort(
    (left, right) => right.serviceDate.localeCompare(left.serviceDate) || right.mileage - left.mileage
  )[0]
}

export function latestUpcoming(
  records: Array<{
    serviceDate: string
    mileage: number
    nextServiceDate?: string
    nextServiceMileage?: number
  }>
) {
  return latestRecord(records.filter((record) => Boolean(formatNextService(record))))
}

function isEngineOil(name: string) {
  const normalized = name.toLocaleLowerCase("sk")
  if (/filter|prevod|servo/.test(normalized)) {
    return false
  }

  return /olej/.test(normalized)
}

export function isOilRecord(record: ServiceRecord) {
  return record.items.some((item) => isEngineOil(item.partName))
}

export function latestOilRecord(records: ServiceRecord[]) {
  return latestRecord(records.filter(isOilRecord))
}

export function latestOilUpcoming(records: ServiceRecord[]) {
  const lastOil = latestOilRecord(records)
  return lastOil && formatNextService(lastOil) ? lastOil : undefined
}

export function vehicleBrands(vehicles: Vehicle[]) {
  return [...new Set(vehicles.map((vehicle) => vehicleBrand(vehicle.makeModel)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "sk")
  )
}

export function serviceYears(records: ServiceRecord[]) {
  return [...new Set(records.map((record) => Number(record.serviceDate.slice(0, 4))))]
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => right - left)
}

export const monthLabels = [
  "jan",
  "feb",
  "mar",
  "apr",
  "máj",
  "jún",
  "júl",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const

export function filterVehicles(
  vehicles: Vehicle[],
  records: ServiceRecord[],
  customers: Customer[],
  query: string,
  filters: ListFilters
) {
  const names = new Map(customers.map((customer) => [customer.id, customer.name]))
  const codeNeedle = normalizeCode(query)
  const nameNeedle = normalizeName(query)

  return vehicles.filter((vehicle) => {
    if (codeNeedle || nameNeedle) {
      const plate = normalizeCode(vehicle.licensePlate)
      const vin = normalizeCode(vehicle.vin)
      const name = normalizeName(names.get(vehicle.customerId) ?? "")
      const matchesCode = Boolean(codeNeedle) && (plate.includes(codeNeedle) || vin.includes(codeNeedle))
      const matchesName = Boolean(nameNeedle) && name.includes(nameNeedle)
      if (!matchesCode && !matchesName) {
        return false
      }
    }

    if (filters.brand !== "all" && vehicleBrand(vehicle.makeModel) !== filters.brand) {
      return false
    }

    const vehicleRecords = records.filter((record) => record.vehicleId === vehicle.id)

    if (filters.year || filters.monthFrom || filters.monthTo) {
      const monthFrom = filters.monthFrom
      const monthTo = filters.monthTo ?? filters.monthFrom
      const matchesPeriod = vehicleRecords.some((record) => {
        if (filters.year && Number(record.serviceDate.slice(0, 4)) !== filters.year) {
          return false
        }
        if (monthFrom) {
          const month = Number(record.serviceDate.slice(5, 7))
          if (month < monthFrom || (monthTo && month > monthTo)) {
            return false
          }
        }
        return true
      })

      if (!matchesPeriod) {
        return false
      }
    }

    return true
  })
}

export function sortVehicles(
  vehicles: Vehicle[],
  records: ServiceRecord[],
  customers: Customer[],
  sort: ListSort,
  direction: ListSortDirection
) {
  const names = new Map(customers.map((customer) => [customer.id, customer.name]))
  const sign = direction === "asc" ? 1 : -1

  return [...vehicles].sort((left, right) => {
    if (sort === "customer") {
      return (
        sign *
        (names.get(left.customerId) ?? "").localeCompare(names.get(right.customerId) ?? "", "sk")
      )
    }

    if (sort === "next") {
      return compareNext(records, left.id, right.id, sign)
    }

    return sign * latestOilDate(records, left.id).localeCompare(latestOilDate(records, right.id))
  })
}

function compareNext(records: ServiceRecord[], leftId: string, rightId: string, sign: number) {
  const left = nextSortKey(latestOilUpcoming(records.filter((record) => record.vehicleId === leftId)))
  const right = nextSortKey(latestOilUpcoming(records.filter((record) => record.vehicleId === rightId)))

  if (left.rank !== right.rank) {
    return left.rank - right.rank
  }

  if (left.date !== right.date) {
    return sign * left.date.localeCompare(right.date)
  }

  return sign * (left.km - right.km)
}

function nextSortKey(record?: { nextServiceDate?: string; nextServiceMileage?: number }) {
  if (!record) {
    return { rank: 2, date: "", km: Number.MAX_SAFE_INTEGER }
  }

  if (record.nextServiceDate) {
    return {
      rank: 0,
      date: record.nextServiceDate,
      km: record.nextServiceMileage ?? Number.MAX_SAFE_INTEGER,
    }
  }

  return { rank: 1, date: "", km: record.nextServiceMileage ?? Number.MAX_SAFE_INTEGER }
}

function latestOilDate(records: ServiceRecord[], vehicleId: string) {
  return latestOilRecord(records.filter((record) => record.vehicleId === vehicleId))?.serviceDate ?? ""
}

