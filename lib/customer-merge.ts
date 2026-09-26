import { normalizeCode, normalizeName } from "@/lib/format"
import type { ServiceRecord, Vehicle, WorkshopData } from "@/lib/types"

const merges: { into: string; name: string; from: string[] }[] = [
  { into: "cus_rado-baca", name: "Rado Bača", from: ["cus_radko-baca"] },
  { into: "cus_jan-forgac", name: "Ján Forgač", from: ["cus_janko-forgac"] },
  { into: "cus_miso-gafrik", name: "Mišo Gafrik", from: ["cus_misko-gafrik"] },
  { into: "cus_juraj-hlavacka", name: "Juraj Hlavačka", from: ["cus_juro-hlavacka"] },
  { into: "cus_michaela-laurova", name: "Michaela Laurová", from: ["cus_miska-laurova"] },
  { into: "cus_pali-talar", name: "Pali Talár", from: ["cus_talar-pali"] },
  { into: "cus_miro-tomasik", name: "Miro Tomašík", from: ["cus_mirko-tomasik"] },
  { into: "cus_janko-antosik", name: "Janko Antošík", from: ["cus_janko-antosii"] },
  { into: "cus_mirko-zavadsky", name: "Mirko Zavadský", from: ["cus_mirko-zavavadsky"] },
  { into: "cus_jozef-vlcko", name: "Jozef Vlčko", from: ["cus_jojo-vlcko", "cus_jozo-vlcko"] },
  { into: "cus_peter-saly", name: "Peter Šaly", from: ["cus_peter"] },
  { into: "cus_dusan-helin", name: "Dušan Helin", from: ["cus_dusan-korec"] },
]

function customerRedirect(id: string) {
  for (const merge of merges) {
    if (merge.from.includes(id)) {
      return merge.into
    }
  }

  return id
}

function modelKey(makeModel: string) {
  let key = normalizeName(makeModel)
  key = key
    .replace(/\bhyudai\b/g, "hyundai")
    .replace(/\bhyunda\b/g, "hyundai")
    .replace(/\bdaster\b/g, "duster")
    .replace(/\bsegwai\b/g, "segway")
    .replace(/\btuscon\b/g, "tucson")
    .replace(/\btuson\b/g, "tucson")
    .replace(/\boptyma\b/g, "optima")
    .replace(/\boctavia\b/g, "octavia")
    .replace(/\bcitroen c3\b/g, "c3")
    .replace(/\brenault clio\b/g, "clio")
    .replace(/\bhonda crv\b/g, "crv")
    .replace(/\bhonda civic\b/g, "civic")
    .replace(/\bpeugeot 301\b/g, "p301")
    .replace(/\bp 301\b/g, "p301")
    .replace(/\bpeugeot 207\b/g, "p207")
    .replace(/\bp207\b/g, "p207")
    .replace(/\bhyundai i20\b/g, "i20")
    .replace(/\bhyundai i30\b/g, "i30")
    .replace(/\bkia sportage\b/g, "sportage")
    .replace(/\bseat alhambra\b/g, "alhambra")
    .replace(/\bnissan x trail\b/g, "xtrail")
    .replace(/\bskoda\b/g, "skoda")

  return key.replace(/\s+/g, " ").trim()
}

function isUsefulVin(vin: string) {
  return vin.length >= 11 && /^[A-HJ-NPR-Z0-9]+$/i.test(vin)
}

function pickVehicle(left: Vehicle, right: Vehicle) {
  const leftPlate = Boolean(left.licensePlate)
  const rightPlate = Boolean(right.licensePlate)
  if (leftPlate !== rightPlate) {
    return leftPlate ? left : right
  }

  const leftVin = isUsefulVin(left.vin)
  const rightVin = isUsefulVin(right.vin)
  if (leftVin !== rightVin) {
    return leftVin ? left : right
  }

  if (left.makeModel.length !== right.makeModel.length) {
    return left.makeModel.length >= right.makeModel.length ? left : right
  }

  return left
}

function mergeVehiclePair(keep: Vehicle, drop: Vehicle): Vehicle {
  return {
    ...keep,
    licensePlate: keep.licensePlate || drop.licensePlate,
    vin: isUsefulVin(keep.vin) ? keep.vin : drop.vin,
    makeModel: keep.makeModel.length >= drop.makeModel.length ? keep.makeModel : drop.makeModel,
  }
}

