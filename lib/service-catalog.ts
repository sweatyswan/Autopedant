import type { ServiceActionType, ServiceCategory } from "@/lib/types"

export type ServiceOperation = {
  name: string
  custom?: boolean
}

export const serviceGroups: Array<{
  category: ServiceCategory
  operations: ServiceOperation[]
}> = [
  {
    category: "Motor a prevodovka",
    operations: [
      { name: "Olej motorový" },
      { name: "Olej prevodový" },
      { name: "Olej servo" },
      { name: "Filter olejový – motor" },
      { name: "Filter olejový – prevodovka" },
      { name: "Filter vzduchový" },
      { name: "Filter kabínový" },
      { name: "Filter palivový" },
      { name: "Chladiaca kvapalina" },
      { name: "Autobatéria" },
      { name: "Sviečky / žhaviče" },
      { name: "Rozvody" },
      { name: "Remene" },
      { name: "Spojka" },
      { name: "Ostatné", custom: true },
    ],
  },
  {
    category: "Podvozok a brzdy",
    operations: [
      { name: "Brzdové doštičky / čeľuste" },
      { name: "Brzdové kotúče" },
      { name: "Brzdová kvapalina" },
      { name: "Čapy ramien" },
      { name: "Čapy riadenia" },
      { name: "Silentbloky" },
      { name: "Tlmiče pérovania" },
      { name: "Pneu / disky" },
      { name: "Výfuk" },
      { name: "Ostatné", custom: true },
    ],
  },
  {
    category: "Karoséria",
    operations: [
      { name: "Autosklo" },
      { name: "Kvapalina do ostrekovačov" },
      { name: "Svetlomety a osvetlenie" },
      { name: "Zrkadlá" },
      { name: "Zámky" },
      { name: "Karosárske diely" },
      { name: "Chladenie" },
      { name: "Klimatizácia" },
      { name: "Stierače" },
      { name: "Ostatné", custom: true },
    ],
  },
  {
    category: "Ostatné práce a diely",
    operations: [
      { name: "Diagnostika" },
      { name: "Geometria" },
      { name: "Ostatné", custom: true },
    ],
  },
]

const legacyCategories: Record<string, ServiceCategory> = {
  "Údržba a náplne": "Motor a prevodovka",
  "Motor a pohon": "Motor a prevodovka",
  "Brzdový systém": "Podvozok a brzdy",
  "Podvozok a riadenie": "Podvozok a brzdy",
  "Karoséria a interiér": "Karoséria",
  "Klimatizácia a chladenie": "Karoséria",
  "Elektrika a diagnostika": "Ostatné práce a diely",
}

export function operationsFor(category?: ServiceCategory | "") {
  if (!category) {
    return []
  }

  return serviceGroups.find((group) => group.category === category)?.operations ?? []
}

export function actionsFor(category?: ServiceCategory | ""): ServiceActionType[] {
  if (category === "Karoséria") {
    return ["Výmena", "Oprava", "Kontrola"]
  }

  return ["Výmena", "Oprava", "Nastavenie", "Kontrola"]
}

export function isCustomOperation(category?: ServiceCategory | "", name = "") {
  return operationsFor(category).some((operation) => operation.name === name && operation.custom)
}

export function operationForPart(category: ServiceCategory, partName: string) {
  const operations = operationsFor(category)
  return (
    operations.find((operation) => operation.name === partName) ??
    operations.find((operation) => operation.custom) ??
    operations[0]
  )
}

export function normalizeCategory(value: string): ServiceCategory {
  if (serviceGroups.some((group) => group.category === value)) {
    return value as ServiceCategory
  }

  return legacyCategories[value] ?? "Ostatné práce a diely"
}
