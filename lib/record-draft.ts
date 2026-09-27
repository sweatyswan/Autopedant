import { formatAmountInput, parseAmount, parseKm } from "@/lib/format"
import { actionsFor, isCustomOperation, isDiagnosticAction, operationForPart } from "@/lib/service-catalog"
import {
  serviceCategories,
  type DiagnosticScope,
  type ServiceActionType,
  type ServiceCategory,
  type ServiceItem,
  type ServiceRecord,
} from "@/lib/types"

export type DraftItem = {
  key: string
  category: ServiceCategory | ""
  actionType: ServiceActionType | ""
  operation: string
  detail: string
  partBrand: string
  materialType: string
  quantity: string
  purchasePrice: string
  sellPrice: string
  diagnosticScope: DiagnosticScope | ""
  diagnosticUnit: string
  diagnosticNote: string
  diagnosticResolved: boolean
  diagnosticReportId: string
  diagnosticReportName: string
  diagnosticReportPath: string
}

export function emptyItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    category: "",
    actionType: "",
    operation: "",
    detail: "",
    partBrand: "",
    materialType: "",
    quantity: "",
    purchasePrice: "",
    sellPrice: "",
    diagnosticScope: "",
    diagnosticUnit: "",
    diagnosticNote: "",
    diagnosticResolved: false,
    diagnosticReportId: "",
    diagnosticReportName: "",
    diagnosticReportPath: "",
  }
}

function inferDiagnosticDraft(item: ServiceItem): Pick<
  DraftItem,
  | "diagnosticScope"
  | "diagnosticUnit"
  | "diagnosticNote"
  | "diagnosticResolved"
  | "diagnosticReportId"
  | "diagnosticReportName"
  | "diagnosticReportPath"
> {
  const report = {
    diagnosticReportId: item.diagnosticReportId ?? "",
    diagnosticReportName: item.diagnosticReportName ?? "",
    diagnosticReportPath: item.diagnosticReportPath ?? "",
  }

  if (item.diagnosticScope === "komplexna" || item.diagnosticScope === "jednotka") {
    return {
      diagnosticScope: item.diagnosticScope,
      diagnosticUnit: item.diagnosticScope === "jednotka" ? item.diagnosticUnit || item.partName : "",
      diagnosticNote: item.diagnosticNote ?? "",
      diagnosticResolved: Boolean(item.diagnosticResolved),
      ...report,
    }
  }

  if (item.partName === "Komplexná diagnostika") {
    return {
      diagnosticScope: "komplexna" as const,
      diagnosticUnit: "",
      diagnosticNote: item.diagnosticNote ?? "",
      diagnosticResolved: Boolean(item.diagnosticResolved),
      ...report,
    }
  }

  return {
    diagnosticScope: item.partName ? ("jednotka" as const) : "",
    diagnosticUnit: item.partName,
    diagnosticNote: item.diagnosticNote ?? "",
    diagnosticResolved: Boolean(item.diagnosticResolved),
    ...report,
  }
}

export function draftFromItem(item: ServiceItem): DraftItem {
  if (isDiagnosticAction(item.actionType)) {
    return {
      key: item.id,
      category: "Ostatné práce a diely",
      actionType: "Diagnostika",
      operation: "",
      detail: "",
      partBrand: "",
      materialType: "",
      quantity: "",
      purchasePrice: "",
      sellPrice: "",
      ...inferDiagnosticDraft(item),
    }
  }

  const operation = operationForPart(item.category, item.partName)
  const custom = Boolean(operation?.custom) && operation?.name !== item.partName

  return {
    key: item.id,
    category: item.category,
    actionType: item.actionType,
    operation: operation?.name ?? "Ostatné",
    detail: custom || !operation ? item.partName : "",
    partBrand: item.partBrand,
    materialType: item.materialType,
    quantity: item.quantity,
    purchasePrice: formatAmountInput(item.purchasePrice),
    sellPrice: formatAmountInput(item.sellPrice),
    diagnosticScope: "",
    diagnosticUnit: "",
    diagnosticNote: "",
    diagnosticResolved: false,
    diagnosticReportId: "",
    diagnosticReportName: "",
    diagnosticReportPath: "",
  }
}

export function itemName(item: DraftItem) {
  if (isDiagnosticAction(item.actionType)) {
    if (item.diagnosticScope === "komplexna") {
      return "Komplexná diagnostika"
    }

    return item.diagnosticUnit.trim()
  }

  if (isCustomOperation(item.category, item.operation)) {
    return item.detail.trim()
  }

  return item.operation
}

