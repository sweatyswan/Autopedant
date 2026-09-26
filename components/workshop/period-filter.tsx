"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fieldClass, typeCaption } from "@/components/workshop/styles"
import { monthLabels } from "@/lib/list-query"
import { cn } from "@/lib/utils"

type PeriodValue = {
  year?: number
  monthFrom?: number
  monthTo?: number
}

export function PeriodFilter({
  year,
  monthFrom,
  monthTo,
  years,
  onChange,
}: PeriodValue & {
  years: number[]
  onChange: (next: PeriodValue) => void
}) {
  const rangeEnd = monthTo ?? monthFrom
  const monthsEnabled = Boolean(year)

  return (
    <Popover>
      <PopoverTrigger
        id="filter-period"
        aria-label={
          year || monthFrom ? `Obdobie: ${periodLabel(year, monthFrom, monthTo)}` : "Obdobie"
        }
        className={cn(
          fieldClass,
          "inline-flex h-8 max-w-44 items-center gap-1 rounded-lg border px-2.5 text-left"
        )}
      >
        <span className="min-w-0 truncate">{periodLabel(year, monthFrom, monthTo)}</span>
        <ChevronDown className="size-3.5 shrink-0 text-neutral-700" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 border border-neutral-200 bg-white p-2 text-black"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className={typeCaption} id="filter-year">
              Rok
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-labelledby="filter-year">
              <Chip
                selected={!year}
                onClick={() => onChange({ year: undefined, monthFrom: undefined, monthTo: undefined })}
              >
                Všetky
              </Chip>
              {years.map((value) => (
                <Chip
                  key={value}
                  selected={year === value}
                  onClick={() =>
                    onChange({
                      year: year === value ? undefined : value,
                      monthFrom: year === value ? undefined : monthFrom,
                      monthTo: year === value ? undefined : monthTo,
                    })
                  }
                >
                  {value}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={typeCaption} id="filter-month">
              Mesiac
            </div>
            <Chip
              selected={!monthFrom}
              disabled={!monthsEnabled}
              onClick={() => onChange({ year, monthFrom: undefined, monthTo: undefined })}
            >
              Všetky
            </Chip>
            <div className="grid grid-cols-4 gap-1" role="group" aria-labelledby="filter-month">
              {monthLabels.map((label, index) => {
                const value = index + 1
                return (
                  <Chip
                    key={label}
                    selected={isRangeEnd(value, monthFrom, rangeEnd)}
                    inRange={isInRange(value, monthFrom, rangeEnd)}
                    disabled={!monthsEnabled}
                    onClick={() => onChange({ year, ...nextMonthRange(value, monthFrom, monthTo) })}
                  >
                    {label}
                  </Chip>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function nextMonthRange(value: number, monthFrom?: number, monthTo?: number) {
  if (!monthFrom || monthTo) {
    return { monthFrom: value, monthTo: undefined }
  }

  if (monthFrom === value) {
    return { monthFrom: undefined, monthTo: undefined }
  }

  return {
    monthFrom: Math.min(monthFrom, value),
    monthTo: Math.max(monthFrom, value),
  }
}

function isRangeEnd(value: number, monthFrom?: number, monthTo?: number) {
  return value === monthFrom || value === monthTo
}

function isInRange(value: number, monthFrom?: number, monthTo?: number) {
  if (!monthFrom || !monthTo) {
    return false
  }

  return value > monthFrom && value < monthTo
}

function Chip({
  selected,
  inRange = false,
  disabled = false,
  onClick,
  children,
}: {
  selected: boolean
  inRange?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "h-7 rounded-md px-2 text-sm font-medium",
        disabled
          ? "cursor-not-allowed border border-neutral-200 bg-neutral-50 text-neutral-400"
          : selected
            ? "bg-black text-white"
            : inRange
              ? "bg-neutral-200 text-black"
              : "border border-neutral-200 bg-white text-black hover:bg-neutral-100"
      )}
      aria-pressed={selected || inRange}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function periodLabel(year?: number, monthFrom?: number, monthTo?: number) {
  const start = monthFrom ? monthLabels[monthFrom - 1] : undefined
  const end = monthTo && monthTo !== monthFrom ? monthLabels[monthTo - 1] : undefined
  const months = start && end ? `${start} – ${end}` : start

  if (months && year) {
    return `${months} ${year}`
  }

  if (year) {
    return String(year)
  }

  if (months) {
    return months
  }

  return "Obdobie"
}
