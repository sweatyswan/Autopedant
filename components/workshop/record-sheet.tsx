"use client"

import { useEffect, useState } from "react"

import { Plus } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  fieldClass,
  primaryButtonClass,
  quietButtonClass,
  typeError,
  typeLabel,
  typeMeta,
  typeNegative,
  typeNumber,
  typeProfit,
  typeTitle,
} from "@/components/workshop/styles"
import { formatAmountInput, formatMoney, parseAmount, todayISO } from "@/lib/format"
import { useWorkshop } from "@/lib/workshop-context"
import { actionsFor, isCustomOperation, operationForPart, operationsFor } from "@/lib/service-catalog"
import {
  serviceCategories,
  type ServiceActionType,
  type ServiceCategory,
  type ServiceItem,
  type ServiceRecord,
} from "@/lib/types"

type DraftItem = {
  key: string
  category: ServiceCategory
  actionType: ServiceActionType
  operation: string
  detail: string
  partBrand: string
  materialType: string
  quantity: string
  purchasePrice: string
  sellPrice: string
}

function emptyItem(): DraftItem {
  const category = serviceCategories[0]
  const operation = operationsFor(category)[0]?.name ?? ""

  return {
    key: crypto.randomUUID(),
    category,
    actionType: "Výmena",
    operation,
    detail: "",
    partBrand: "",
    materialType: "",
    quantity: "",
    purchasePrice: "",
    sellPrice: "",
  }
}

function draftFromItem(item: ServiceItem): DraftItem {
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
  }
}

function itemName(item: DraftItem) {
  if (isCustomOperation(item.category, item.operation)) {
    return item.detail.trim()
  }

  return item.operation
}

