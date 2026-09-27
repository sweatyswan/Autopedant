"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Check, X } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
  fieldClass,
  iconSize,
  popoverSurfaceClass,
  rowActiveClass,
  primaryButtonClass,
  quietButtonClass,
  typeDanger,
  typeError,
  typeLabel,
  typeMeta,
  typeTitle,
} from "@/components/workshop/styles"
import { formatDisplacement, formatPlate, normalizeName, parseDisplacement } from "@/lib/format"
import { engineDisplacements, fuelTypes, type Customer, type FuelType, type Vehicle } from "@/lib/types"
import { useWorkshop } from "@/lib/workshop-context"

const newCustomerValue = "new"

type CustomerChoice = {
  id: string
  name: string
}

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  customer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle
  customer?: Customer
}) {
  const router = useRouter()
  const { customers, addVehicle, updateVehicle } = useWorkshop()
  const editing = Boolean(vehicle && customer)
  const [customerId, setCustomerId] = useState(newCustomerValue)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [plate, setPlate] = useState("")
  const [vin, setVin] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [year, setYear] = useState("")
  const [displacement, setDisplacement] = useState("")
  const [fuel, setFuel] = useState<FuelType | "">("")
  const [error, setError] = useState("")
  const customerChoices: CustomerChoice[] = customers.map((item) => ({ id: item.id, name: item.name }))
  const linkedCustomer = customerChoices.find((choice) => choice.id === customerId)
  const selectedCustomer =
    linkedCustomer && normalizeName(linkedCustomer.name) === normalizeName(name) ? linkedCustomer : null

  function reset() {
    setCustomerId(newCustomerValue)
    setName("")
    setPhone("")
    setEmail("")
    setPlate("")
    setVin("")
    setMakeModel("")
    setYear("")
    setDisplacement("")
    setFuel("")
    setError("")
  }

  useEffect(() => {
    if (!open) {
      return
    }

    if (!vehicle || !customer) {
      reset()
      return
    }

    setCustomerId(customer.id)
    setName(customer.name)
    setPhone(customer.phone)
    setEmail(customer.email ?? "")
    setPlate(formatPlate(vehicle.licensePlate))
    setVin(vehicle.vin)
    setMakeModel(vehicle.makeModel)
    setYear(vehicle.year ? String(vehicle.year) : "")
    setDisplacement(vehicle.engineDisplacement ? vehicle.engineDisplacement.toFixed(1) : "")
    setFuel(fuelTypes.includes(vehicle.fuel) ? vehicle.fuel : "")
    setError("")
  }, [customer, open, vehicle])

  function applyCustomer(choice: CustomerChoice | null) {
    if (!choice) {
      setCustomerId(newCustomerValue)
      setName("")
      return
    }

    const owner = customers.find((item) => item.id === choice.id)
    setCustomerId(choice.id)
    setName(choice.name)
    if (!owner) {
      return
    }

    setPhone(owner.phone)
    setEmail(owner.email ?? "")
  }

  function onCustomerInput(next: string) {
    const owner = customers.find((item) => item.id === customerId)
    setName(next)

    if (!owner || normalizeName(next) === normalizeName(owner.name)) {
      return
    }

    setCustomerId(newCustomerValue)
    setPhone((current) => (current === owner.phone ? "" : current))
    setEmail((current) => (current === (owner.email ?? "") ? "" : current))
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsedYear = Number(year)
    const currentYear = new Date().getFullYear()
    const customerName = name.trim()
    const namedMatch = customers.filter((item) => normalizeName(item.name) === normalizeName(customerName))
    const resolvedCustomerId =
      customerId !== newCustomerValue
        ? customerId
        : namedMatch.length === 1
          ? namedMatch[0].id
          : null

    if (customerName.length === 0) {
      setError("Zadajte meno zákazníka.")
      return
    }

    if (!editing && phone.trim().length === 0) {
      setError("Zadajte telefón.")
      return
    }

    if (email.trim() && !email.includes("@")) {
      setError("E-mail nemá platný tvar.")
      return
    }

    if (!editing && plate.trim().length === 0) {
      setError("Zadajte EČV.")
      return
    }

    if (makeModel.trim().length === 0) {
      setError("Zadajte značku a model.")
      return
    }

    if (!year.trim() || !Number.isInteger(parsedYear) || parsedYear < 1980 || parsedYear > currentYear + 1) {
      setError("Zadajte rok výroby.")
      return
    }

    const parsedDisplacement = displacement.trim() ? parseDisplacement(displacement) : editing ? 0 : null
    if (parsedDisplacement === null) {
      setError("Vyberte objem motora.")
      return
    }

    if (!fuel && !editing) {
      setError("Zadajte palivo.")
      return
    }

    const payload = {
      customerId: resolvedCustomerId,
      customerName,
      phone,
      email,
      licensePlate: formatPlate(plate),
      vin,
      makeModel,
      year: parsedYear,
      firstRegistrationDate: editing && vehicle ? vehicle.firstRegistrationDate : "",
      engineDisplacement: parsedDisplacement,
      fuel,
    }

    if (editing && vehicle) {
      const result = updateVehicle(vehicle.id, payload)
      if (!result.ok) {
        setError(result.message)
        return
      }

      close()
      return
    }

    const result = addVehicle(payload)

    if (!result.ok) {
      setError(result.message)
      return
    }

    close()
    router.push(`/vozidlo?id=${result.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className={`max-h-[calc(100%-2rem)] overflow-y-auto border border-neutral-200 text-black shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.04)] sm:max-w-lg ${rowActiveClass}`}>
        <DialogHeader>
          <DialogTitle className={typeTitle}>{editing ? "Upraviť vozidlo" : "Nové vozidlo"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label className={typeLabel} htmlFor="customer">
              Zákazník
            </Label>
            <Combobox
              items={customerChoices}
              value={selectedCustomer}
              inputValue={name}
              onInputValueChange={onCustomerInput}
              onValueChange={(next) => {
                applyCustomer(next)
              }}
              itemToStringLabel={(choice) => choice.name}
              isItemEqualToValue={(left, right) => left.id === right.id}
              filter={(item, query) => {
                const needle = normalizeName(query)
                if (!needle) {
                  return true
                }

                return normalizeName(item.name).includes(needle)
              }}
              autoHighlight
            >
              <ComboboxInput
                id="customer"
                className={`${fieldClass} w-full`}
                placeholder="Meno, alebo z evidencie"
                showClear
              />
              <ComboboxContent className={popoverSurfaceClass}>
                <ComboboxEmpty>Nový zákazník</ComboboxEmpty>
                <ComboboxList>
                  {(item: CustomerChoice) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {name.trim() ? (
              <p className={typeMeta}>{selectedCustomer ? "Z evidencie" : "Nový zákazník"}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label className={typeLabel} htmlFor="customer-phone">
              Telefón
              {editing ? null : <RequiredMark />}
            </Label>
            <Input
              id="customer-phone"
              className={fieldClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Napr. +421 908 331 447"
              autoComplete="tel"
              required={!editing}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className={typeLabel} htmlFor="customer-email">
              E-mail
            </Label>
            <Input
              id="customer-email"
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Napr. martina.kovacova@example.com"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="plate">
                EČV
                {editing ? null : <RequiredMark />}
              </Label>
              <Input
                id="plate"
                className={`${fieldClass} uppercase tabular-nums placeholder:normal-case`}
                value={plate}
                onChange={(event) => setPlate(formatPlate(event.target.value))}
                placeholder="Napr. BA123XY"
                autoComplete="off"
                required={!editing}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="year">
                Rok výroby
                <RequiredMark />
              </Label>
              <Input
                id="year"
                className={`${fieldClass} text-right tabular-nums placeholder:text-left`}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="Napr. 2018"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className={typeLabel} htmlFor="vin">
              VIN
            </Label>
            <Input
              id="vin"
              className={`${fieldClass} uppercase tabular-nums placeholder:normal-case`}
              value={vin}
              onChange={(event) => setVin(event.target.value.toUpperCase())}
              placeholder="Napr. TMBJG7NE5J0123456"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className={typeLabel} htmlFor="make-model">
              Značka a model
              <RequiredMark />
            </Label>
            <Input
              id="make-model"
              className={fieldClass}
              value={makeModel}
              onChange={(event) => setMakeModel(event.target.value)}
              placeholder="Napr. Škoda Octavia"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="displacement">
                Objem motora
                {editing ? null : <RequiredMark />}
              </Label>
              <Select
                value={displacement || null}
                onValueChange={(value) => {
                  if (typeof value !== "string") {
                    return
                  }

                  const parsed = parseDisplacement(value)
                  if (parsed !== null) {
                    setDisplacement(parsed.toFixed(1))
                  }
                }}
                required={!editing}
              >
                <SelectTrigger id="displacement" className={`${fieldClass} w-full`}>
                  <SelectValue placeholder="Napr. 1,6 l">
                    {displacement ? formatDisplacement(Number(displacement)) : "Napr. 1,6 l"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className={popoverSurfaceClass}>
                  {engineDisplacements.map((option) => (
                    <SelectItem key={option.toFixed(1)} value={option.toFixed(1)}>
                      {formatDisplacement(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className={typeLabel} htmlFor="fuel">
                Palivo
                {editing ? null : <RequiredMark />}
              </Label>
              <Select
                value={fuel || null}
                onValueChange={(value) => {
                  if (fuelTypes.includes(value as FuelType)) {
                    setFuel(value as FuelType)
                  }
                }}
                required={!editing}
              >
                <SelectTrigger id="fuel" className={`${fieldClass} w-full`}>
                  <SelectValue placeholder="Napr. Nafta">{fuel || "Napr. Nafta"}</SelectValue>
                </SelectTrigger>
                <SelectContent className={popoverSurfaceClass}>
                  {fuelTypes.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className={typeError}>{error}</p> : null}

          <DialogFooter className="border-neutral-200 bg-white sm:justify-end">
            <Button type="button" className={quietButtonClass} onClick={close}>
              Zrušiť
              <X size={iconSize} />
            </Button>
            <Button type="submit" className={primaryButtonClass}>
              Uložiť vozidlo
              <Check size={iconSize} />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RequiredMark() {
  return (
    <span className={typeDanger} aria-hidden>
      {" *"}
    </span>
  )
}
