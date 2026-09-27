export type FuelType = "Benzín" | "Nafta" | "LPG" | "CNG" | "Hybrid" | "Elektro"

export type Vehicle = {
  id: string
  licensePlate: string
  vin: string
  makeModel: string
  year: number
  firstRegistrationDate: string
  engineDisplacement: number
  fuel: FuelType
  customerId: string
}

export const fuelTypes: FuelType[] = ["Benzín", "Nafta", "LPG", "CNG", "Hybrid", "Elektro"]

export const engineDisplacements: number[] = Array.from(
  { length: 75 },
  (_, index) => (6 + index) / 10
)

export type Customer = {
  id: string
  name: string
  phone: string
  email?: string
}

export type ServiceActionType = "Výmena" | "Oprava" | "Kontrola" | "Nastavenie" | "Diagnostika"

export type DiagnosticScope = "komplexna" | "jednotka"

export type ServiceCategory =
  | "Motor a prevodovka"
  | "Podvozok a brzdy"
  | "Karoséria"
  | "Ostatné práce a diely"

export type ServiceItem = {
  id: string
  category: ServiceCategory
  actionType: ServiceActionType
  partName: string
  partBrand: string
  materialType: string
  quantity: string
  purchasePrice: number
  sellPrice: number
  diagnosticScope?: DiagnosticScope
  diagnosticUnit?: string
  diagnosticNote?: string
  diagnosticResolved?: boolean
  diagnosticReportId?: string
  diagnosticReportName?: string
  diagnosticReportPath?: string
}

export type ServiceRecord = {
  id: string
  vehicleId: string
  serviceDate: string
  mileage: number
  laborCost: number
  materialEarnings?: number
  billedAmount?: number
  mechanicNotes: string
  nextServiceDate?: string
  nextServiceMileage?: number
  items: ServiceItem[]
}

export type WorkshopData = {
  customers: Customer[]
  vehicles: Vehicle[]
  records: ServiceRecord[]
}

export const serviceCategories: ServiceCategory[] = [
  "Motor a prevodovka",
  "Podvozok a brzdy",
  "Karoséria",
  "Ostatné práce a diely",
]

export const serviceActions: ServiceActionType[] = [
  "Výmena",
  "Oprava",
  "Kontrola",
  "Nastavenie",
  "Diagnostika",
]
