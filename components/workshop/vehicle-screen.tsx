"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Plus, Printer } from "@keyline-icons/react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActionBadge } from "@/components/workshop/action-badge"
import { AppHeader } from "@/components/workshop/app-header"
import { RecordSheet } from "@/components/workshop/record-sheet"
import { Stat } from "@/components/workshop/stat"
import {
  insetClass,
  primaryButtonClass,
  quietButtonClass,
  rowHoverClass,
  surfaceClass,
  typeBody,
  typeBrand,
  typeCaption,
  typeDash,
  typeLabel,
  typeMeta,
  typeMoney,
  typeMoneyQuiet,
  typeTitle,
} from "@/components/workshop/styles"
import { formatDate, formatKm, formatMoney, formatNextService, formatPercent, formatPlate, formatVehicleSpec } from "@/lib/format"
import { recordTotals, type MoneyTotals } from "@/lib/finance"
import { latestOilRecord, latestOilUpcoming } from "@/lib/list-query"
import { serviceCategories, type Customer, type ServiceRecord, type Vehicle } from "@/lib/types"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

const vehicleGrid =
  "grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"

const historyCols =
  "grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.1fr)_minmax(10rem,0.85fr)] sm:items-center"

const historyChevronClass = "w-4 shrink-0"

const historyActionClass = "w-[4.75rem] shrink-0"

const itemGrid =
  "grid grid-cols-1 gap-2 sm:grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(7rem,0.65fr)_minmax(5.5rem,0.5fr)_minmax(6rem,0.55fr)_5.75rem_5.75rem_7.25rem] sm:items-center sm:gap-4"

const itemGridCustomer =
  "grid grid-cols-1 gap-2 sm:grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(7rem,0.65fr)_minmax(5.5rem,0.5fr)_minmax(6rem,0.55fr)_5.75rem] sm:items-center sm:gap-4"

const marginPair =
  "grid grid-cols-[4.5rem_2.5rem] items-baseline gap-x-1.5"

const totalsGrid =
  "grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.75rem_5.75rem_7.25rem] sm:items-stretch"

const totalsGridCustomer =
  "grid grid-cols-1 gap-4 sm:grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(7rem,0.65fr)_minmax(5.5rem,0.5fr)_minmax(6rem,0.55fr)_5.75rem] sm:items-stretch"

