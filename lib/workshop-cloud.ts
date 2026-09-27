import type { SupabaseClient } from "@supabase/supabase-js"

import type { ChangeEvent } from "@/lib/change-log"
import { DIAGNOSTIC_REPORT_BUCKET, diagnosticReportPath, getDiagnosticReport } from "@/lib/diagnostic-report"
import type { Customer, ServiceItem, ServiceRecord, Vehicle, WorkshopData } from "@/lib/types"

type CustomerRow = {
  id: string
  name: string
  phone: string
  email: string | null
}

type VehicleRow = {
  id: string
  customer_id: string
  license_plate: string | null
  vin: string
  make_model: string
  year: number
  first_registration_date: string | null
  engine_displacement: number
  fuel: string
}

type RecordRow = {
  id: string
  vehicle_id: string
  service_date: string
  mileage: number
  labor_cost: number
  material_earnings: number | null
  billed_amount: number | null
  mechanic_notes: string
  next_service_date: string | null
  next_service_mileage: number | null
}

type ItemRow = {
  id: string
  record_id: string
  category: ServiceItem["category"]
  action_type: ServiceItem["actionType"]
  part_name: string
  part_brand: string
  material_type: string
  quantity: string
  purchase_price: number
  sell_price: number
  sort_index: number
  diagnostic_scope?: string | null
  diagnostic_unit?: string | null
  diagnostic_note?: string | null
  diagnostic_resolved?: boolean | null
  diagnostic_report_id?: string | null
  diagnostic_report_name?: string | null
  diagnostic_report_path?: string | null
}

const itemColumns =
  "id, record_id, category, action_type, part_name, part_brand, material_type, quantity, purchase_price, sell_price, sort_index"
const itemColumnsDiagnostic = `${itemColumns}, diagnostic_scope, diagnostic_unit, diagnostic_note, diagnostic_resolved`
const itemColumnsFull = `${itemColumnsDiagnostic}, diagnostic_report_id, diagnostic_report_name, diagnostic_report_path`

function customerRow(userId: string, customer: Customer) {
  return {
    id: customer.id,
    user_id: userId,
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? null,
  }
}

function vehicleRow(userId: string, vehicle: Vehicle) {
  return {
    id: vehicle.id,
    user_id: userId,
    customer_id: vehicle.customerId,
    license_plate: vehicle.licensePlate.trim() || null,
    vin: vehicle.vin,
    make_model: vehicle.makeModel,
    year: vehicle.year,
    first_registration_date: vehicle.firstRegistrationDate || null,
    engine_displacement: vehicle.engineDisplacement,
    fuel: vehicle.fuel,
  }
}

function recordRow(userId: string, record: ServiceRecord) {
  return {
    id: record.id,
    user_id: userId,
    vehicle_id: record.vehicleId,
    service_date: record.serviceDate,
    mileage: record.mileage,
    labor_cost: record.laborCost,
    material_earnings: record.materialEarnings ?? null,
    billed_amount: record.billedAmount ?? null,
    mechanic_notes: record.mechanicNotes,
    next_service_date: record.nextServiceDate ?? null,
    next_service_mileage: record.nextServiceMileage ?? null,
  }
}

function itemRows(userId: string, record: ServiceRecord) {
  return record.items.map((item, index) => ({
    id: item.id,
    user_id: userId,
    record_id: record.id,
    category: item.category,
    action_type: item.actionType,
    part_name: item.partName,
    part_brand: item.partBrand,
    material_type: item.materialType,
    quantity: item.quantity,
    purchase_price: item.purchasePrice,
    sell_price: item.sellPrice,
    sort_index: index,
    diagnostic_scope: item.diagnosticScope ?? null,
    diagnostic_unit: item.diagnosticUnit ?? null,
    diagnostic_note: item.diagnosticNote ?? null,
    diagnostic_resolved: item.actionType === "Diagnostika" ? Boolean(item.diagnosticResolved) : null,
    diagnostic_report_id: item.diagnosticReportId ?? null,
    diagnostic_report_name: item.diagnosticReportName ?? null,
    diagnostic_report_path: item.diagnosticReportPath ?? null,
  }))
}