export function draftItemsToServiceItems(items: DraftItem[]) {
  const nextItems: ServiceItem[] = []

  for (const item of items) {
    if (isDiagnosticAction(item.actionType)) {
      const partName = itemName(item)
      if (!item.diagnosticScope || !partName) {
        continue
      }

      nextItems.push({
        id: item.key,
        category: "Ostatné práce a diely",
        actionType: "Diagnostika",
        partName,
        partBrand: "",
        materialType: "",
        quantity: "",
        purchasePrice: 0,
        sellPrice: 0,
        diagnosticScope: item.diagnosticScope,
        diagnosticUnit: item.diagnosticScope === "jednotka" ? item.diagnosticUnit.trim() : undefined,
        diagnosticNote: item.diagnosticNote.trim() || undefined,
        diagnosticResolved: item.diagnosticResolved,
        diagnosticReportId: item.diagnosticReportId.trim() || undefined,
        diagnosticReportName: item.diagnosticReportName.trim() || undefined,
        diagnosticReportPath: item.diagnosticReportPath.trim() || undefined,
      })
      continue
    }

    const partName = itemName(item)
    if (!partName || !item.category) {
      continue
    }

    nextItems.push({
      id: item.key,
      category: item.category,
      actionType: item.actionType || actionsFor(item.category)[0],
      partName,
      partBrand: item.partBrand.trim(),
      materialType: item.materialType.trim(),
      quantity: item.quantity.trim(),
      purchasePrice: parseAmount(item.purchasePrice) ?? 0,
      sellPrice: parseAmount(item.sellPrice) ?? 0,
    })
  }

  return nextItems
}

export function draftCategories(items: DraftItem[]) {
  const names = serviceCategories.filter((category) =>
    items.some((item) => itemName(item) && item.category === category)
  )

  return names.join(", ") || "–"
}

export function draftMoney(
  items: DraftItem[],
  laborCost: string,
  materialEarnings: string,
  billedAmount = ""
) {
  const nextItems = draftItemsToServiceItems(items)
  const purchase = nextItems.reduce((sum, item) => sum + item.purchasePrice, 0)
  const labor = parseAmount(laborCost) ?? 0
  const margin = parseAmount(materialEarnings) ?? 0
  const computedBilled = labor + purchase + margin

  return {
    purchase,
    sell: purchase + margin,
    margin,
    labor,
    computedBilled,
    billed: billedAmount.trim() === "" ? computedBilled : parseAmount(billedAmount) ?? computedBilled,
  }
}

export function commitRecordDraft({
  vehicleId,
  record,
  serviceDate,
  mileage,
  laborCost,
  materialEarnings,
  billedAmount,
  nextServiceDate,
  nextServiceMileage,
  notes,
  items,
}: {
  vehicleId: string
  record?: ServiceRecord | null
  serviceDate: string
  mileage: string
  laborCost: string
  materialEarnings: string
  billedAmount: string
  nextServiceDate: string
  nextServiceMileage: string
  notes: string
  items: DraftItem[]
}): { record: ServiceRecord } | { error: string } {
  const parsedMileage = parseKm(mileage)
  const parsedLabor = parseAmount(laborCost)
  const parsedMaterial = parseAmount(materialEarnings)
  const computedBilled = draftMoney(items, laborCost, materialEarnings).computedBilled
  const parsedBilled = billedAmount.trim() === "" ? computedBilled : parseAmount(billedAmount)

  if (!serviceDate) {
    return { error: "Zadajte dátum servisu." }
  }

  if (parsedMileage === null) {
    return { error: "Stav tachometra zadajte ako celé číslo." }
  }

  if (parsedLabor === null) {
    return { error: "Cenu práce zadajte ako číslo od 0." }
  }

  if (parsedMaterial === null) {
    return { error: "Zárobok na materiáli zadajte ako číslo od 0." }
  }

  if (parsedBilled === null) {
    return { error: "Obrat zadajte ako číslo od 0." }
  }

  const nextMileageRaw = nextServiceMileage.trim()
  const parsedNextMileage = nextMileageRaw ? parseKm(nextServiceMileage) : undefined

  if (nextMileageRaw && parsedNextMileage === null) {
    return { error: "Ďalší nájazd zadajte ako celé číslo, alebo pole nechajte prázdne." }
  }

  return {
    record: {
      id: record?.id ?? crypto.randomUUID(),
      vehicleId,
      serviceDate,
      mileage: parsedMileage,
      laborCost: parsedLabor,
      materialEarnings: parsedMaterial,
      billedAmount: parsedBilled,
      mechanicNotes: notes.trim(),
      nextServiceDate: nextServiceDate || undefined,
      nextServiceMileage: parsedNextMileage ?? undefined,
      items: draftItemsToServiceItems(items),
    },
  }
}