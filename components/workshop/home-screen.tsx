"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "@keyline-icons/react"
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppHeader } from "@/components/workshop/app-header"
import {
  fieldClass,
  primaryButtonClass,
  quietButtonClass,
  rowHoverClass,
  surfaceClass,
  typeBody,
  typeBrand,
  typeCaption,
  typeDash,
  typeMeta,
  typeTitle,
} from "@/components/workshop/styles"
import { HomeStats } from "@/components/workshop/home-stats"
import { PeriodFilter } from "@/components/workshop/period-filter"
import { VehicleDialog } from "@/components/workshop/vehicle-dialog"
import { formatDate, formatKm, formatNextService, formatPlate, formatVehicleSpec } from "@/lib/format"
import { sumTotals } from "@/lib/finance"
import {
  filterVehicles,
  latestOilRecord,
  latestOilUpcoming,
  serviceYears,
  sortVehicles,
  vehicleBrands,
  type ListFilters,
  type ListSort,
  type ListSortDirection,
} from "@/lib/list-query"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

const listGrid =
  "grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"

const defaultFilters: ListFilters = {
  brand: "all",
}

export function HomeScreen() {
  const router = useRouter()
  const { customers, vehicles, records } = useWorkshop()
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<ListFilters>(defaultFilters)
  const [sort, setSort] = useState<ListSort>("last")
  const [direction, setDirection] = useState<ListSortDirection>("desc")
  const [active, setActive] = useState(0)
  const [vehicleOpen, setVehicleOpen] = useState(false)

  const brands = useMemo(() => vehicleBrands(vehicles), [vehicles])
  const years = useMemo(() => serviceYears(records), [records])
  const filtersActive =
    Boolean(filters.year || filters.monthFrom || filters.monthTo) ||
    filters.brand !== "all" ||
    sort !== "last" ||
    direction !== "desc"

  const results = useMemo(() => {
    const filtered = filterVehicles(vehicles, records, customers, query, filters)
    return sortVehicles(filtered, records, customers, sort, direction)
  }, [customers, direction, filters, query, records, sort, vehicles])

  useEffect(() => {
    setActive(0)
  }, [direction, filters, query, sort])

  const totals = sumTotals(records)
  const customersById = new Map(customers.map((customer) => [customer.id, customer]))

  function openActive() {
    const vehicle = results[active]
    if (vehicle) {
      router.push(`/vozidlo/${vehicle.id}`)
    }
  }

  function updateFilter<Key extends keyof ListFilters>(key: Key, value: ListFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="min-h-svh text-black">
      <AppHeader
        actions={
          <Button className={primaryButtonClass} onClick={() => setVehicleOpen(true)}>
            <Plus />
            Nové vozidlo
          </Button>
        }
      />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <HomeStats vehicles={vehicles.length} visits={records.length} totals={totals} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className={typeCaption} htmlFor="vehicle-search">
                Hľadať podľa EČV, VIN alebo mena
              </label>
              <Input
                id="vehicle-search"
                className={fieldClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (results.length === 0) {
                    return
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setActive((index) => Math.min(index + 1, results.length - 1))
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setActive((index) => Math.max(index - 1, 0))
                  }

                  if (event.key === "Enter") {
                    event.preventDefault()
                    openActive()
                  }
                }}
                placeholder="Napr. BA123XY"
                autoFocus
                autoComplete="off"
              />
            </div>
            <FilterSelect
              id="filter-brand"
              label="Značka"
              value={filters.brand}
              display={filters.brand === "all" ? "Všetky" : filters.brand}
              onChange={(value) => updateFilter("brand", value)}
              options={[{ value: "all", label: "Všetky" }, ...brands.map((brand) => ({ value: brand, label: brand }))]}
            />
          </div>
          <div className="flex items-end gap-2">
            <PeriodFilter
              year={filters.year}
              monthFrom={filters.monthFrom}
              monthTo={filters.monthTo}
              years={years}
              onChange={(period) =>
                setFilters((current) => ({
                  ...current,
                  year: period.year,
                  monthFrom: period.monthFrom,
                  monthTo: period.monthTo,
                }))
              }
            />
            <SortMenu
              sort={sort}
              direction={direction}
              onSortChange={(value) => {
                setSort(value)
                setDirection(value === "last" ? "desc" : "asc")
              }}
              onDirectionChange={setDirection}
            />
          </div>
        </div>

        {filtersActive ? (
          <div>
            <Button
              type="button"
              className={quietButtonClass}
              onClick={() => {
                setFilters(defaultFilters)
                setSort("last")
                setDirection("desc")
              }}
            >
              Zrušiť filtre
            </Button>
          </div>
        ) : null}

        {results.length === 0 ? (
          <p className={typeBody}>Nič sa nenašlo. Upravte hľadanie alebo filtre.</p>
        ) : (
          <div className={cn("overflow-hidden rounded-lg", surfaceClass)}>
            <div className={cn("hidden border-b border-neutral-200 px-4 py-2 sm:grid sm:items-center", listGrid)}>
              <div className={typeCaption}>Vozidlo</div>
              <div className={typeCaption}>Zákazník</div>
              <div className={typeCaption}>Posledný servis</div>
              <div className={typeCaption}>Ďalší servis</div>
            </div>
            {results.map((vehicle, index) => {
              const customer = customersById.get(vehicle.customerId)
              const vehicleRecords = records.filter((record) => record.vehicleId === vehicle.id)
              const lastOil = latestOilRecord(vehicleRecords)
              const nextOil = latestOilUpcoming(vehicleRecords)

              return (
                <div
                  key={vehicle.id}
                  className={cn(
                    "border-b border-neutral-200 last:border-b-0",
                    index === active && "bg-[#F4F6F8]"
                  )}
                  onMouseEnter={() => setActive(index)}
                >
                  <Link
                    href={`/vozidlo/${vehicle.id}`}
                    className={cn(listGrid, rowHoverClass, "p-4 text-black no-underline sm:items-center")}
                  >
                    <div className="min-w-0 text-left">
                      <div className={`${typeCaption} sm:hidden`}>Vozidlo</div>
                      <div className={typeBrand}>{formatPlate(vehicle.licensePlate)}</div>
                      <div className={typeBody}>{formatVehicleSpec(vehicle)}</div>
                    </div>
                    <div className="min-w-0 text-left">
                      <div className={`${typeCaption} sm:hidden`}>Zákazník</div>
                      <div className={cn(typeBody, "truncate", !customer?.name && typeDash)}>
                        {customer?.name || "–"}
                      </div>
                      <div className={cn(typeMeta, "truncate tabular-nums", !vehicle.vin && typeDash)}>
                        {vehicle.vin || "–"}
                      </div>
                    </div>
                    <div className="min-w-0 text-left">
                      <div className={`${typeCaption} sm:hidden`}>Posledný servis</div>
                      <div className={cn(lastOil ? typeTitle : typeMeta, !lastOil && typeDash, "truncate")}>
                        {lastOil
                          ? `${formatDate(lastOil.serviceDate)} · ${formatKm(lastOil.mileage)}`
                          : "–"}
                      </div>
                    </div>
                    <div className="min-w-0 text-left">
                      <div className={`${typeCaption} sm:hidden`}>Ďalší servis</div>
                      <div className={cn(typeMeta, "truncate", !nextOil && typeDash)}>
                        {nextOil ? formatNextService(nextOil) || "–" : "–"}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <VehicleDialog open={vehicleOpen} onOpenChange={setVehicleOpen} />
    </div>
  )
}

function FilterSelect({
  id,
  label,
  value,
  display,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  display: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className={typeCaption} htmlFor={id}>
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next)
          }
        }}
      >
        <SelectTrigger id={id} className={`${fieldClass} w-full`}>
          <SelectValue>{display}</SelectValue>
        </SelectTrigger>
        <SelectContent className="border border-neutral-200 bg-white text-black">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SortMenu({
  sort,
  direction,
  onSortChange,
  onDirectionChange,
}: {
  sort: ListSort
  direction: ListSortDirection
  onSortChange: (value: ListSort) => void
  onDirectionChange: (value: ListSortDirection) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(quietButtonClass, "inline-flex size-8 shrink-0 items-center justify-center rounded-lg")}
        aria-label="Zoradiť"
        title="Zoradiť"
      >
        {direction === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownNarrowWide />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-56 border border-neutral-200 bg-white text-black"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={cn(typeCaption, "px-1.5 pt-1 pb-0.5 tracking-wide")}>
            Zoradiť
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => {
              if (value === "last" || value === "next" || value === "customer") {
                onSortChange(value)
              }
            }}
          >
            <DropdownMenuRadioItem value="last">Posledný servis</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="next">Ďalší servis</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="customer">Zákazník</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-neutral-200" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={cn(typeCaption, "px-1.5 pt-1 pb-0.5 tracking-wide")}>
            Smer
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={direction}
            onValueChange={(value) => {
              if (value === "asc" || value === "desc") {
                onDirectionChange(value)
              }
            }}
          >
            <DropdownMenuRadioItem value="asc">Vzostupne</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">Zostupne</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

