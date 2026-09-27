"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { canvasClass } from "@/components/workshop/styles"
import { useAuth } from "@/lib/auth-context"
import {
  createChange,
  mergeChanges,
  readLocalChanges,
  recordChangeDetail,
  recordChangeNote,
  vehicleChangeDetail,
  vehicleChangeNote,
  writeLocalChanges,
  type ChangeEvent,
} from "@/lib/change-log"
import { formatPlate, isISODate, normalizeCode } from "@/lib/format"
import { normalizeCategory } from "@/lib/service-catalog"
import { addMissingRecords, mergeDuplicateCustomers, workshopIdentity } from "@/lib/customer-merge"
import { emptyWorkshop, stripDemoWorkshop } from "@/lib/seed"
import { getSupabase } from "@/lib/supabase"
import {
  cloudErrorMessage,
  loadChangeEvents,
  loadWorkshop,
  purgeWorkshopIds,
  pushWorkshop,
  deleteRecordRow,
  saveChangeEvent,
  saveCustomerAndVehicle,
  saveRecord,
} from "@/lib/workshop-cloud"
import { fuelTypes, type Customer, type FuelType, type ServiceRecord, type Vehicle, type WorkshopData } from "@/lib/types"

export const STORAGE_KEY = "autopedant.workshop.v1"

type NewVehicleInput = {
  customerId: string | null
  customerName: string
  phone: string
  email?: string
  licensePlate: string
  vin: string
  makeModel: string
  year: number
  firstRegistrationDate: string
  engineDisplacement: number
  fuel: FuelType | ""
}

type WorkshopContextValue = {
  ready: boolean
  customers: Customer[]
  vehicles: Vehicle[]
  records: ServiceRecord[]
  changes: ChangeEvent[]
  cloudError: string
  addVehicle: (input: NewVehicleInput) => { ok: true; id: string } | { ok: false; message: string }
  updateVehicle: (vehicleId: string, input: NewVehicleInput) => { ok: true } | { ok: false; message: string }
  addRecord: (record: ServiceRecord) => void
  updateRecord: (record: ServiceRecord) => void
  deleteRecord: (recordId: string) => void
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null)

function isWorkshopData(value: unknown): value is WorkshopData {
  if (!value || typeof value !== "object") {
    return false
  }

  const data = value as WorkshopData
  return Array.isArray(data.customers) && Array.isArray(data.vehicles) && Array.isArray(data.records)
}

function readLocalWorkshop(): WorkshopData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed: unknown = JSON.parse(stored)
    if (!isWorkshopData(parsed)) {
      return null
    }

    return migrateWorkshop(parsed)
  } catch {
    return null
  }
}

function isPopulated(data: WorkshopData | null): data is WorkshopData {
  return Boolean(data && (data.customers.length || data.vehicles.length || data.records.length))
}

async function loadPreparedImport(): Promise<WorkshopData | null> {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  try {
    const response = await fetch(`${base}/import/workshop.json`)
    if (!response.ok) {
      return null
    }

    const parsed: unknown = await response.json()
    if (!isWorkshopData(parsed)) {
      return null
    }

    return migrateWorkshop(parsed)
  } catch {
    return null
  }
}

function migrateWorkshop(parsed: WorkshopData): WorkshopData {
  const cleaned = stripDemoWorkshop(parsed)
  const merged = mergeDuplicateCustomers({
    ...cleaned,
    vehicles: cleaned.vehicles.map((vehicle) => normalizeVehicle(vehicle)),
    records: cleaned.records.map((record) => ({
      ...record,
      billedAmount: record.billedAmount ?? 0,
      items: record.items.map((item) => ({
        ...item,
        category: normalizeCategory(item.category),
        partBrand: item.partBrand || "",
        materialType: item.materialType || "",
        quantity: item.quantity || "",
      })),
    })),
  })

  return merged.data
}

