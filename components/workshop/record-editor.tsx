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
  diagnosticItemGridEditor,
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
  typeDanger,
  typeError,
} from "@/components/workshop/styles"
import { DateField } from "@/components/workshop/date-field"
import { DiagnosticReportField } from "@/components/workshop/diagnostic-report"
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
import { actionsFor, diagnosticUnits, isCustomOperation, isDiagnosticAction, operationsFor } from "@/lib/service-catalog"
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
            <DateField
              id="inline-service-date"
              label="Dátum"
              value={serviceDate}
              onChange={setServiceDate}
              autoFocus
            />
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
            <DateField
              id="inline-next-date"
              label="Ďalší servis"
              value={nextServiceDate}
              onChange={setNextServiceDate}
              allowClear
            />
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
        <div className="divide-y divide-neutral-200">
          {items.map((item) => (
            <ItemEditorRow
              key={item.key}
              item={item}
              onChange={(patch) => updateItem(item.key, patch)}
              onRemove={() => setItems((current) => current.filter((row) => row.key !== item.key))}
            />
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

function ItemEditorRow({
  item,
  onChange,
  onRemove,
}: {
  item: DraftItem
  onChange: (patch: Partial<DraftItem>) => void
  onRemove: () => void
}) {
  const diagnostic = isDiagnosticAction(item.actionType)

  function chooseAction(value: string | null) {
    if (!value) {
      return
    }

    const action = value as ServiceActionType
    if (isDiagnosticAction(action)) {
      onChange({
        actionType: action,
        category: "Ostatné práce a diely",
        operation: "",
        detail: "",
        partBrand: "",
        materialType: "",
        quantity: "",
        purchasePrice: "",
        sellPrice: "",
        diagnosticResolved: diagnostic ? item.diagnosticResolved : false,
      })
      return
    }

    onChange({
      actionType: action,
      category: diagnostic ? "" : item.category,
      diagnosticScope: "",
      diagnosticUnit: "",
      diagnosticNote: "",
      diagnosticResolved: false,
      diagnosticReportId: "",
      diagnosticReportName: "",
      diagnosticReportPath: "",
    })
  }

  return (
    <div className="px-4 py-3">
      <div className={cn(diagnostic ? diagnosticItemGridEditor : itemGridEditor)}>
        <div className="flex min-w-0 flex-col gap-1 text-left">
          <div className={typeCaption}>Úkon</div>
          <Select value={item.actionType || null} onValueChange={chooseAction}>
            <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
              <SelectValue placeholder="Zvoľte úkon" />
            </SelectTrigger>
            <SelectContent className={popoverSurfaceClass}>
              {actionsFor(diagnostic ? "" : item.category).map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {diagnostic ? (
          <DiagnosticFields item={item} onChange={onChange} />
        ) : (
          <PartFields item={item} onChange={onChange} />
        )}
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className={cn(typeCaption, "invisible")} aria-hidden>
            Odstrániť
          </div>
          <Button
            type="button"
            className={cn(quietButtonClass, typeDanger, "px-2")}
            aria-label="Odstrániť"
            onClick={onRemove}
          >
            <Bin size={iconSize} />
          </Button>
        </div>
      </div>
      {diagnostic ? <DiagnosticReportField item={item} onChange={onChange} /> : null}
    </div>
  )
}

function DiagnosticFields({
  item,
  onChange,
}: {
  item: DraftItem
  onChange: (patch: Partial<DraftItem>) => void
}) {
  const unitReady = item.diagnosticScope === "jednotka"

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Rozsah</div>
        <Select
          value={
            item.diagnosticScope === "komplexna"
              ? "Komplexná diagnostika"
              : item.diagnosticScope === "jednotka"
                ? "Konkrétna jednotka"
                : null
          }
          onValueChange={(value) => {
            const scope = value === "Komplexná diagnostika" ? "komplexna" : value === "Konkrétna jednotka" ? "jednotka" : ""
            if (!scope) {
              return
            }

            onChange({
              diagnosticScope: scope,
              diagnosticUnit: scope === "komplexna" ? "" : item.diagnosticUnit,
            })
          }}
        >
          <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
            <SelectValue placeholder="Zvoľte rozsah" />
          </SelectTrigger>
          <SelectContent className={popoverSurfaceClass}>
            <SelectItem value="Komplexná diagnostika">Komplexná diagnostika</SelectItem>
            <SelectItem value="Konkrétna jednotka">Konkrétna jednotka</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Jednotka</div>
        {item.diagnosticScope === "komplexna" ? (
          <Select value="Všetky jednotky">
            <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={popoverSurfaceClass}>
              <SelectItem value="Všetky jednotky">Všetky jednotky</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={item.diagnosticUnit || null}
            disabled={!unitReady}
            onValueChange={(value) => {
              if (value) {
                onChange({ diagnosticUnit: value })
              }
            }}
          >
            <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
              <SelectValue placeholder={unitReady ? "Zvoľte jednotku" : "Najprv zvoľte rozsah"} />
            </SelectTrigger>
            <SelectContent className={popoverSurfaceClass}>
              {diagnosticUnits.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Poznámka</div>
        <Input
          className={fieldClass}
          value={item.diagnosticNote}
          onChange={(event) => onChange({ diagnosticNote: event.target.value })}
          placeholder="Napr. chybový kód"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Stav</div>
        <Select
          value={item.diagnosticResolved ? "Vyriešené" : "Nevyriešené"}
          onValueChange={(value) => onChange({ diagnosticResolved: value === "Vyriešené" })}
        >
          <SelectTrigger className={cn(fieldClass, "w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={popoverSurfaceClass}>
            <SelectItem value="Nevyriešené">Nevyriešené</SelectItem>
            <SelectItem value="Vyriešené">Vyriešené</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

function PartFields({
  item,
  onChange,
}: {
  item: DraftItem
  onChange: (patch: Partial<DraftItem>) => void
}) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2 text-left">
        <div className={typeCaption}>Kategória</div>
        <Select
          value={item.category || null}
          disabled={!item.actionType}
          onValueChange={(value) => {
            if (!value) {
              return
            }

            const category = value as ServiceCategory
            const nextActions = actionsFor(category)
            onChange({
              category,
              operation: "",
              detail: "",
              actionType: nextActions.includes(item.actionType as ServiceActionType) ? item.actionType : "",
            })
          }}
        >
          <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
            <SelectValue placeholder={item.actionType ? "Zvoľte kategóriu" : "Najprv zvoľte úkon"} />
          </SelectTrigger>
          <SelectContent className={popoverSurfaceClass}>
            {serviceCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className={typeCaption}>Náhradný diel</div>
        <Select
          value={item.operation || null}
          disabled={!item.category}
          onValueChange={(value) => {
            if (value) {
              onChange({ operation: value, detail: "" })
            }
          }}
        >
          <SelectTrigger className={cn(fieldClass, selectPlaceholderClass, "w-full")}>
            <SelectValue placeholder={item.category ? "Zvoľte náhradný diel" : "Najprv zvoľte kategóriu"} />
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
            onChange={(event) => onChange({ detail: event.target.value })}
            placeholder="Zadajte názov dielu"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Typ materiálu</div>
        <Input
          className={fieldClass}
          value={item.materialType}
          disabled={!item.operation}
          onChange={(event) => onChange({ materialType: event.target.value })}
          placeholder="Napr. originálny diel"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Množstvo</div>
        <Input
          className={fieldClass}
          value={item.quantity}
          disabled={!item.operation}
          onChange={(event) => onChange({ quantity: event.target.value })}
          placeholder="Napr. 5 l, 2 ks"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <div className={typeCaption}>Značka</div>
        <Input
          className={fieldClass}
          value={item.partBrand}
          disabled={!item.operation}
          onChange={(event) => onChange({ partBrand: event.target.value })}
          placeholder="Napr. ATE"
        />
      </div>
    </>
  )
}