function missingDiagnosticColumn(message: string) {
  return /diagnostic_/i.test(message)
}

function missingReportColumn(message: string) {
  return /diagnostic_report_/i.test(message)
}

function withoutReportColumns<T extends Record<string, unknown>>(row: T) {
  const { diagnostic_report_id, diagnostic_report_name, diagnostic_report_path, ...rest } = row
  return rest
}

function withoutDiagnosticColumns<T extends Record<string, unknown>>(row: T) {
  const {
    diagnostic_scope,
    diagnostic_unit,
    diagnostic_note,
    diagnostic_resolved,
    diagnostic_report_id,
    diagnostic_report_name,
    diagnostic_report_path,
    ...rest
  } = row
  return rest
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
  }
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    customerId: row.customer_id,
    licensePlate: row.license_plate ?? "",
    vin: row.vin,
    makeModel: row.make_model,
    year: Number(row.year),
    firstRegistrationDate:
      !row.first_registration_date || row.first_registration_date === "1970-01-01"
        ? ""
        : row.first_registration_date,
    engineDisplacement: Number(row.engine_displacement),
    fuel: row.fuel as Vehicle["fuel"],
  }
}

function toRecord(row: RecordRow, items: ServiceItem[]): ServiceRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    serviceDate: row.service_date,
    mileage: Number(row.mileage),
    laborCost: Number(row.labor_cost),
    materialEarnings: row.material_earnings === null ? undefined : Number(row.material_earnings),
    billedAmount: row.billed_amount === null ? undefined : Number(row.billed_amount),
    mechanicNotes: row.mechanic_notes,
    nextServiceDate: row.next_service_date ?? undefined,
    nextServiceMileage: row.next_service_mileage === null ? undefined : Number(row.next_service_mileage),
    items,
  }
}

function toItem(row: ItemRow): ServiceItem {
  const scope = row.diagnostic_scope === "komplexna" || row.diagnostic_scope === "jednotka" ? row.diagnostic_scope : undefined

  return {
    id: row.id,
    category: row.category,
    actionType: row.action_type,
    partName: row.part_name,
    partBrand: row.part_brand,
    materialType: row.material_type,
    quantity: row.quantity,
    purchasePrice: Number(row.purchase_price),
    sellPrice: Number(row.sell_price),
    diagnosticScope: scope,
    diagnosticUnit: row.diagnostic_unit || undefined,
    diagnosticNote: row.diagnostic_note || undefined,
    diagnosticResolved: typeof row.diagnostic_resolved === "boolean" ? row.diagnostic_resolved : undefined,
    diagnosticReportId: row.diagnostic_report_id || undefined,
    diagnosticReportName: row.diagnostic_report_name || undefined,
    diagnosticReportPath: row.diagnostic_report_path || undefined,
  }
}

async function loadRecordItems(client: SupabaseClient) {
  const full = await client.from("record_items").select(itemColumnsFull)
  if (!full.error) {
    return full
  }

  if (missingReportColumn(full.error.message)) {
    return client.from("record_items").select(itemColumnsDiagnostic)
  }

  if (missingDiagnosticColumn(full.error.message)) {
    return client.from("record_items").select(itemColumns)
  }

  return full
}

