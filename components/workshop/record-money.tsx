"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/workshop/money-input"
import { totalsGrid } from "@/components/workshop/record-layout"
import {
  fieldClass,
  typeAccent,
  typeCaption,
  typeDanger,
  typeTone,
  typeDisplay,
  typeTabular,
  typeTitle,
} from "@/components/workshop/styles"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

export const RecordChromeContext = createContext<{
  moneySlot: HTMLElement | null
  customerView: boolean
  setCustomerView: (value: boolean) => void
}>({
  moneySlot: null,
  customerView: false,
  setCustomerView: () => {},
})

export function useRecordChrome() {
  return useContext(RecordChromeContext)
}

export function RecordMoneyDisplay({
  labor,
  margin,
  billed,
}: {
  labor: number
  margin: number
  billed: number
}) {
  const laborTone = typeTone(labor)
  const marginTone = typeTone(margin)

  return (
    <div className={cn(totalsGrid, "min-w-0 flex-1")}>
      <MoneyCell label="Zárobok za prácu">
        <div className={cn(typeTitle, typeTabular, laborTone)}>{formatMoney(labor)}</div>
      </MoneyCell>
      <MoneyCell label="Zárobok na materiáli">
        <div className={cn(typeTitle, typeTabular, marginTone)}>{formatMoney(margin)}</div>
      </MoneyCell>
      <MoneyCell label="Hodnota zákroku">
        <div className={cn(typeDisplay, typeTabular)}>{formatMoney(billed)}</div>
      </MoneyCell>
    </div>
  )
}

export function RecordMoneyFields({
  laborCost,
  materialEarnings,
  billedAmount,
  labor,
  margin,
  onLaborChange,
  onMaterialChange,
  onBilledChange,
}: {
  laborCost: string
  materialEarnings: string
  billedAmount: string
  labor: number
  margin: number
  onLaborChange: (value: string) => void
  onMaterialChange: (value: string) => void
  onBilledChange: (value: string) => void
}) {
  return (
    <div className={cn(totalsGrid, "min-w-0 flex-1")}>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <Label className={typeCaption} htmlFor="inline-labor">
          Zárobok za prácu
        </Label>
        <MoneyInput
          id="inline-labor"
          className={cn(fieldClass, typeTitle, "text-left", labor > 0 && typeAccent)}
          value={laborCost}
          onValueChange={onLaborChange}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <Label className={typeCaption} htmlFor="inline-material">
          Zárobok na materiáli
        </Label>
        <MoneyInput
          id="inline-material"
          className={cn(
            fieldClass,
            typeTitle,
            "text-left",
            margin > 0 && typeAccent,
            margin < 0 && typeDanger
          )}
          value={materialEarnings}
          onValueChange={onMaterialChange}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-left">
        <Label className={typeCaption} htmlFor="inline-billed">
          Hodnota zákroku
        </Label>
        <MoneyInput
          id="inline-billed"
          className={cn(fieldClass, typeDisplay, "text-left")}
          value={billedAmount}
          onValueChange={onBilledChange}
        />
      </div>
    </div>
  )
}

export function RecordMoneyPortal({ children }: { children: ReactNode }) {
  const { moneySlot, customerView } = useRecordChrome()

  if (customerView || !moneySlot) {
    return null
  }

  return createPortal(children, moneySlot)
}

function MoneyCell({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-left">
      <div className={typeCaption}>{label}</div>
      {children}
    </div>
  )
}
