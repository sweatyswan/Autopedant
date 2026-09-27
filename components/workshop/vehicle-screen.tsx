"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Bin, FileArrowDown, Pen, Plus } from "@keyline-icons/react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ActionBadge } from "@/components/workshop/action-badge"
import { DiagnosticReportView } from "@/components/workshop/diagnostic-report"
import { AppHeader } from "@/components/workshop/app-header"
import { VehicleDialog } from "@/components/workshop/vehicle-dialog"
import { NEW_RECORD_ID, RecordEditor, type RecordDraftPreview } from "@/components/workshop/record-editor"
import {
  historyActionClass,
  historyChevronClass,
  diagnosticItemGrid,
  historyIdentityCols,
  historyIdentityColsCustomer,
  historySplitClass,
  itemGrid,
  itemHeaderClass,
  noteToLaborClass,
  totalsGrid,
} from "@/components/workshop/record-layout"
import {
  RecordChromeContext,
  RecordMoneyDisplay,
  useRecordChrome,
} from "@/components/workshop/record-money"
import {
  canvasClass,
  iconSize,
  insetClass,
  primaryButtonClass,
  quietButtonClass,
  rowHoverClass,
  rowOpenClass,
  rowPanelClass,
  surfaceClass,
  accentBarClass,
  typeBody,
  typeCaption,
  typeDanger,
  typeDash,
  typeDisplay,
  typeLabel,
  typeMeta,
  typeTabular,
  typeTitle,
  typeTone,
} from "@/components/workshop/styles"
import { formatDate, formatKm, formatMoney, formatNextService, formatPlate, formatVehicleSpec, parseKm } from "@/lib/format"
import { recordTotals, type MoneyTotals } from "@/lib/finance"
import { downloadHistoryPdf, downloadVisitPdf } from "@/lib/visit-pdf"
import { latestOilRecord, latestOilUpcoming } from "@/lib/list-query"
import { diagnosticScopeText, diagnosticStatusText, isDiagnosticAction } from "@/lib/service-catalog"
import { serviceCategories, type Customer, type ServiceRecord, type Vehicle } from "@/lib/types"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

const identityGrid = "grid grid-cols-1 gap-4 sm:grid-cols-2"

const factsGrid = "grid grid-cols-2 gap-4 sm:grid-cols-5"