export async function loadWorkshop(client: SupabaseClient): Promise<WorkshopData> {
  const [customers, vehicles, records, items] = await Promise.all([
    client.from("customers").select("id, name, phone, email"),
    client.from("vehicles").select(
      "id, customer_id, license_plate, vin, make_model, year, first_registration_date, engine_displacement, fuel"
    ),
    client.from("records").select(
      "id, vehicle_id, service_date, mileage, labor_cost, material_earnings, billed_amount, mechanic_notes, next_service_date, next_service_mileage"
    ),
    loadRecordItems(client),
  ])

  const error = customers.error || vehicles.error || records.error || items.error
  if (error) {
    throw error
  }

  const itemsByRecord = new Map<string, ServiceItem[]>()
  const itemRowsList = (items.data ?? []) as ItemRow[]
  for (const row of [...itemRowsList].sort((left, right) => left.sort_index - right.sort_index)) {
    const list = itemsByRecord.get(row.record_id) ?? []
    list.push(toItem(row))
    itemsByRecord.set(row.record_id, list)
  }

  return {
    customers: ((customers.data ?? []) as CustomerRow[]).map(toCustomer),
    vehicles: ((vehicles.data ?? []) as VehicleRow[]).map(toVehicle),
    records: ((records.data ?? []) as RecordRow[]).map((row) => toRecord(row, itemsByRecord.get(row.id) ?? [])),
  }
}

export async function pushWorkshop(client: SupabaseClient, userId: string, data: WorkshopData) {
  if (data.customers.length) {
    const { error } = await client.from("customers").upsert(data.customers.map((customer) => customerRow(userId, customer)))
    if (error) {
      throw error
    }
  }

  if (data.vehicles.length) {
    const { error } = await client.from("vehicles").upsert(data.vehicles.map((vehicle) => vehicleRow(userId, vehicle)))
    if (error) {
      throw error
    }
  }

  if (data.records.length) {
    const { error } = await client.from("records").upsert(data.records.map((record) => recordRow(userId, record)))
    if (error) {
      throw error
    }

    const items = data.records.flatMap((record) => itemRows(userId, record))
    if (items.length) {
      await writeRecordItems(client, items, "upsert")
    }
  }
}

export async function saveCustomerAndVehicle(
  client: SupabaseClient,
  userId: string,
  customer: Customer,
  vehicle: Vehicle
) {
  const customerWrite = await client.from("customers").upsert(customerRow(userId, customer))
  if (customerWrite.error) {
    throw customerWrite.error
  }

  const vehicleWrite = await client.from("vehicles").upsert(vehicleRow(userId, vehicle))
  if (vehicleWrite.error) {
    throw vehicleWrite.error
  }
}

export async function deleteRecordRow(client: SupabaseClient, recordId: string) {
  const { error } = await client.from("records").delete().eq("id", recordId)
  if (error) {
    throw error
  }
}

export async function saveRecord(client: SupabaseClient, userId: string, record: ServiceRecord) {
  const recordWrite = await client.from("records").upsert(recordRow(userId, record))
  if (recordWrite.error) {
    throw recordWrite.error
  }

  const clear = await client.from("record_items").delete().eq("record_id", record.id)
  if (clear.error) {
    throw clear.error
  }

  const items = itemRows(userId, record)
  if (items.length === 0) {
    return
  }

  await writeRecordItems(client, items, "insert")
}

async function writeRecordItems(
  client: SupabaseClient,
  items: ReturnType<typeof itemRows>,
  mode: "insert" | "upsert"
) {
  const write = mode === "insert" ? client.from("record_items").insert(items) : client.from("record_items").upsert(items)
  const first = await write
  if (!first.error) {
    return
  }

  if (missingReportColumn(first.error.message)) {
    const retry = mode === "insert"
      ? await client.from("record_items").insert(items.map(withoutReportColumns))
      : await client.from("record_items").upsert(items.map(withoutReportColumns))
    if (!retry.error) {
      return
    }
    if (missingDiagnosticColumn(retry.error.message)) {
      const last = mode === "insert"
        ? await client.from("record_items").insert(items.map(withoutDiagnosticColumns))
        : await client.from("record_items").upsert(items.map(withoutDiagnosticColumns))
      if (last.error) {
        throw last.error
      }
      return
    }
    throw retry.error
  }

  if (missingDiagnosticColumn(first.error.message)) {
    const retry = mode === "insert"
      ? await client.from("record_items").insert(items.map(withoutDiagnosticColumns))
      : await client.from("record_items").upsert(items.map(withoutDiagnosticColumns))
    if (retry.error) {
      throw retry.error
    }
    return
  }

  throw first.error
}

