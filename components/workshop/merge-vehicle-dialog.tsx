"use client"

import { useMemo, useState } from "react"
import { GitMerge, X } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  fieldClass,
  iconSize,
  popoverSurfaceClass,
  primaryButtonClass,
  quietButtonClass,
  rowActiveClass,
  typeBody,
  typeError,
  typeLabel,
  typeMeta,
  typeTitle,
} from "@/components/workshop/styles"
import { formatPlate, normalizeCode, normalizeName } from "@/lib/format"
import type { Customer, ServiceRecord, Vehicle } from "@/lib/types"
import { useWorkshop } from "@/lib/workshop-context"

type VehicleChoice = {
  id: string
  label: string
  search: string
}

function visitCountLabel(count: number) {
  const tens = count % 100
  const ones = count % 10
  if (count === 1) {
    return "1 zákrok"
  }
  if (ones >= 2 && ones <= 4 && (tens < 10 || tens >= 20)) {
    return `${count} zákroky`
  }
  return `${count} zákrokov`
}

function vehicleChoiceLabel(vehicle: Vehicle, customer: Customer | undefined, records: ServiceRecord[]) {
  const plate = formatPlate(vehicle.licensePlate)
  const count = records.filter((record) => record.vehicleId === vehicle.id).length
  return [plate || vehicle.makeModel, plate ? vehicle.makeModel : "", customer?.name, visitCountLabel(count)]
    .filter(Boolean)
    .join(" · ")
}

export function MergeVehicleDialog({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: Vehicle
}) {
  const { customers, vehicles, records, mergeVehicles } = useWorkshop()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const choices = useMemo(() => {
    const names = new Map(customers.map((customer) => [customer.id, customer]))
    return vehicles
      .filter((item) => item.id !== vehicle.id)
      .sort((left, right) => {
        const leftSame = left.customerId === vehicle.customerId ? 0 : 1
        const rightSame = right.customerId === vehicle.customerId ? 0 : 1
        if (leftSame !== rightSame) {
          return leftSame - rightSame
        }
        return (names.get(left.customerId)?.name ?? "").localeCompare(names.get(right.customerId)?.name ?? "", "sk")
      })
      .map((item) => {
        const owner = names.get(item.customerId)
        return {
          id: item.id,
          label: vehicleChoiceLabel(item, owner, records),
          search: [item.licensePlate, item.vin, item.makeModel, owner?.name].filter(Boolean).join(" "),
        }
      })
  }, [customers, records, vehicle.customerId, vehicle.id, vehicles])

  const selected = choices.find((choice) => choice.id === selectedId) ?? null

  function close() {
    setSelectedId(null)
    setError("")
    onOpenChange(false)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) {
      setError("Vyberte druhú kartu.")
      return
    }

    const result = mergeVehicles(vehicle.id, selected.id)
    if (!result.ok) {
      setError(result.message)
      return
    }

    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedId(null)
          setError("")
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className={`max-h-[calc(100%-2rem)] overflow-y-auto border border-neutral-200 text-black shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.04)] sm:max-w-lg ${rowActiveClass}`}
      >
        <DialogHeader>
          <DialogTitle className={typeTitle}>Spojiť kartu</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" method="dialog" onSubmit={submit}>
          <p className={typeBody}>
            Zákroky z vybranej karty prejdú sem. Vybraná karta sa z evidencie odstráni.
          </p>
          {choices.length ? (
            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="merge-vehicle">
                Druhá karta
              </Label>
              <Combobox
                items={choices}
                value={selected}
                onValueChange={(next) => {
                  setSelectedId(next?.id ?? null)
                  setError("")
                }}
                itemToStringLabel={(choice) => choice.label}
                isItemEqualToValue={(left, right) => left.id === right.id}
                filter={(item, query) => {
                  const needle = normalizeName(query) || normalizeCode(query).toLowerCase()
                  if (!needle) {
                    return true
                  }

                  return (
                    normalizeName(item.search).includes(needle) ||
                    normalizeCode(item.search).toLowerCase().includes(needle)
                  )
                }}
                autoHighlight
              >
                <ComboboxInput
                  id="merge-vehicle"
                  className={`${fieldClass} w-full`}
                  placeholder="EČV, model alebo meno"
                  showClear
                />
                <ComboboxContent className={popoverSurfaceClass}>
                  <ComboboxEmpty>Nič sa nenašlo.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: VehicleChoice) => (
                      <ComboboxItem key={item.id} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className={typeMeta}>Najprv karty rovnakého zákazníka.</p>
            </div>
          ) : (
            <p className={typeMeta}>V evidencii nie je ďalšia karta.</p>
          )}

          {error ? <p className={typeError}>{error}</p> : null}

          <DialogFooter className="border-neutral-200 bg-white sm:justify-end">
            <Button type="button" className={quietButtonClass} onClick={close}>
              Zrušiť
              <X size={iconSize} />
            </Button>
            <Button type="submit" className={primaryButtonClass} disabled={!choices.length}>
              Spojiť
              <GitMerge size={iconSize} />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
