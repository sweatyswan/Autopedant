import { normalizeCode } from "@/lib/format"
import type { WorkshopData } from "@/lib/types"

export const emptyWorkshop: WorkshopData = {
  customers: [],
  vehicles: [],
  records: [],
}

const demoVehicleIds = new Set(["veh_octavia", "veh_leon", "veh_sportage", "veh_clio"])
const demoRecordIds = new Set([
  "rec_octavia_1",
  "rec_octavia_2",
  "rec_leon_1",
  "rec_sportage_1",
  "rec_clio_1",
])
const demoPlates = new Set(["BA123XY", "BA321EF", "ZH456AB", "TT789CD"])
const demoNames = new Set(["Peter Holub", "Martina Kováčová", "Andrej Sokol"])

export function stripDemoWorkshop(data: WorkshopData): WorkshopData {
  const vehicles = data.vehicles.filter(
    (vehicle) => !demoVehicleIds.has(vehicle.id) && !demoPlates.has(normalizeCode(vehicle.licensePlate))
  )
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id))
  const records = data.records.filter(
    (record) => !demoRecordIds.has(record.id) && vehicleIds.has(record.vehicleId)
  )
  const customerIds = new Set(vehicles.map((vehicle) => vehicle.customerId))
  const customers = data.customers.filter(
    (customer) => customerIds.has(customer.id) && !demoNames.has(customer.name)
  )

  return { customers, vehicles, records }
}