export function RecordSheet({
  vehicleId,
  record,
  open,
  onOpenChange,
}: {
  vehicleId: string
  record?: ServiceRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { addRecord, updateRecord } = useWorkshop()
  const editing = Boolean(record)
  const [serviceDate, setServiceDate] = useState(todayISO())
  const [mileage, setMileage] = useState("")
  const [laborCost, setLaborCost] = useState("")
  const [nextServiceDate, setNextServiceDate] = useState("")
  const [nextServiceMileage, setNextServiceMileage] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }

    if (record) {
      setServiceDate(record.serviceDate)
      setMileage(String(record.mileage))
      setLaborCost(formatAmountInput(record.laborCost))
      setNextServiceDate(record.nextServiceDate ?? "")
      setNextServiceMileage(
        record.nextServiceMileage !== undefined ? String(record.nextServiceMileage) : ""
      )
      setNotes(record.mechanicNotes)
      setItems(record.items.length > 0 ? record.items.map(draftFromItem) : [emptyItem()])
      setError("")
      return
    }

    setServiceDate(todayISO())
    setMileage("")
    setLaborCost("")
    setNextServiceDate("")
    setNextServiceMileage("")
    setNotes("")
    setItems([emptyItem()])
    setError("")
  }, [open, record])

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsedMileage = Number(mileage.trim())
    const parsedLabor = parseAmount(laborCost)

    if (!serviceDate) {
      setError("Zadajte dátum servisu.")
      return
    }

    if (!Number.isInteger(parsedMileage) || parsedMileage < 0) {
      setError("Stav tachometra zadajte ako celé číslo.")
      return
    }

    if (parsedLabor === null) {
      setError("Cenu práce zadajte ako číslo od 0.")
      return
    }

    const nextMileageRaw = nextServiceMileage.trim()
    const parsedNextMileage = nextMileageRaw ? Number(nextMileageRaw) : undefined

    if (
      parsedNextMileage !== undefined &&
      (!Number.isInteger(parsedNextMileage) || parsedNextMileage < 0)
    ) {
      setError("Ďalší nájazd zadajte ako celé číslo, alebo pole nechajte prázdne.")
      return
    }

    const nextItems: ServiceItem[] = []

    for (const item of items) {
      const partName = itemName(item)
      const hasContent =
        partName.length > 0 ||
        item.purchasePrice.trim().length > 0 ||
        item.sellPrice.trim().length > 0

      if (!hasContent) {
        continue
      }

      if (partName.length === 0) {
        setError("Doplňte náhradný diel, alebo riadok vymažte.")
        return
      }

      const purchasePrice = parseAmount(item.purchasePrice)
      const sellPrice = parseAmount(item.sellPrice)

      if (purchasePrice === null || sellPrice === null) {
        setError("Cenu dielu zadajte ako číslo od 0.")
        return
      }

      nextItems.push({
        id: item.key,
        category: item.category,
        actionType: item.actionType,
        partName,
        partBrand: item.partBrand.trim(),
        materialType: item.materialType.trim(),
        quantity: item.quantity.trim(),
        purchasePrice,
        sellPrice,
      })
    }

    const nextRecord: ServiceRecord = {
      id: record?.id ?? crypto.randomUUID(),
      vehicleId,
      serviceDate,
      mileage: parsedMileage,
      laborCost: parsedLabor,
      mechanicNotes: notes.trim(),
      nextServiceDate: nextServiceDate || undefined,
      nextServiceMileage: parsedNextMileage,
      items: nextItems,
    }

    if (record) {
      updateRecord(nextRecord)
    } else {
      addRecord(nextRecord)
    }

    window.setTimeout(() => onOpenChange(false), 0)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="h-full w-full gap-0 overflow-hidden border-neutral-200 bg-white p-0 text-black shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.04)] data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-3xl"
      >
        <form className="flex h-full flex-col" onSubmit={submit}>
          <SheetHeader className="border-b border-neutral-200 p-4">
            <SheetTitle className={typeTitle}>{editing ? "Upraviť záznam" : "Nový záznam"}</SheetTitle>
            <SheetDescription className={typeMeta}>
              Dátum, kilometre, úkony, značky, typ materiálu a množstvo. Ďalší servis je voliteľný.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label className={typeLabel} htmlFor="service-date">
                  Dátum
                </Label>
                <Input
                  id="service-date"
                  type="date"
                  className={fieldClass}
                  value={serviceDate}
                  onChange={(event) => setServiceDate(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className={typeLabel} htmlFor="mileage">
                  Stav tachometra
                </Label>
                <Input
                  id="mileage"
                  className={`${fieldClass} text-right tabular-nums`}
                  value={mileage}
                  onChange={(event) => setMileage(event.target.value)}
                  inputMode="numeric"
                  placeholder="km"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className={typeLabel} htmlFor="labor">
                  Práca (€)
                </Label>
                <Input
                  id="labor"
                  className={`${fieldClass} text-right tabular-nums`}
                  value={laborCost}
                  onChange={(event) => setLaborCost(event.target.value)}
                  inputMode="decimal"
                  placeholder="Napr. 0,00"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className={typeLabel} htmlFor="next-service-date">
                  Ďalší servis, dátum
                </Label>
                <Input
                  id="next-service-date"
                  type="date"
                  className={fieldClass}
                  value={nextServiceDate}
                  onChange={(event) => setNextServiceDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className={typeLabel} htmlFor="next-service-mileage">
                  Ďalší servis, km
                </Label>
                <Input
                  id="next-service-mileage"
                  className={`${fieldClass} text-right tabular-nums`}
                  value={nextServiceMileage}
                  onChange={(event) => setNextServiceMileage(event.target.value)}
                  inputMode="numeric"
                  placeholder="km"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="notes">
                Poznámka mechanika
              </Label>
              <Textarea
                id="notes"
                className={fieldClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Napr. Zistené závady, ďalší servis"
              />
            </div>

            <div className="flex flex-col gap-4">
              {items.map((item, index) => {
                const purchase = parseAmount(item.purchasePrice)
                const sell = parseAmount(item.sellPrice)
                const margin = purchase === null || sell === null ? null : sell - purchase

                return (
                  <div key={item.key} className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className={typeLabel}>Úkon {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className={quietButtonClass}
                        onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                      >
                        Odstrániť
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel}>Skupina</Label>
                        <Select
                          value={item.category}
                          onValueChange={(value) => {
                            if (!value) {
                              return
                            }

                            const category = value as ServiceCategory
                            const nextActions = actionsFor(category)
                            const nextOperation = operationsFor(category)[0]?.name ?? ""
                            updateItem(item.key, {
                              category,
                              operation: nextOperation,
                              detail: "",
                              actionType: nextActions.includes(item.actionType)
                                ? item.actionType
                                : nextActions[0],
                            })
                          }}
                        >
                          <SelectTrigger className={`${fieldClass} w-full`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border border-neutral-200 bg-white text-black">
                            {serviceCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel}>Náhradný diel</Label>
                        <Select
                          value={item.operation}
                          onValueChange={(value) => {
                            if (value) {
                              updateItem(item.key, { operation: value, detail: "" })
                            }
                          }}
                        >
                          <SelectTrigger className={`${fieldClass} w-full`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border border-neutral-200 bg-white text-black">
                            {operationsFor(item.category).map((operation) => (
                              <SelectItem key={operation.name} value={operation.name}>
                                {operation.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {isCustomOperation(item.category, item.operation) ? (
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`detail-${item.key}`}>
                          Názov dielu
                        </Label>
                        <Input
                          id={`detail-${item.key}`}
                          className={fieldClass}
                          value={item.detail}
                          onChange={(event) => updateItem(item.key, { detail: event.target.value })}
                        />
                      </div>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel}>Úkon</Label>
                        <Select
                          value={item.actionType}
                          onValueChange={(value) => {
                            if (value) {
                              updateItem(item.key, { actionType: value as ServiceActionType })
                            }
                          }}
                        >
                          <SelectTrigger className={`${fieldClass} w-full`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border border-neutral-200 bg-white text-black">
                            {actionsFor(item.category).map((action) => (
                              <SelectItem key={action} value={action}>
                                {action}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`brand-${item.key}`}>
                          Značka dielu
                        </Label>
                        <Input
                          id={`brand-${item.key}`}
                          className={fieldClass}
                          value={item.partBrand}
                          onChange={(event) => updateItem(item.key, { partBrand: event.target.value })}
                          placeholder="Napr. ATE, Mann, Castrol"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`material-${item.key}`}>
                          Typ materiálu
                        </Label>
                        <Input
                          id={`material-${item.key}`}
                          className={fieldClass}
                          value={item.materialType}
                          onChange={(event) => updateItem(item.key, { materialType: event.target.value })}
                          placeholder="Napr. 5W-30"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`quantity-${item.key}`}>
                          Množstvo
                        </Label>
                        <Input
                          id={`quantity-${item.key}`}
                          className={fieldClass}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                          placeholder="Napr. 5 l, 2 ks"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`buy-${item.key}`}>
                          Nákup
                        </Label>
                        <Input
                          id={`buy-${item.key}`}
                          className={`${fieldClass} text-right tabular-nums`}
                          value={item.purchasePrice}
                          onChange={(event) => updateItem(item.key, { purchasePrice: event.target.value })}
                          inputMode="decimal"
                          placeholder="Napr. 0,00"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={typeLabel} htmlFor={`sell-${item.key}`}>
                          Predaj
                        </Label>
                        <Input
                          id={`sell-${item.key}`}
                          className={`${fieldClass} text-right tabular-nums`}
                          value={item.sellPrice}
                          onChange={(event) => updateItem(item.key, { sellPrice: event.target.value })}
                          inputMode="decimal"
                          placeholder="Napr. 0,00"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className={typeLabel}>Marža</span>
                        <div
                          className={`flex h-8 items-center justify-end rounded-lg border border-neutral-200 bg-white px-2 ${
                            margin !== null && margin > 0
                              ? typeProfit
                              : margin !== null && margin < 0
                                ? typeNegative
                                : typeNumber
                          }`}
                        >
                          {margin === null ? "" : formatMoney(margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              className={`${quietButtonClass} self-start`}
              onClick={() => setItems((current) => [...current, emptyItem()])}
            >
              <Plus />
              Pridať úkon
            </Button>

            {error ? <p className={typeError}>{error}</p> : null}
          </div>

          <SheetFooter className="border-t border-neutral-200 p-4 sm:flex-row sm:justify-end">
            <Button type="button" className={quietButtonClass} onClick={() => onOpenChange(false)}>
              Zrušiť
            </Button>
            <Button type="submit" className={primaryButtonClass}>
              Uložiť záznam
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