export function VehicleScreen() {
  const searchParams = useSearchParams()
  const vehicleId = searchParams.get("id")
  const { customers, vehicles, records, deleteRecord } = useWorkshop()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openRecords, setOpenRecords] = useState<string[]>([])
  const [draftPreview, setDraftPreview] = useState<RecordDraftPreview | null>(null)
  const [customerFacing, setCustomerFacing] = useState(0)
  const [savingHistory, setSavingHistory] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const hideMoney = customerFacing > 0
  const bumpCustomerFacing = useCallback((on: boolean) => {
    setCustomerFacing((count) => count + (on ? 1 : -1))
  }, [])
  const vehicle = vehicles.find((item) => item.id === vehicleId)
  const customer = customers.find((item) => item.id === vehicle?.customerId)
  const history = records
    .filter((record) => record.vehicleId === vehicle?.id)
    .sort((left, right) => right.serviceDate.localeCompare(left.serviceDate) || right.mileage - left.mileage)

  if (!vehicle || !customer) {
    return (
      <div className={cn("min-h-svh text-black", canvasClass)}>
        <AppHeader />
        <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
          <p className={typeBody}>Vozidlo sa v evidencii nenašlo.</p>
          <Button className={quietButtonClass} nativeButton={false} render={<Link href="/" />}>
            Späť na zoznam
            <ArrowLeft size={iconSize} />
          </Button>
        </main>
      </div>
    )
  }

  const lastVisit = history[0]
  const firstVisit = history[history.length - 1]
  const lastOil = latestOilRecord(history)
  const nextOil = latestOilUpcoming(history)
  const firstVisitStamp = firstVisit
    ? `${formatDate(firstVisit.serviceDate)} · ${formatKm(firstVisit.mileage)}`
    : "–"
  const mileage = lastVisit ? formatKm(lastVisit.mileage) : "–"

  function startNewRecord() {
    setEditingId(NEW_RECORD_ID)
    setDraftPreview(null)
    setOpenRecords((current) => [NEW_RECORD_ID, ...current.filter((id) => id !== NEW_RECORD_ID)])
  }

  return (
    <div className={cn("min-h-svh text-black", canvasClass)}>
      <AppHeader
        actions={
          <Button className={quietButtonClass} nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft size={iconSize} />
            Späť
          </Button>
        }
      />
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <section className={cn("flex flex-col rounded-lg p-3 print:hidden", surfaceClass)}>
          <div className={identityGrid}>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Vozidlo</div>
              <div className={typeDisplay}>{formatPlate(vehicle.licensePlate)}</div>
              <div className={typeBody}>{formatVehicleSpec(vehicle)}</div>
              <div className={cn(typeMeta, "tabular-nums", !vehicle.vin && typeDash)}>{vehicle.vin || "–"}</div>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-4 text-left">
              <div className="min-w-0">
              <div className={typeCaption}>Zákazník</div>
              <div className={cn(typeTitle, !customer.name && typeDash)}>{customer.name || "–"}</div>
              {customer.phone ? (
                <a className={cn(typeMeta, "block")} href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              ) : (
                <div className={cn(typeMeta, typeDash)}>–</div>
              )}
              <div className={cn(typeMeta, !customer.email && typeDash)}>{customer.email || "–"}</div>
              </div>
              <Button
                type="button"
                className={cn(quietButtonClass, "print:hidden")}
                onClick={() => setVehicleOpen(true)}
              >
                Upraviť
                <Pen size={iconSize} />
              </Button>
            </div>
          </div>
          <div className={cn(factsGrid, "mt-3 border-t border-neutral-200 pt-3")}>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Posledný servis</div>
              <div className={cn(typeMeta, !lastOil && typeDash)}>
                {lastOil ? `${formatDate(lastOil.serviceDate)} · ${formatKm(lastOil.mileage)}` : "–"}
              </div>
            </div>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Ďalší servis</div>
              <div className={cn(typeMeta, !nextOil && typeDash)}>{nextOil ? formatNextService(nextOil) : "–"}</div>
            </div>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Servisné zákroky</div>
              <div className={cn(typeMeta, typeTabular)}>{history.length}</div>
            </div>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Prvá evidencia</div>
              <div className={cn(typeMeta, !firstVisit && typeDash)}>
                {firstVisitStamp}
              </div>
            </div>
            <div className="min-w-0 text-left">
              <div className={typeCaption}>Najazdené</div>
              <div className={cn(typeMeta, typeTabular, mileage === "–" && typeDash)}>{mileage}</div>
            </div>
          </div>
        </section>

        <div className={cn("overflow-hidden rounded-lg print:overflow-visible print:border-0", surfaceClass)}>
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2.5">
            <h2 className={typeTitle}>Servisné zákroky</h2>
            {editingId ? null : (
              <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
                {history.length ? (
                  <Button
                    type="button"
                    className={quietButtonClass}
                    disabled={savingHistory}
                    onClick={async () => {
                      if (savingHistory) {
                        return
                      }
                      setSavingHistory(true)
                      try {
                        await downloadHistoryPdf({
                          records: history,
                          vehicle,
                          customer,
                        })
                      } finally {
                        setSavingHistory(false)
                      }
                    }}
                  >
                    Uložiť históriu
                    <FileArrowDown size={iconSize} />
                  </Button>
                ) : null}
                <Button className={primaryButtonClass} onClick={startNewRecord}>
                  Nový záznam
                  <Plus size={iconSize} />
                </Button>
              </div>
            )}
          </div>
          {history.length === 0 && editingId !== NEW_RECORD_ID ? (
            <p className={cn(typeBody, "p-4")}>Pre toto vozidlo zatiaľ nie je žiadny servisný záznam.</p>
          ) : (
            <Accordion
              className="print:overflow-visible"
              multiple
              value={openRecords}
              onValueChange={(next) => {
                if (editingId && !next.includes(editingId)) {
                  setEditingId(null)
                  setDraftPreview(null)
                }
                setOpenRecords(next)
              }}
            >
              {editingId === NEW_RECORD_ID ? (
                <HistoryItem
                  id={NEW_RECORD_ID}
                  dateLabel={draftPreview?.serviceDate ? formatDate(draftPreview.serviceDate) : "Nový záznam"}
                  mileageLabel={
                    draftPreview && parseKm(draftPreview.mileage) !== null
                      ? formatKm(parseKm(draftPreview.mileage) as number)
                      : "–"
                  }
                  categories={draftPreview?.categories ?? "–"}
                  labor={draftPreview?.labor ?? 0}
                  margin={draftPreview?.margin ?? 0}
                  billed={draftPreview?.billed ?? 0}
                  editing
                  hideMoney={hideMoney}
                  onCustomerFacing={bumpCustomerFacing}
                >
                  <RecordEditor
                    vehicleId={vehicle.id}
                    onDraftChange={setDraftPreview}
                    onClose={() => {
                      setEditingId(null)
                      setDraftPreview(null)
                      setOpenRecords((current) => current.filter((id) => id !== NEW_RECORD_ID))
                    }}
                  />
                </HistoryItem>
              ) : null}
              {history.map((record) => {
                const money = recordTotals(record)
                const editing = editingId === record.id
                const preview = editing ? draftPreview : null
                return (
                  <HistoryItem
                    key={record.id}
                    id={record.id}
                    dateLabel={formatDate(preview?.serviceDate || record.serviceDate)}
                    mileageLabel={
                      preview
                        ? parseKm(preview.mileage) !== null
                          ? formatKm(parseKm(preview.mileage) as number)
                          : "–"
                        : formatKm(record.mileage)
                    }
                    categories={preview?.categories ?? recordCategories(record)}
                    labor={preview?.labor ?? money.labor}
                    margin={preview?.margin ?? money.margin}
                    billed={preview?.billed ?? money.billed}
                    editing={editing}
                    hideMoney={hideMoney}
                    onCustomerFacing={bumpCustomerFacing}
                    onEdit={() => {
                      setEditingId(record.id)
                      setDraftPreview(null)
                      setOpenRecords((current) => [record.id, ...current.filter((id) => id !== record.id)])
                    }}
                    onDelete={() => {
                      deleteRecord(record.id)
                      setEditingId((current) => (current === record.id ? null : current))
                      setDraftPreview(null)
                      setOpenRecords((current) => current.filter((id) => id !== record.id))
                    }}
                  >
                    {editing ? (
                      <RecordEditor
                        key={record.id}
                        vehicleId={vehicle.id}
                        record={record}
                        onDraftChange={setDraftPreview}
                        onClose={() => {
                          setEditingId(null)
                          setDraftPreview(null)
                        }}
                      />
                    ) : (
                      <RecordDetails
                        record={record}
                        vehicle={vehicle}
                        customer={customer}
                        money={money}
                      />
                    )}
                  </HistoryItem>
                )
              })}
            </Accordion>
          )}
        </div>
      </main>
      <VehicleDialog open={vehicleOpen} vehicle={vehicle} customer={customer} onOpenChange={setVehicleOpen} />
    </div>
  )
}

