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
import { formatPlate, isISODate, normalizeCode } from "@/lib/format"
import { normalizeCategory } from "@/lib/service-catalog"
import { addMissingRecords, mergeDuplicateCustomers, workshopIdentity } from "@/lib/customer-merge"
import { emptyWorkshop, stripDemoWorkshop } from "@/lib/seed"
import { getSupabase } from "@/lib/supabase"
import {
  cloudErrorMessage,
  loadWorkshop,
  purgeWorkshopIds,
  pushWorkshop,
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
  fuel: FuelType
}

type WorkshopContextValue = {
  ready: boolean
  customers: Customer[]
  vehicles: Vehicle[]
  records: ServiceRecord[]
  cloudError: string
  addVehicle: (input: NewVehicleInput) => { ok: true; id: string } | { ok: false; message: string }
  addRecord: (record: ServiceRecord) => void
  updateRecord: (record: ServiceRecord) => void
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
  const [ready, setReady] = useState(false)
  const [cloudError, setCloudError] = useState("")
  const dataRef = useRef(data)
  dataRef.current = data

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
        setCloudError("")
        setReady(true)
        return
      }

      try {
        const remote = await loadWorkshop(client)
        if (!active) {
          return
        }

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
          const changed = workshopIdentity(remote) !== workshopIdentity(migrated)
          if (changed) {
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

        setCloudError("")
      } catch (error) {
        if (!active) {
          return
        }

        setData(local ?? emptyWorkshop)
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

    return { ok: true as const, id: vehicleId }
  }, [persistVehicle])

  const addRecord = useCallback((record: ServiceRecord) => {
    setData((current) => ({
      ...current,
      records: [...current.records, record],
    }))
    persistRecord(record)
  }, [persistRecord])

  const updateRecord = useCallback((record: ServiceRecord) => {
    setData((current) => ({
      ...current,
      records: current.records.map((item) => (item.id === record.id ? record : item)),
    }))
    persistRecord(record)
  }, [persistRecord])

  const value = useMemo<WorkshopContextValue>(
    () => ({
      ready,
      customers: data.customers,
      vehicles: data.vehicles,
      records: data.records,
      cloudError,
      addVehicle,
      addRecord,
      updateRecord,
    }),
    [addRecord, addVehicle, cloudError, updateRecord, data, ready]
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