export function WorkshopProvider({ children }: { children: React.ReactNode }) {
  const { configured, session } = useAuth()
  const userId = session?.user.id
  const [data, setData] = useState<WorkshopData>(emptyWorkshop)
  const [changes, setChanges] = useState<ChangeEvent[]>([])
  const [ready, setReady] = useState(false)
  const [cloudError, setCloudError] = useState("")
  const dataRef = useRef(data)
  const changesRef = useRef(changes)
  dataRef.current = data
  changesRef.current = changes

  useEffect(() => {
    let active = true

    async function boot() {
      const stored = readLocalWorkshop()
      const local = isPopulated(stored) ? stored : null
      const client = getSupabase()

      if (!configured || !userId || !client) {
        const prepared = local ?? (await loadPreparedImport())
        if (!active) {
          return
        }
        setData(prepared ?? emptyWorkshop)
        setChanges(readLocalChanges())
        setCloudError("")
        setReady(true)
        return
      }

      try {
        const remote = await loadWorkshop(client)
        if (!active) {
          return
        }

        let mergedCards = false

        if (!isPopulated(remote)) {
          const prepared = local ?? (await loadPreparedImport())
          if (!active) {
            return
          }
          if (isPopulated(prepared)) {
            await pushWorkshop(client, userId, prepared)
            if (!active) {
              return
            }
            setData(prepared)
          } else {
            setData(emptyWorkshop)
          }
        } else {
          let migrated = migrateWorkshop(remote)
          if (!migrated.records.some((record) => record.id === "rec_veh-pali-talar-p301-2024-04-30-170000-114")) {
            const prepared = await loadPreparedImport()
            if (prepared) {
              migrated = addMissingRecords(migrated, prepared)
            }
          }
          mergedCards = workshopIdentity(remote) !== workshopIdentity(migrated)
          if (mergedCards) {
            const keptCustomers = new Set(migrated.customers.map((customer) => customer.id))
            const keptVehicles = new Set(migrated.vehicles.map((vehicle) => vehicle.id))
            await pushWorkshop(client, userId, migrated)
            await purgeWorkshopIds(
              client,
              remote.vehicles.map((vehicle) => vehicle.id).filter((id) => !keptVehicles.has(id)),
              remote.customers.map((customer) => customer.id).filter((id) => !keptCustomers.has(id))
            )
            if (!active) {
              return
            }
          }
          setData(migrated)
        }

        const localChanges = readLocalChanges()
        let nextChanges = localChanges
        try {
          nextChanges = mergeChanges(localChanges, await loadChangeEvents(client))
        } catch {
          nextChanges = localChanges
        }
        if (mergedCards) {
          nextChanges = mergeChanges(nextChanges, [
            createChange({
              title: "Zlúčené karty",
              detail: "Duplicitné mená a preklepy v evidencii.",
            }),
          ])
        }
        setChanges(nextChanges)
        setCloudError("")
      } catch (error) {
        if (!active) {
          return
        }

        setData(local ?? emptyWorkshop)
        setChanges(readLocalChanges())
        setCloudError(cloudErrorMessage(error))
      } finally {
        if (active) {
          setReady(true)
        }
      }
    }

    setReady(false)
    void boot()

    return () => {
      active = false
    }
  }, [configured, userId])

  useEffect(() => {
    if (!ready) {
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data, ready])

  useEffect(() => {
    if (!ready) {
      return
    }

    writeLocalChanges(changes)
  }, [changes, ready])

  const rememberChange = useCallback(
    (change: ChangeEvent) => {
      setChanges((current) => mergeChanges([change], current))
      const client = getSupabase()
      if (!client || !userId) {
        return
      }

      void saveChangeEvent(client, userId, change).then(
        () => setCloudError(""),
        (error) => setCloudError(cloudErrorMessage(error))
      )
    },
    [userId]
  )

  const persistVehicle = useCallback(
    (customer: Customer, vehicle: Vehicle) => {
      const client = getSupabase()
      if (!client || !userId) {
        return
      }

      void saveCustomerAndVehicle(client, userId, customer, vehicle).then(
        () => setCloudError(""),
        (error) => setCloudError(cloudErrorMessage(error))
      )
    },
    [userId]
  )

  const persistRecord = useCallback(
    (record: ServiceRecord) => {
      const client = getSupabase()
      if (!client || !userId) {
        return
      }

      void saveRecord(client, userId, record).then(
        () => setCloudError(""),
        (error) => setCloudError(cloudErrorMessage(error))
      )
    },
    [userId]
  )

  const persistRecordDelete = useCallback(
    (recordId: string) => {
      const client = getSupabase()
      if (!client || !userId) {
        return
      }

      void deleteRecordRow(client, recordId).then(
        () => setCloudError(""),
        (error) => setCloudError(cloudErrorMessage(error))
      )
    },
    [userId]
  )

  const addVehicle = useCallback((input: NewVehicleInput) => {
    const plate = formatPlate(input.licensePlate)
    const plateKey = normalizeCode(plate)
    const duplicate = dataRef.current.vehicles.some((vehicle) => normalizeCode(vehicle.licensePlate) === plateKey)

    if (duplicate) {
      return { ok: false as const, message: `Vozidlo s EČV ${plate} už je v evidencii.` }
    }

    const vehicleId = crypto.randomUUID()
    const customerId = input.customerId ?? crypto.randomUUID()
    const customer: Customer = input.customerId
      ? {
          ...(dataRef.current.customers.find((item) => item.id === input.customerId) as Customer),
          name: input.customerName.trim() || dataRef.current.customers.find((item) => item.id === input.customerId)?.name || "",
          phone: input.phone.trim(),
          email: input.email?.trim() || undefined,
        }
      : {
          id: customerId,
          name: input.customerName.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim() || undefined,
        }
    if (!input.fuel) {
      return { ok: false as const, message: "Zadajte palivo." }
    }

    const vehicle: Vehicle = {
      id: vehicleId,
      licensePlate: plate,
      vin: input.vin.trim().toUpperCase(),
      makeModel: input.makeModel.trim(),
      year: input.year,
      firstRegistrationDate: input.firstRegistrationDate,
      engineDisplacement: input.engineDisplacement,
      fuel: input.fuel,
      customerId,
    }

    setData((current) => ({
      customers: input.customerId
        ? current.customers.map((item) => (item.id === input.customerId ? customer : item))
        : [...current.customers, customer],
      vehicles: [...current.vehicles, vehicle],
      records: current.records,
    }))
    persistVehicle(customer, vehicle)
    rememberChange(
      createChange({
        title: "Nové vozidlo",
        detail: vehicleChangeDetail(customer, vehicle),
        vehicleId,
      })
    )

    return { ok: true as const, id: vehicleId }
  }, [persistVehicle, rememberChange])

  const updateVehicle = useCallback((vehicleId: string, input: NewVehicleInput) => {
    const existing = dataRef.current.vehicles.find((item) => item.id === vehicleId)
    if (!existing) {
      return { ok: false as const, message: "Vozidlo sa v evidencii nenašlo." }
    }

    const plate = formatPlate(input.licensePlate)
    const plateKey = normalizeCode(plate)
    const duplicate = dataRef.current.vehicles.some(
      (item) => item.id !== vehicleId && normalizeCode(item.licensePlate) === plateKey && plateKey
    )

    if (duplicate) {
      return { ok: false as const, message: `Vozidlo s EČV ${plate} už je v evidencii.` }
    }

    const previousCustomer = dataRef.current.customers.find((item) => item.id === existing.customerId)
    const customerId = input.customerId ?? crypto.randomUUID()
    const customer: Customer = input.customerId
      ? {
          ...(dataRef.current.customers.find((item) => item.id === input.customerId) as Customer),
          name: input.customerName.trim() || dataRef.current.customers.find((item) => item.id === input.customerId)?.name || "",
          phone: input.phone.trim(),
          email: input.email?.trim() || undefined,
        }
      : {
          id: customerId,
          name: input.customerName.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim() || undefined,
        }
    const vehicle: Vehicle = {
      id: vehicleId,
      licensePlate: plate,
      vin: input.vin.trim().toUpperCase(),
      makeModel: input.makeModel.trim(),
      year: input.year,
      firstRegistrationDate: input.firstRegistrationDate,
      engineDisplacement: input.engineDisplacement,
      fuel: input.fuel || existing.fuel,
      customerId,
    }

    setData((current) => ({
      customers: input.customerId
        ? current.customers.map((item) => (item.id === input.customerId ? customer : item))
        : [...current.customers, customer],
      vehicles: current.vehicles.map((item) => (item.id === vehicleId ? vehicle : item)),
      records: current.records,
    }))
    persistVehicle(customer, vehicle)
    rememberChange(
      createChange({
        title: "Upravené vozidlo",
        detail: [vehicleChangeDetail(customer, vehicle), vehicleChangeNote(existing, vehicle, previousCustomer, customer)]
          .filter(Boolean)
          .join(" · "),
        vehicleId,
      })
    )

    return { ok: true as const }
  }, [persistVehicle, rememberChange])

  const addRecord = useCallback((record: ServiceRecord) => {
    const vehicle = dataRef.current.vehicles.find((item) => item.id === record.vehicleId)
    const customer = dataRef.current.customers.find((item) => item.id === vehicle?.customerId)
    setData((current) => ({
      ...current,
      records: [...current.records, record],
    }))
    persistRecord(record)
    rememberChange(
      createChange({
        title: "Nový zákrok",
        detail: recordChangeDetail(customer, vehicle, record),
        vehicleId: record.vehicleId,
      })
    )
  }, [persistRecord, rememberChange])

  const updateRecord = useCallback((record: ServiceRecord) => {
    const previous = dataRef.current.records.find((item) => item.id === record.id)
    const vehicle = dataRef.current.vehicles.find((item) => item.id === record.vehicleId)
    const customer = dataRef.current.customers.find((item) => item.id === vehicle?.customerId)
    const note = recordChangeNote(previous, record)
    setData((current) => ({
      ...current,
      records: current.records.map((item) => (item.id === record.id ? record : item)),
    }))
    persistRecord(record)
    rememberChange(
      createChange({
        title: "Upravený zákrok",
        detail: [recordChangeDetail(customer, vehicle, record), note].filter(Boolean).join(" · "),
        vehicleId: record.vehicleId,
      })
    )
  }, [persistRecord, rememberChange])

  const deleteRecord = useCallback((recordId: string) => {
    const record = dataRef.current.records.find((item) => item.id === recordId)
    if (!record) {
      return
    }

    const vehicle = dataRef.current.vehicles.find((item) => item.id === record.vehicleId)
    const customer = dataRef.current.customers.find((item) => item.id === vehicle?.customerId)
    setData((current) => ({
      ...current,
      records: current.records.filter((item) => item.id !== recordId),
    }))
    persistRecordDelete(recordId)
    rememberChange(
      createChange({
        title: "Odstránený zákrok",
        detail: recordChangeDetail(customer, vehicle, record),
        vehicleId: record.vehicleId,
      })
    )
  }, [persistRecordDelete, rememberChange])

  const value = useMemo<WorkshopContextValue>(
    () => ({
      ready,
      customers: data.customers,
      vehicles: data.vehicles,
      records: data.records,
      changes,
      cloudError,
      addVehicle,
      updateVehicle,
      addRecord,
      updateRecord,
      deleteRecord,
    }),
    [addRecord, addVehicle, updateVehicle, changes, cloudError, deleteRecord, updateRecord, data, ready]
  )

  return (
    <WorkshopContext.Provider value={value}>
      {ready ? children : <div className={`min-h-svh ${canvasClass}`} />}
    </WorkshopContext.Provider>
  )
}

function isFuelType(value: unknown): value is FuelType {
  return typeof value === "string" && fuelTypes.includes(value as FuelType)
}

function normalizeVehicle(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    engineDisplacement: vehicle.engineDisplacement || 0,
    firstRegistrationDate: isISODate(vehicle.firstRegistrationDate) ? vehicle.firstRegistrationDate : "",
    fuel: isFuelType(vehicle.fuel) ? vehicle.fuel : (vehicle.fuel as FuelType),
  }
}

export function useWorkshop() {
  const context = useContext(WorkshopContext)
  if (!context) {
    throw new Error("WorkshopProvider chýba.")
  }

  return context
}