function HistoryItem({
  id,
  dateLabel,
  mileageLabel,
  categories,
  labor,
  margin,
  billed,
  editing,
  hideMoney,
  onCustomerFacing,
  onEdit,
  onDelete,
  children,
}: {
  id: string
  dateLabel: string
  mileageLabel: string
  categories: string
  labor: number
  margin: number
  billed: number
  editing?: boolean
  hideMoney?: boolean
  onCustomerFacing?: (on: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
  children: ReactNode
}) {
  const [customerView, setCustomerView] = useState(false)
  const [moneySlot, setMoneySlot] = useState<HTMLElement | null>(null)
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)")
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (editing) {
      setCustomerView(false)
    }
  }, [editing])

  useEffect(() => {
    if (!customerView) {
      return
    }

    onCustomerFacing?.(true)
    return () => onCustomerFacing?.(false)
  }, [customerView, onCustomerFacing])

  return (
    <RecordChromeContext.Provider value={{ moneySlot, customerView, setCustomerView }}>
      <AccordionItem
        value={id}
        id={`record-${id}`}
        data-record=""
        className={cn("border-b border-neutral-200 print:border-0 print:bg-transparent", rowOpenClass)}
      >
        <div
          className={cn(
            "relative flex h-[5.25rem] items-center overflow-hidden px-4 print:hidden",
            rowHoverClass,
            rowOpenClass
          )}
        >
          <AccordionTrigger
            headerClassName="min-w-0 w-full"
            className="w-full items-center justify-start gap-3 px-0 text-black hover:bg-transparent hover:no-underline **:data-[slot=accordion-trigger-icon]:ml-0"
          >
            <span className={cn(historySplitClass, "flex-col sm:flex-row sm:items-center")}>
              <span className={customerView ? historyIdentityColsCustomer : historyIdentityCols}>
                <span className="min-w-0 text-left">
                  <span className={`${typeCaption} sm:hidden`}>Dátum</span>
                  <span className={`${typeTitle} block whitespace-nowrap`}>{dateLabel}</span>
                  <span className={cn(typeMeta, "block whitespace-nowrap tabular-nums", mileageLabel === "–" && typeDash)}>
                    {mileageLabel}
                  </span>
                </span>
                <span className="min-w-0 text-left">
                  <span className={typeCaption}>Kategória</span>
                  <span className={cn(typeBody, "block truncate", categories === "–" && typeDash)}>
                    {categories}
                  </span>
                </span>
              </span>
              {hideMoney || customerView ? null : (
                <span className="min-w-0 sm:flex-[2.55_1_0%]">
                  {editing ? null : (
                    <RecordMoneyDisplay labor={labor} margin={margin} billed={billed} />
                  )}
                </span>
              )}
            </span>
            <span className={`${historyActionClass} hidden sm:block`} aria-hidden />
          </AccordionTrigger>
          {editing && !customerView && desktop ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center gap-3 px-4">
              <div className={cn(historySplitClass, "items-center")}>
                <div className="min-w-0 sm:flex-[1.8_1_0%]" aria-hidden />
                <div
                  ref={setMoneySlot}
                  className="pointer-events-auto min-w-0 sm:flex-[2.55_1_0%]"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              <div className={`${historyActionClass} hidden sm:block`} aria-hidden />
              <div className={`${historyChevronClass} hidden sm:block`} aria-hidden />
            </div>
          ) : null}
          {onEdit && !editing ? (
            <div className="absolute top-1/2 right-11 z-10 flex -translate-y-1/2 items-center gap-2">
              {onDelete ? <DeleteVisitButton dateLabel={dateLabel} onDelete={onDelete} compact /> : null}
              <div className={historyActionClass}>
                <Button type="button" className={`${quietButtonClass} w-full`} onClick={onEdit}>
                  Upraviť
                  <Pen size={iconSize} />
                </Button>
              </div>
            </div>
          ) : (
            <div className={`absolute top-1/2 right-11 -translate-y-1/2 ${historyActionClass}`} />
          )}
        </div>
        {editing && !customerView && !desktop ? (
          <div className="px-4 pb-2 print:hidden" ref={setMoneySlot} />
        ) : null}
        <AccordionContent className={cn("px-4 print:bg-transparent", rowPanelClass)}>{children}</AccordionContent>
      </AccordionItem>
    </RecordChromeContext.Provider>
  )
}