function collapseVehicles(vehicles: Vehicle[], records: ServiceRecord[]) {
  const byCustomer = new Map<string, Vehicle[]>()
  for (const vehicle of vehicles) {
    const list = byCustomer.get(vehicle.customerId) ?? []
    list.push(vehicle)
    byCustomer.set(vehicle.customerId, list)
  }

  const redirect = new Map<string, string>()
  const nextVehicles: Vehicle[] = []

  for (const group of byCustomer.values()) {
    const buckets = new Map<string, Vehicle[]>()

    for (const vehicle of group) {
      const vin = isUsefulVin(vehicle.vin) ? `vin:${normalizeCode(vehicle.vin)}` : ""
      const plate = vehicle.licensePlate ? `plate:${normalizeCode(vehicle.licensePlate)}` : ""
      const key = vin || plate || `make:${modelKey(vehicle.makeModel)}`
      const bucket = buckets.get(key) ?? []
      bucket.push(vehicle)
      buckets.set(key, bucket)
    }

    const byMake = new Map<string, string[]>()
    for (const key of buckets.keys()) {
      const sample = buckets.get(key)?.[0]
      if (!sample) {
        continue
      }
      const make = modelKey(sample.makeModel)
      const keys = byMake.get(make) ?? []
      keys.push(key)
      byMake.set(make, keys)
    }

    for (const keys of byMake.values()) {
      const identified = keys.filter((key) => key.startsWith("vin:") || key.startsWith("plate:"))
      const anonymous = keys.filter((key) => key.startsWith("make:"))
      if (identified.length === 1 && anonymous.length) {
        const target = identified[0]
        for (const key of anonymous) {
          buckets.set(target, [...(buckets.get(target) ?? []), ...(buckets.get(key) ?? [])])
          buckets.delete(key)
        }
      }
    }

    for (const bucket of buckets.values()) {
      let survivor = bucket[0]
      for (const vehicle of bucket.slice(1)) {
        const next = pickVehicle(survivor, vehicle)
        const other = next.id === survivor.id ? vehicle : survivor
        survivor = mergeVehiclePair(next, other)
      }
      for (const vehicle of bucket) {
        if (vehicle.id !== survivor.id) {
          redirect.set(vehicle.id, survivor.id)
        }
      }
      nextVehicles.push(survivor)
    }
  }

  const nextRecords = records.map((record) => {
    const vehicleId = redirect.get(record.vehicleId) ?? record.vehicleId
    return vehicleId === record.vehicleId ? record : { ...record, vehicleId }
  })

  return { vehicles: nextVehicles, records: nextRecords }
}

export function mergeDuplicateCustomers(data: WorkshopData): {
  data: WorkshopData
  removedCustomerIds: string[]
  removedVehicleIds: string[]
} {
  const beforeVehicles = new Set(data.vehicles.map((vehicle) => vehicle.id))
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]))
  const removedCustomerIds: string[] = []

  for (const merge of merges) {
    const target = customersById.get(merge.into)
    if (!target) {
      continue
    }

    customersById.set(merge.into, { ...target, name: merge.name })

    for (const from of merge.from) {
      if (customersById.has(from)) {
        customersById.delete(from)
        removedCustomerIds.push(from)
      }
    }
  }

  const vehicles = data.vehicles.map((vehicle) => {
    const customerId = customerRedirect(vehicle.customerId)
    return customerId === vehicle.customerId ? vehicle : { ...vehicle, customerId }
  })

  const collapsed = collapseVehicles(vehicles, data.records)
  const afterVehicles = new Set(collapsed.vehicles.map((vehicle) => vehicle.id))
  const removedVehicleIds = [...beforeVehicles].filter((id) => !afterVehicles.has(id))

  return {
    data: {
      customers: [...customersById.values()].sort((left, right) => left.name.localeCompare(right.name, "sk")),
      vehicles: collapsed.vehicles,
      records: collapsed.records,
    },
    removedCustomerIds,
    removedVehicleIds,
  }
}

export function addMissingRecords(current: WorkshopData, source: WorkshopData): WorkshopData {
  const have = new Set(current.records.map((record) => record.id))
  const extra = source.records.filter((record) => !have.has(record.id))
  if (!extra.length) {
    return current
  }

  return {
    ...current,
    records: [...current.records, ...extra],
  }
}

export function workshopIdentity(data: WorkshopData) {
  return [
    ...data.customers.map((customer) => customer.id).sort(),
    ...data.vehicles.map((vehicle) => `${vehicle.id}:${vehicle.customerId}`).sort(),
    ...data.records.map((record) => `${record.id}:${record.vehicleId}`).sort(),
  ].join("|")
}
