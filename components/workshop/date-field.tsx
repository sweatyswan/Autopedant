"use client"

import { useState } from "react"
import { sk } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  controlHoverClass,
  fieldClass,
  popoverSurfaceClass,
  quietButtonClass,
  typeCaption,
  typeDash,
} from "@/components/workshop/styles"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) {
    return undefined
  }

  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function DateField({
  id,
  label,
  value,
  onChange,
  allowClear = false,
  autoFocus = false,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  allowClear?: boolean
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseIsoDate(value) : undefined
  const now = new Date()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        autoFocus={autoFocus}
        className="flex min-w-0 w-full flex-col gap-1 rounded-none border-0 bg-transparent p-0 text-left font-normal text-black shadow-none outline-none hover:bg-transparent focus-visible:[&_[data-slot=date-value]]:border-ring focus-visible:[&_[data-slot=date-value]]:ring-3 focus-visible:[&_[data-slot=date-value]]:ring-ring/50"
      >
        <span className={typeCaption}>{label}</span>
        <span
          data-slot="date-value"
          className={cn(
            fieldClass,
            controlHoverClass,
            "inline-flex h-8 w-full min-w-0 items-center rounded-lg border px-2.5 text-sm",
            !value && typeDash
          )}
        >
          {value ? formatDate(value) : "–"}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(popoverSurfaceClass, "w-auto bg-white p-3 shadow-lg ring-1 ring-black/10")}
      >
        <Calendar
          mode="single"
          locale={sk}
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          startMonth={new Date(now.getFullYear() - 15, 0)}
          endMonth={new Date(now.getFullYear() + 5, 11)}
          formatters={{
            formatMonthDropdown: (date) => date.toLocaleString("sk-SK", { month: "long" }),
          }}
          onSelect={(next) => {
            if (!next) {
              if (allowClear) {
                onChange("")
              }
              return
            }

            onChange(toIsoDate(next))
            setOpen(false)
          }}
          className="bg-white text-black in-data-[slot=popover-content]:bg-white [--cell-size:--spacing(8)]"
          classNames={{
            weekday: "text-neutral-600",
            today: "bg-[#edf1f4] text-black",
            outside: "text-neutral-400",
          }}
        />
        {allowClear && value ? (
          <Button
            type="button"
            className={cn(quietButtonClass, "w-full")}
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            Vymazať
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