function RecordDetails({
  record,
  vehicle,
  customer,
  money,
}: {
  record: ServiceRecord
  vehicle: Vehicle
  customer: Customer
  money: MoneyTotals
}) {
  const { customerView, setCustomerView } = useRecordChrome()
  const [savingPdf, setSavingPdf] = useState(false)
  const nextService = formatNextService(record)
  const hasNextService = Boolean(nextService)
  const mechanicNote = record.mechanicNotes.trim()

  async function saveVisitPdf() {
    if (savingPdf) {
      return
    }

    setSavingPdf(true)
    try {
      await downloadVisitPdf({ record, vehicle, customer, customerView })
    } finally {
      setSavingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4 pt-4">
      <div className="hidden flex-col gap-3 border-b border-neutral-200 pb-4 print:flex">
        <div className={typeCaption}>Autopedant</div>
        <div className={typeDisplay}>Servisný zákrok</div>
        <div className={`${typeTitle} tabular-nums`}>
          {formatDate(record.serviceDate)} · {formatKm(record.mileage)}
        </div>
        <div className="min-w-0 text-left">
          <div className={typeTitle}>{formatPlate(vehicle.licensePlate)}</div>
          <div className={typeBody}>{formatVehicleSpec(vehicle)}</div>
          <div className={cn(typeMeta, "tabular-nums", !vehicle.vin && typeDash)}>{vehicle.vin || "–"}</div>
        </div>
        <div className="min-w-0 text-left">
          <div className={cn(typeTitle, !customer.name && typeDash)}>{customer.name || "–"}</div>
          <div className={cn(typeMeta, !customer.phone && typeDash)}>{customer.phone || "–"}</div>
          <div className={cn(typeMeta, !customer.email && typeDash)}>{customer.email || "–"}</div>
        </div>
      </div>

      {hasNextService || mechanicNote ? (
        <div className="flex items-start gap-3">
          <div className={cn(historySplitClass, "flex-col sm:flex-row sm:items-start")}>
            <div className={cn(customerView ? historyIdentityColsCustomer : historyIdentityCols, "sm:items-start")}>
              {hasNextService ? (
                <div className="flex min-w-0 flex-col gap-1 text-left">
                  <div className={typeCaption}>Ďalší servis</div>
                  <div className={`${typeMeta} tabular-nums`}>{nextService}</div>
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              {mechanicNote ? (
                <div className="relative min-w-0 overflow-visible">
                  <div
                    className={cn(
                      "flex flex-col gap-1 text-left",
                      !customerView && noteToLaborClass
                    )}
                  >
                    <div className={typeCaption}>Poznámka mechanika</div>
                    <p className={typeBody}>{mechanicNote}</p>
                  </div>
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>
            {customerView ? null : <div className="hidden sm:block sm:flex-[2.55_1_0%]" aria-hidden />}
          </div>
          <div className={`${historyActionClass} hidden sm:block print:hidden`} aria-hidden />
          <div className={`${historyChevronClass} hidden sm:block print:hidden`} aria-hidden />
        </div>
      ) : null}

      {record.items.length > 0 ? (
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-neutral-200 print:bg-white",
            insetClass,
            customerView && accentBarClass
          )}
        >
          {record.items.some((item) => !isDiagnosticAction(item.actionType)) ? (
            <div className={cn(itemHeaderClass, itemGrid)}>
              <div className={typeCaption}>Úkon</div>
              <div className={typeCaption}>Náhradný diel</div>
              <div className={typeCaption}>Typ materiálu</div>
              <div className={typeCaption}>Množstvo</div>
              <div className={typeCaption}>Značka</div>
            </div>
          ) : null}
          <div className="divide-y divide-neutral-200">
            {record.items.map((item) => {
              if (isDiagnosticAction(item.actionType)) {
                const scope = diagnosticScopeText(item)
                const note = item.diagnosticNote?.trim() || ""
                const status = diagnosticStatusText(item.diagnosticResolved)

                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className={diagnosticItemGrid}>
                      <div>
                        <div className={typeCaption}>Úkon</div>
                        <ActionBadge action={item.actionType} />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className={typeCaption}>Rozsah</div>
                        <div className={cn(typeBody, scope === "–" && typeDash)}>{scope}</div>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className={typeCaption}>Poznámka</div>
                        <div className={cn(typeBody, !note && typeDash)}>{note || "–"}</div>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className={typeCaption}>Stav</div>
                        <div className={typeBody}>{status}</div>
                      </div>
                    </div>
                    <DiagnosticReportView
                      report={{
                        id: item.diagnosticReportId,
                        name: item.diagnosticReportName,
                        path: item.diagnosticReportPath,
                      }}
                    />
                  </div>
                )
              }

              return (
                <div
                  key={item.id}
                  className={cn("px-4 py-3", itemGrid)}
                >
                  <div>
                    <div className={`${typeCaption} sm:hidden`}>Úkon</div>
                    <ActionBadge action={item.actionType} />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className={`${typeCaption} sm:hidden`}>Náhradný diel</div>
                    <div className={cn(typeBody, !item.partName && typeDash)}>{item.partName || "–"}</div>
                    <div className={typeMeta}>{item.category}</div>
                  </div>
                  <div className="min-w-0 text-left">
                    <div className={`${typeCaption} sm:hidden`}>Typ materiálu</div>
                    <div className={cn(typeBody, !item.materialType && typeDash)}>{item.materialType || "–"}</div>
                  </div>
                  <div className="min-w-0 text-left">
                    <div className={`${typeCaption} sm:hidden`}>Množstvo</div>
                    <div className={cn(typeBody, !item.quantity && typeDash)}>{item.quantity || "–"}</div>
                  </div>
                  <div className="min-w-0 text-left">
                    <div className={`${typeCaption} sm:hidden`}>Značka</div>
                    <div className={cn(typeBody, !item.partBrand && typeDash)}>{item.partBrand || "–"}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      {customerView ? null : (
        <div className="hidden print:block">
          <RecordTotals money={money} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <label className="flex cursor-pointer items-center gap-2">
          <span className={typeLabel}>Zobrazenie pre zákazníka</span>
          <Switch
            checked={customerView}
            onCheckedChange={setCustomerView}
              className="data-unchecked:border-[#8a8a8a] data-unchecked:bg-[#8a8a8a]"
          />
        </label>
        <Button type="button" className={quietButtonClass} disabled={savingPdf} onClick={saveVisitPdf}>
          Uložiť PDF
          <FileArrowDown size={iconSize} />
        </Button>
      </div>
    </div>
  )
}

function RecordTotals({
  money,
  divided = false,
}: {
  money: MoneyTotals
  divided?: boolean
}) {
  const laborTone = typeTone(money.labor)
  const marginTone = typeTone(money.margin)

  return (
    <div
      className={cn(
        "px-4 py-3.5",
        insetClass,
        totalsGrid,
        divided && "border-t border-neutral-200"
      )}
    >
      <TotalCell label="Zárobok za prácu">
        <div className={cn(typeTitle, typeTabular, laborTone)}>{formatMoney(money.labor)}</div>
      </TotalCell>
      <TotalCell label="Zárobok na materiáli">
        <div className={cn(typeTitle, typeTabular, marginTone)}>{formatMoney(money.margin)}</div>
      </TotalCell>
      <TotalCell label="Hodnota zákroku">
        <div className={cn(typeDisplay, typeTabular)}>{formatMoney(money.billed)}</div>
      </TotalCell>
    </div>
  )
}

function TotalCell({
  label,
  children,
  className,
  labelClass = typeCaption,
}: {
  label: string
  children: ReactNode
  className?: string
  labelClass?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 text-left", className)}>
      <div className={labelClass}>{label}</div>
      {children}
    </div>
  )
}

function DeleteVisitButton({
  dateLabel,
  onDelete,
  compact,
}: {
  dateLabel: string
  onDelete: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        className={cn(quietButtonClass, typeDanger, compact && "px-2")}
        aria-label="Odstrániť"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {compact ? null : "Odstrániť"}
        <Bin size={iconSize} />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstrániť zákrok?</AlertDialogTitle>
            <AlertDialogDescription>
              Záznam z {dateLabel} sa odstráni z evidencie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={quietButtonClass}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              className={cn(quietButtonClass, typeDanger)}
              onClick={() => {
                onDelete()
                setOpen(false)
              }}
            >
              Odstrániť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function recordCategories(record: ServiceRecord) {
  const names = serviceCategories.filter((category) =>
    record.items.some((item) => item.category === category)
  )

  return names.join(", ") || "–"
}