export function VehicleScreen() {
  const params = useParams<{ id: string }>()
  const { customers, vehicles, records } = useWorkshop()
  const [recordOpen, setRecordOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null)
  const vehicle = vehicles.find((item) => item.id === params.id)
  const customer = customers.find((item) => item.id === vehicle?.customerId)
  const history = records
    .filter((record) => record.vehicleId === vehicle?.id)
    .sort((left, right) => right.serviceDate.localeCompare(left.serviceDate) || right.mileage - left.mileage)

  if (!vehicle || !customer) {
    return (
      <div className="min-h-svh text-black">
        <AppHeader />
        <main className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
          <p className={typeBody}>Vozidlo sa v evidencii nenašlo.</p>
          <Button className={quietButtonClass} nativeButton={false} render={<Link href="/" />}>
            Späť na zoznam
          </Button>
        </main>
      </div>
    )
  }

  const lastVisit = history[0]
  const lastOil = latestOilRecord(history)
  const nextOil = latestOilUpcoming(history)
  const firstRegistration = vehicle.firstRegistrationDate
    ? formatDate(vehicle.firstRegistrationDate)
    : "–"
  const mileage = lastVisit ? formatKm(lastVisit.mileage) : "–"

  return (
    <div className="min-h-svh text-black">
      <AppHeader
        actions={
          <>
            <Button className={quietButtonClass} nativeButton={false} render={<Link href="/" />}>
              Zoznam
            </Button>
            <Button
              className={primaryButtonClass}
              onClick={() => {
                setEditingRecord(null)
                setRecordOpen(true)
              }}
            >
              <Plus />
              Nový záznam
            </Button>
          </>
        }
      />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <section className={cn("flex flex-col gap-4 rounded-lg p-4 print:hidden", surfaceClass)}>
          <div className={cn("hidden sm:grid sm:items-end", vehicleGrid)}>
            <div className={typeCaption}>Vozidlo</div>
            <div className={typeCaption}>Zákazník</div>
            <div className={typeCaption}>Posledný servis</div>
            <div className={typeCaption}>Ďalší servis</div>
          </div>
          <div className={vehicleGrid}>
            <div className="min-w-0 text-left">
              <div className={`${typeCaption} sm:hidden`}>Vozidlo</div>
              <div className={typeBrand}>{formatPlate(vehicle.licensePlate)}</div>
              <div className={typeMeta}>{formatVehicleSpec(vehicle)}</div>
              <div className={cn(typeMeta, "tabular-nums", !vehicle.vin && typeDash)}>{vehicle.vin || "–"}</div>
            </div>
            <div className="min-w-0 text-left">
              <div className={`${typeCaption} sm:hidden`}>Zákazník</div>
              <div className={cn(typeTitle, !customer.name && typeDash)}>{customer.name || "–"}</div>
              {customer.phone ? (
                <a className={typeMeta} href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              ) : (
                <div className={cn(typeMeta, typeDash)}>–</div>
              )}
              <div className={cn(typeMeta, !customer.email && typeDash)}>{customer.email || "–"}</div>
            </div>
            <div className="min-w-0 text-left">
              <div className={`${typeCaption} sm:hidden`}>Posledný servis</div>
              <div className={cn(typeMeta, !lastOil && typeDash)}>
                {lastOil ? `${formatDate(lastOil.serviceDate)} · ${formatKm(lastOil.mileage)}` : "–"}
              </div>
            </div>
            <div className="min-w-0 text-left">
              <div className={`${typeCaption} sm:hidden`}>Ďalší servis</div>
              <div className={cn(typeMeta, !nextOil && typeDash)}>{nextOil ? formatNextService(nextOil) : "–"}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3 print:hidden">
          <Stat label="Zákroky" value={String(history.length)} />
          <Stat label="Prvá evidencia" value={firstRegistration} />
          <Stat label="Najazdené" value={mileage} />
        </div>

        {history.length === 0 ? (
          <p className={typeBody}>Pre toto vozidlo zatiaľ nie je žiadny servisný záznam.</p>
        ) : (
          <Accordion className={cn("overflow-hidden rounded-lg print:overflow-visible print:border-0", surfaceClass)} multiple>
            <div className="hidden items-center gap-3 border-b border-neutral-200 px-4 py-2 sm:flex print:hidden">
              <div className={historyCols}>
                <div className={typeCaption}>Dátum</div>
                <div className={typeCaption}>Kategória</div>
                <div className={typeCaption}>Suma za servis</div>
              </div>
              <div className={historyActionClass} />
              <div className={historyChevronClass} />
            </div>
            {history.map((record) => {
              const money = recordTotals(record)
              return (
                <AccordionItem
                  key={record.id}
                  value={record.id}
                  id={`record-${record.id}`}
                  data-record=""
                  className="border-b border-neutral-200 print:border-0"
                >
                  <div className={cn("relative flex items-center px-4 print:hidden", rowHoverClass)}>
                    <AccordionTrigger
                      headerClassName="min-w-0 w-full"
                      className="w-full items-center justify-start gap-3 px-0 text-black hover:bg-transparent hover:no-underline **:data-[slot=accordion-trigger-icon]:ml-0"
                    >
                      <span className={historyCols}>
                        <span className="min-w-0 text-left">
                          <span className={`${typeCaption} sm:hidden`}>Dátum</span>
                          <span className={`${typeTitle} block whitespace-nowrap`}>{formatDate(record.serviceDate)}</span>
                          <span className={`${typeMeta} block whitespace-nowrap tabular-nums`}>{formatKm(record.mileage)}</span>
                        </span>
                        <span className="min-w-0 text-left">
                          <span className={`${typeCaption} sm:hidden`}>Kategória</span>
                          <span className={typeBody}>{recordCategories(record)}</span>
                        </span>
                        <span className="min-w-0 text-left">
                          <span className={`${typeCaption} sm:hidden`}>Suma za servis</span>
                          <span className={`${typeTitle} block tabular-nums`}>
                            {formatMoney(money.billed)}
                          </span>
                        </span>
                      </span>
                      <span className={`${historyActionClass} hidden sm:block`} aria-hidden />
                    </AccordionTrigger>
                    <div className={`absolute top-1/2 right-11 -translate-y-1/2 ${historyActionClass}`}>
                      <Button
                        type="button"
                        className={`${quietButtonClass} w-full`}
                        onClick={() => {
                          setEditingRecord(record)
                          setRecordOpen(true)
                        }}
                      >
                        Upraviť
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="px-4">
                    <RecordDetails record={record} vehicle={vehicle} customer={customer} money={money} />
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </main>
      <RecordSheet
        vehicleId={vehicle.id}
        record={editingRecord}
        open={recordOpen}
        onOpenChange={(open) => {
          setRecordOpen(open)
          if (!open) {
            setEditingRecord(null)
          }
        }}
      />
    </div>
  )
}

type RecordView = "mechanic" | "customer"

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
  const [view, setView] = useState<RecordView>("mechanic")
  const customerView = view === "customer"
  const grid = customerView ? itemGridCustomer : itemGrid
  const nextService = formatNextService(record)
  const hasNextService = Boolean(nextService)
  const mechanicNote = record.mechanicNotes.trim()

  function printVisit() {
    const node = document.getElementById(`record-${record.id}`)
    document.body.setAttribute("data-print-record", "")
    node?.setAttribute("data-print-active", "")
    const cleanup = () => {
      document.body.removeAttribute("data-print-record")
      node?.removeAttribute("data-print-active")
      window.removeEventListener("afterprint", cleanup)
    }
    window.addEventListener("afterprint", cleanup)
    window.print()
  }

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="hidden flex-col gap-3 border-b border-neutral-200 pb-4 print:flex">
        <div className={typeCaption}>Autopedant</div>
        <div className={typeBrand}>Servisný zákrok</div>
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
          <div className={cn(historyCols, "sm:items-start")}>
            {hasNextService ? (
              <div className="flex min-w-0 flex-col gap-1 text-left">
                <div className={typeCaption}>Ďalší servis</div>
                <div className={`${typeMeta} tabular-nums`}>{nextService}</div>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
            {mechanicNote ? (
              <div className="flex min-w-0 flex-col gap-1 text-left sm:col-span-2">
                <div className={typeCaption}>Poznámka mechanika</div>
                <p className={typeBody}>{mechanicNote}</p>
              </div>
            ) : null}
          </div>
          <div className={`${historyActionClass} hidden sm:block print:hidden`} aria-hidden />
          <div className={`${historyChevronClass} hidden sm:block print:hidden`} aria-hidden />
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-neutral-200 bg-white",
          customerView && "border-l-2 border-l-[#159DD4]"
        )}
      >
      {record.items.length > 0 ? (
        <>
          <div className={cn("hidden border-b border-neutral-200 px-4 py-2 sm:grid", grid)}>
            <div className={typeCaption}>Úkon</div>
            <div className={typeCaption}>Náhradný diel</div>
            <div className={typeCaption}>Typ materiálu</div>
            <div className={typeCaption}>Množstvo</div>
            <div className={typeCaption}>Značka</div>
            {customerView ? null : <div className={typeCaption}>Nákup</div>}
            <div className={typeCaption}>{customerView ? "Cena" : "Predaj"}</div>
            {customerView ? null : <div className={typeCaption}>Marža</div>}
          </div>
          <div className="divide-y divide-neutral-200">
          {record.items.map((item) => {
            const margin = item.sellPrice - item.purchasePrice
            const marginShare = formatPercent(margin, item.sellPrice)
            return (
              <div
                key={item.id}
                className={cn("px-4 py-3", grid)}
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
                {customerView ? null : (
                  <div className="min-w-0 text-left">
                    <div className={`${typeCaption} sm:hidden`}>Nákup</div>
                    <div className={typeMoneyQuiet}>
                      {formatMoney(item.purchasePrice)}
                    </div>
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <div className={`${typeCaption} sm:hidden`}>{customerView ? "Cena" : "Predaj"}</div>
                  <div className={typeMoney}>
                    {formatMoney(item.sellPrice)}
                  </div>
                </div>
                {customerView ? null : (
                <div className="min-w-0 text-left">
                  <div className={`${typeCaption} sm:hidden`}>Marža</div>
                  <div className={cn(marginPair, "text-left tabular-nums")}>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        margin > 0 && "text-[#0B6E96]",
                        margin < 0 && "text-red-700",
                        margin === 0 && "text-black"
                      )}
                    >
                      {formatMoney(margin)}
                    </div>
                    {marginShare ? (
                      <div
                        className={cn(
                          "text-xs font-normal",
                          margin > 0 && "text-[#0B6E96]",
                          margin < 0 && "text-red-700",
                          margin === 0 && "text-black"
                        )}
                      >
                        ({marginShare})
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
                )}
              </div>
            )
          })}
          </div>
        </>
      ) : null}
        <RecordTotals money={money} divided={record.items.length > 0} customerView={customerView} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <ToggleGroup
          value={[view]}
          onValueChange={(next) => {
            const selected = next[next.length - 1]
            if (selected === "mechanic" || selected === "customer") {
              setView(selected)
            }
          }}
          variant="outline"
          spacing={0}
        >
          <ToggleGroupItem value="mechanic">Mechanik</ToggleGroupItem>
          <ToggleGroupItem value="customer">Zákazník</ToggleGroupItem>
        </ToggleGroup>
        <Button type="button" className={quietButtonClass} onClick={printVisit}>
          <Printer />
          Tlačiť
        </Button>
      </div>
    </div>
  )
}

function RecordTotals({
  money,
  divided = false,
  customerView = false,
}: {
  money: MoneyTotals
  divided?: boolean
  customerView?: boolean
}) {
  const marginShare = formatPercent(money.margin, money.sell)
  const marginTone =
    money.margin > 0 ? "text-[#0B6E96]" : money.margin < 0 ? "text-red-700" : "text-black"

  if (customerView) {
    return (
      <div
        className={cn(
          "px-4 py-3.5",
          insetClass,
          totalsGridCustomer,
          divided && "border-t border-neutral-200"
        )}
      >
        <TotalCell className="sm:col-span-2 sm:h-full sm:justify-between" label="Spolu za servis" labelClass={typeLabel}>
          <div className={`${typeBrand} tabular-nums`}>{formatMoney(money.billed)}</div>
        </TotalCell>
        <TotalCell
          className="sm:col-span-3 sm:h-full sm:justify-between sm:border-x sm:border-neutral-200 sm:px-4"
          label="Práca"
          labelClass={typeLabel}
        >
          <div className={`${typeTitle} tabular-nums`}>{formatMoney(money.labor)}</div>
        </TotalCell>
        <TotalCell className="sm:h-full sm:justify-between" label="Materiál" labelClass={typeLabel}>
          <div className={`${typeTitle} tabular-nums`}>{formatMoney(money.sell)}</div>
        </TotalCell>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "px-4 py-3.5",
        insetClass,
        totalsGrid,
        divided && "border-t border-neutral-200"
      )}
    >
      <TotalCell className="sm:h-full sm:justify-between" label="Spolu za servis" labelClass={typeLabel}>
        <div className={`${typeBrand} tabular-nums`}>{formatMoney(money.billed)}</div>
      </TotalCell>
      <TotalCell
        className="sm:h-full sm:justify-between sm:border-x sm:border-neutral-200 sm:px-4"
        label="Práca"
        labelClass={typeLabel}
      >
        <div className={`${typeTitle} tabular-nums`}>{formatMoney(money.labor)}</div>
      </TotalCell>
      <div className="flex min-w-0 flex-col gap-2 text-left sm:col-span-3">
        <div className={typeLabel}>Materiál</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[5.75rem_5.75rem_7.25rem] sm:gap-4">
          <TotalCell label="Nákup">
            <div className={`${typeBody} tabular-nums`}>{formatMoney(money.purchase)}</div>
          </TotalCell>
          <TotalCell label="Predaj">
            <div className={`${typeTitle} tabular-nums`}>{formatMoney(money.sell)}</div>
          </TotalCell>
          <TotalCell label="Marža">
            <div className="flex items-baseline gap-1.5 text-left tabular-nums">
              <div className={cn("text-left text-base font-semibold tabular-nums", marginTone)}>
                {formatMoney(money.margin)}
              </div>
              {marginShare ? (
                <div className={cn("text-sm font-medium", marginTone)}>({marginShare})</div>
              ) : null}
            </div>
          </TotalCell>
        </div>
      </div>
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

function recordCategories(record: ServiceRecord) {
  const names = serviceCategories.filter((category) =>
    record.items.some((item) => item.category === category)
  )

  return names.join(", ") || "–"
}
