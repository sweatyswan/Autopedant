"use client"

import { useEffect, useState } from "react"
import { Bin, Check, Plus, X } from "@keyline-icons/react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  historyActionClass,
  historyChevronClass,
  historyIdentityCols,
  historyKmFieldClass,
  historyMoneyPaneClass,
  historySplitClass,
  noteBleedClass,
  itemGridEditor,
} from "@/components/workshop/record-layout"
import { RecordMoneyFields, RecordMoneyPortal } from "@/components/workshop/record-money"
import {
  fieldClass,
  insetClass,
  popoverSurfaceClass,
  selectPlaceholderClass,
  iconSize,
  primaryButtonClass,
  quietButtonClass,
  typeCaption,
  typeError,
} from "@/components/workshop/styles"
import { KmInput } from "@/components/workshop/km-input"
import { formatAmountInput, formatKmInput, todayISO } from "@/lib/format"
import { recordTotals } from "@/lib/finance"
import {
  commitRecordDraft,
  draftCategories,
  draftFromItem,
  draftMoney,
  emptyItem,
  type DraftItem,
} from "@/lib/record-draft"
import { actionsFor, isCustomOperation, operationsFor } from "@/lib/service-catalog"
import { serviceCategories, type ServiceActionType, type ServiceCategory, type ServiceRecord } from "@/lib/types"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

export type RecordDraftPreview = {
  serviceDate: string
  mileage: string
  categories: string
  labor: number
  margin: number
  billed: number
}

export const NEW_RECORD_ID = "new"