export async function uploadDiagnosticReports(client: SupabaseClient, userId: string, record: ServiceRecord) {
  const items = await Promise.all(
    record.items.map(async (item) => {
      if (!item.diagnosticReportId || !item.diagnosticReportName) {
        return item
      }

      const local = await getDiagnosticReport(item.diagnosticReportId)
      if (!local) {
        return item
      }

      const path = item.diagnosticReportPath || diagnosticReportPath(userId, item.diagnosticReportId)
      const { error } = await client.storage.from(DIAGNOSTIC_REPORT_BUCKET).upload(path, local.blob, {
        upsert: true,
        contentType: "application/pdf",
      })

      if (error) {
        return item
      }

      return { ...item, diagnosticReportPath: path }
    })
  )

  return { ...record, items }
}

export async function purgeWorkshopIds(
  client: SupabaseClient,
  vehicleIds: string[],
  customerIds: string[]
) {
  if (vehicleIds.length) {
    const { error } = await client.from("vehicles").delete().in("id", vehicleIds)
    if (error) {
      throw error
    }
  }

  if (customerIds.length) {
    const { error } = await client.from("customers").delete().in("id", customerIds)
    if (error) {
      throw error
    }
  }
}

export async function loadChangeEvents(client: SupabaseClient): Promise<ChangeEvent[]> {
  const full = await client
    .from("change_events")
    .select("id, at, title, detail, vehicle_id, kind, reverted, payload")
    .order("at", { ascending: false })
    .limit(200)

  const result = full.error
    ? await client
        .from("change_events")
        .select("id, at, title, detail, vehicle_id")
        .order("at", { ascending: false })
        .limit(200)
    : full

  if (result.error) {
    if (/change_events|schema cache|does not exist/i.test(result.error.message)) {
      return []
    }
    throw result.error
  }

  return (result.data ?? []).map((row) => ({
    id: row.id,
    at: row.at,
    title: row.title,
    detail: row.detail ?? "",
    vehicleId: row.vehicle_id || undefined,
    kind: "kind" in row && typeof row.kind === "string" ? (row.kind as ChangeEvent["kind"]) : undefined,
    reverted: "reverted" in row ? Boolean(row.reverted) : undefined,
    snapshot: "payload" in row && row.payload && typeof row.payload === "object" ? row.payload : undefined,
  }))
}

export async function saveChangeEvent(client: SupabaseClient, userId: string, change: ChangeEvent) {
  const row = {
    id: change.id,
    user_id: userId,
    at: change.at,
    title: change.title,
    detail: change.detail,
    vehicle_id: change.vehicleId ?? null,
    kind: change.kind ?? null,
    reverted: Boolean(change.reverted),
    payload: change.snapshot ?? null,
  }
  const { error } = await client.from("change_events").upsert(row)

  if (error && /payload|kind|reverted|column/i.test(error.message)) {
    const retry = await client.from("change_events").upsert({
      id: change.id,
      user_id: userId,
      at: change.at,
      title: change.title,
      detail: change.detail,
      vehicle_id: change.vehicleId ?? null,
    })
    if (retry.error && !/change_events|schema cache|does not exist/i.test(retry.error.message)) {
      throw retry.error
    }
    return
  }

  if (error && !/change_events|schema cache|does not exist/i.test(error.message)) {
    throw error
  }
}

export function cloudErrorMessage(error: unknown) {
  const text = error && typeof error === "object" && "message" in error ? String(error.message) : ""
  if (/paused|not found|project is not available/i.test(text)) {
    return "Cloud je pozastavený. Údaje ostávajú v tomto prehliadači."
  }

  return "Cloud sa nepodarilo synchronizovať."
}
