"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { formatPlate, isISODate, normalizeCode } from "@/lib/format"
import { normalizeCategory } from "@/lib/service-catalog"
import { seedData } from "@/lib/seed"
import { fuelTypes, type Customer, type FuelType, type ServiceRecord, type Vehicle, type WorkshopData } from "@/lib/types"

const STORAGE_KEY = "autopedant.workshop.v1"

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

export function WorkshopProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WorkshopData>(seedData)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (isWorkshopData(parsed)) {
          const seededById = new Map(seedData.records.map((record) => [record.id, record]))
          const seededVehicles = new Map(seedData.vehicles.map((vehicle) => [vehicle.id, vehicle]))
          setData({
            ...parsed,
            vehicles: parsed.vehicles.map((vehicle) => normalizeVehicle(vehicle, seededVehicles.get(vehicle.id))),
            records: parsed.records.map((record) => {
              const seeded = seededById.get(record.id)
              const migrated: ServiceRecord = {
                ...record,
                items: record.items.map((item) => {
                  const seededItem = seeded?.items.find((seedItem) => seedItem.id === item.id)
                  return {
                    ...item,
                    category: normalizeCategory(item.category),
                    partBrand: item.partBrand || seededItem?.partBrand || "",
                    materialType: item.materialType || seededItem?.materialType || "",
                    quantity: item.quantity || seededItem?.quantity || "",
                  }
                }),
              }

              if (!seeded) {
                return migrated
              }

              return {
                ...migrated,
                nextServiceDate: record.nextServiceDate ?? seeded.nextServiceDate,
                nextServiceMileage: record.nextServiceMileage ?? seeded.nextServiceMileage,
              }
            }),
          })
        }
      }
    } catch {
      setData(seedData)
    }

    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) {
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data, ready])

  const addVehicle = useCallback((input: NewVehicleInput) => {
    const plate = formatPlate(input.licensePlate)
    const plateKey = normalizeCode(plate)
    const duplicate = data.vehicles.some((vehicle) => normalizeCode(vehicle.licensePlate) === plateKey)

    if (duplicate) {
      return { ok: false as const, message: `Vozidlo s EČV ${plate} už je v evidencii.` }
    }

    const vehicleId = crypto.randomUUID()
    const customerId = input.customerId ?? crypto.randomUUID()

    setData((current) => ({
      customers: input.customerId
        ? current.customers.map((customer) =>
            customer.id === input.customerId
              ? {
                  ...customer,
                  name: input.customerName.trim() || customer.name,
                  phone: input.phone.trim(),
                  email: input.email?.trim() || undefined,
                }
              : customer
          )
        : [
            ...current.customers,
            {
              id: customerId,
              name: input.customerName.trim(),
              phone: input.phone.trim(),
              email: input.email?.trim() || undefined,
            },
          ],
      vehicles: [
        ...current.vehicles,
        {
          id: vehicleId,
          licensePlate: plate,
          vin: input.vin.trim().toUpperCase(),
          makeModel: input.makeModel.trim(),
          year: input.year,
          firstRegistrationDate: input.firstRegistrationDate,
          engineDisplacement: input.engineDisplacement,
          fuel: input.fuel,
          customerId,
        },
      ],
      records: current.records,
    }))

    return { ok: true as const, id: vehicleId }
  }, [data.vehicles])

  const addRecord = useCallback((record: ServiceRecord) => {
    setData((current) => ({
      ...current,
      records: [...current.records, record],
    }))
  }, [])

  const updateRecord = useCallback((record: ServiceRecord) => {
    setData((current) => ({
      ...current,
      records: current.records.map((item) => (item.id === record.id ? record : item)),
    }))
  }, [])

  const value = useMemo<WorkshopContextValue>(
    () => ({
      ready,
      customers: data.customers,
      vehicles: data.vehicles,
      records: data.records,
      addVehicle,
      addRecord,
      updateRecord,
    }),
    [addRecord, addVehicle, updateRecord, data, ready]
  )

  return (
    <WorkshopContext.Provider value={value}>
      {ready ? children : <div className="min-h-svh bg-[#F4F6F8]" />}
    </WorkshopContext.Provider>
  )
}

function isFuelType(value: unknown): value is FuelType {
  return typeof value === "string" && fuelTypes.includes(value as FuelType)
}

function normalizeVehicle(vehicle: Vehicle, seeded?: Vehicle): Vehicle {
  return {
    ...vehicle,
    engineDisplacement: vehicle.engineDisplacement || seeded?.engineDisplacement || 0,
    firstRegistrationDate: isISODate(vehicle.firstRegistrationDate)
      ? vehicle.firstRegistrationDate
      : (seeded?.firstRegistrationDate ?? ""),
    fuel: isFuelType(vehicle.fuel) ? vehicle.fuel : (seeded?.fuel ?? "Benzín"),
  }
}

export function useWorkshop() {
  const context = useContext(WorkshopContext)
  if (!context) {
    throw new Error("WorkshopProvider chýba.")
  }

  return context
}