export function RecordEditor({
  vehicleId,
  record,
  onDraftChange,
  onClose,
}: {
  vehicleId: string
  record?: ServiceRecord | null
  onDraftChange?: (preview: RecordDraftPreview) => void
  onClose: () => void
}) {
  const { addRecord, updateRecord } = useWorkshop()
  const [serviceDate, setServiceDate] = useState(record?.serviceDate ?? todayISO())
  const [mileage, setMileage] = useState(record ? formatKmInput(record.mileage) : "")
  const [laborCost, setLaborCost] = useState(record ? formatAmountInput(record.laborCost) : "")
  const [materialEarnings, setMaterialEarnings] = useState(
    record ? formatAmountInput(record.materialEarnings ?? recordTotals(record).margin) : ""
  )
  const [billedAmount, setBilledAmount] = useState(record ? formatAmountInput(recordTotals(record).billed) : "")
  const [billedTouched, setBilledTouched] = useState(false)
  const [nextServiceDate, setNextServiceDate] = useState(record?.nextServiceDate ?? "")
  const [nextServiceMileage, setNextServiceMileage] = useState(
    record?.nextServiceMileage !== undefined ? formatKmInput(record.nextServiceMileage) : ""
  )
  const [notes, setNotes] = useState(record?.mechanicNotes ?? "")
  const [items, setItems] = useState<DraftItem[]>(
    record?.items.length ? record.items.map(draftFromItem) : [emptyItem()]
  )
  const [error, setError] = useState("")
  const money = draftMoney(items, laborCost, materialEarnings, billedAmount)

  function fillBilled(nextLabor: string, nextMaterial: string) {
    if (billedTouched) {
      return
    }

    setBilledAmount(formatAmountInput(draftMoney(items, nextLabor, nextMaterial).computedBilled))
  }

  useEffect(() => {
    onDraftChange?.({
      serviceDate,
      mileage,
      categories: draftCategories(items),
      labor: money.labor,
      margin: money.margin,
      billed: money.billed,
    })
  }, [serviceDate, mileage, items, money.labor, money.margin, money.billed, onDraftChange])

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = commitRecordDraft({
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
    })

    if ("error" in result) {
      setError(result.error)
      return
    }

    if (record) {
      updateRecord(result.record)
    } else {
      addRecord(result.record)
    }

    onClose()
  }

  return (
    <form className="flex flex-col gap-4 pb-4 pt-2 print:hidden" onSubmit={submit}>
      <div className="flex items-start gap-3">
        <div className={cn(historySplitClass, "flex-col sm:flex-row sm:items-stretch")}>
          <div className={cn(historyIdentityCols, "sm:items-stretch")}>
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <Label className={typeCaption} htmlFor="inline-service-date">
                Dátum
              </Label>
              <Input
                id="inline-service-date"
                type="date"
                className={fieldClass}
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                autoFocus
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <Label className={typeCaption} htmlFor="inline-mileage">
                Stav tachometra
              </Label>
              <div className={historyKmFieldClass}>
                <KmInput
                  id="inline-mileage"
                  className={`${fieldClass} text-right`}
                  value={mileage}
                  onValueChange={setMileage}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <Label className={typeCaption} htmlFor="inline-next-date">
                Ďalší servis
              </Label>
              <Input
                id="inline-next-date"
                type="date"
                className={fieldClass}
                value={nextServiceDate}
                onChange={(event) => setNextServiceDate(event.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <Label className={cn(typeCaption, "invisible")} htmlFor="inline-next-mileage">
                km
              </Label>
              <div className={historyKmFieldClass}>
                <KmInput
                  id="inline-next-mileage"
                  className={`${fieldClass} text-right`}
                  value={nextServiceMileage}
                  onValueChange={setNextServiceMileage}
                />
              </div>
            </div>
          </div>
          <div className={historyMoneyPaneClass}>
            <div className="hidden sm:block" />
            <div className="relative min-h-0 min-w-0 sm:col-span-2">
              <div className={cn("flex h-full min-h-0 flex-col gap-1 text-left", noteBleedClass)}>
                <Label className={typeCaption} htmlFor="inline-notes">
                  Poznámka mechanika
                </Label>
                <Textarea
                  id="inline-notes"
                  className={cn(fieldClass, "h-full min-h-16 flex-1 field-sizing-fixed")}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Napr. Zistené závady, ďalší servis"
                />
              </div>
            </div>
          </div>
        </div>
        <div className={`${historyActionClass} hidden sm:block`} aria-hidden />
        <div className={`${historyChevronClass} hidden sm:block`} aria-hidden />
      </div>

      <div className={cn("overflow-hidden rounded-lg border border-neutral-200 print:bg-white", insetClass)}>
        <div className={cn("hidden border-b border-neutral-200 px-4 py-2 sm:grid", itemGridEditor)}>
          <div className={typeCaption}>Úkon</div>
          <div className={typeCaption}>Náhradný diel</div>
          <div className={typeCaption}>Typ materiálu</div>
          <div className={typeCaption}>Množstvo</div>
          <div className={typeCaption}>Značka</div>
          <div />
        </div>
        <div className="divide-y divide-neutral-200">
          {items.map((item) => (
            <div key={item.key} className={cn("px-4 py-3", itemGridEditor)}>
              <div className="min-w-0 text-left">
                <div className={`${typeCaption} sm:hidden`}>Úkon</div>
                <Select
                  value={item.actionType || null}
                  onValueChange={(value) => {
                    if (value) {
                      updateItem(item.key, { actionType: value as ServiceActionType })
                    }
                  }}
                >
                  <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
                    <SelectValue placeholder="Úkon" />
                  </SelectTrigger>
                  <SelectContent className={popoverSurfaceClass}>
                    {actionsFor(item.category).map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <div className={`${typeCaption} sm:hidden`}>Kategória</div>
                <Select
                  value={item.category || null}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    const category = value as ServiceCategory
                    const nextActions = actionsFor(category)
                    updateItem(item.key, {
                      category,
                      operation: "",
                      detail: "",
                      actionType: nextActions.includes(item.actionType as ServiceActionType)
                        ? item.actionType
                        : "",
                    })
                  }}
                >
                  <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
                    <SelectValue placeholder="Kategória" />
                  </SelectTrigger>
                  <SelectContent className={popoverSurfaceClass}>
                    {serviceCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className={`${typeCaption} sm:hidden`}>Náhradný diel</div>
                <Select
                  value={item.operation || null}
                  disabled={!item.category}
                  onValueChange={(value) => {
                    if (value) {
                      updateItem(item.key, { operation: value, detail: "" })
                    }
                  }}
                >
                  <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
                    <SelectValue placeholder="Náhradný diel" />
                  </SelectTrigger>
                  <SelectContent className={popoverSurfaceClass}>
                    {operationsFor(item.category).map((operation) => (
                      <SelectItem key={operation.name} value={operation.name}>
                        {operation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustomOperation(item.category, item.operation) ? (
                  <Input
                    className={fieldClass}
                    value={item.detail}
                    onChange={(event) => updateItem(item.key, { detail: event.target.value })}
                    placeholder="Názov dielu"
                  />
                ) : null}
              </div>
              <div className="min-w-0 text-left">
                <div className={`${typeCaption} sm:hidden`}>Typ materiálu</div>
                <Input
                  className={fieldClass}
                  value={item.materialType}
                  onChange={(event) => updateItem(item.key, { materialType: event.target.value })}
                  placeholder="Napr. 5W-30"
                />
              </div>
              <div className="min-w-0 text-left">
                <div className={`${typeCaption} sm:hidden`}>Množstvo</div>
                <Input
                  className={fieldClass}
                  value={item.quantity}
                  onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                  placeholder="Napr. 5 l, 2 ks"
                />
              </div>
              <div className="min-w-0 text-left">
                <div className={`${typeCaption} sm:hidden`}>Značka</div>
                <Input
                  className={fieldClass}
                  value={item.partBrand}
                  onChange={(event) => updateItem(item.key, { partBrand: event.target.value })}
                  placeholder="Napr. ATE"
                />
              </div>
              <div className="flex items-start justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className={`${quietButtonClass} px-2`}
                  onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                >
                  <Bin size={iconSize} />
                  <span className="sm:hidden">Odstrániť</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <RecordMoneyPortal>
        <RecordMoneyFields
          laborCost={laborCost}
          materialEarnings={materialEarnings}
          billedAmount={billedAmount}
          labor={money.labor}
          margin={money.margin}
          onLaborChange={(value) => {
            setLaborCost(value)
            fillBilled(value, materialEarnings)
          }}
          onMaterialChange={(value) => {
            setMaterialEarnings(value)
            fillBilled(laborCost, value)
          }}
          onBilledChange={(value) => {
            setBilledTouched(value.trim() !== "")
            setBilledAmount(value)
          }}
        />
      </RecordMoneyPortal>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" className={quietButtonClass} onClick={() => setItems((current) => [...current, emptyItem()])}>
          Pridať úkon
          <Plus size={iconSize} />
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {error ? <p className={typeError}>{error}</p> : null}
          <Button type="button" className={quietButtonClass} onClick={onClose}>
            Zrušiť
            <X size={iconSize} />
          </Button>
          <Button type="submit" className={primaryButtonClass}>
            Uložiť záznam
            <Check size={iconSize} />
          </Button>
        </div>
      </div>
    </form>
  )
}
