import { StatCell } from "@/components/workshop/stat-cell"
import { insetClass, typeCaption, typeNegative, typeNumber, typeProfit } from "@/components/workshop/styles"
import { formatMoney } from "@/lib/format"
import type { MoneyTotals } from "@/lib/finance"
import { cn } from "@/lib/utils"

export function HomeStats({
  vehicles,
  visits,
  totals,
}: {
  vehicles: number
  visits: number
  totals: MoneyTotals
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-neutral-200", insetClass)}>
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <StatCell label="Vozidlá" value={String(vehicles)} />
        <StatCell label="Zákroky" value={String(visits)} />
        <StatCell label="Suma za servis" value={formatMoney(totals.billed)} />
        <StatCell label="Cena materiálu" value={formatMoney(totals.purchase)} />
        <ProfitCell totals={totals} />
      </div>
    </div>
  )
}

function ProfitCell({ totals }: { totals: MoneyTotals }) {
  const tone = moneyTone(totals.profit)

  return (
    <div
      className={cn(
        "col-span-2 flex items-start gap-6 border-neutral-200 px-4 py-2 max-sm:border-r-0 sm:col-span-1",
        "border-b border-r last:border-b-0 last:border-r-0",
        "sm:border-b-0 sm:last:border-r-0"
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className={typeCaption}>Zisk</span>
        <span
          className={cn(
            typeNumber,
            "text-left",
            tone === "profit" && typeProfit,
            tone === "negative" && typeNegative
          )}
        >
          {formatMoney(totals.profit)}
        </span>
      </div>
      <div className="grid grid-cols-[auto_auto_auto] items-baseline gap-x-2 gap-y-0.5">
        <ShareRow label="materiál" amount={totals.margin} whole={totals.profit} />
        <ShareRow label="práca" amount={totals.labor} whole={totals.profit} />
      </div>
    </div>
  )
}

function ShareRow({
  label,
  amount,
  whole,
}: {
  label: string
  amount: number
  whole: number
}) {
  return (
    <>
      <span className={typeCaption}>{label}</span>
      <span className="text-right text-xs font-medium tabular-nums text-black">
        {formatMoney(amount)}
      </span>
      <span className="text-right text-xs font-normal tabular-nums text-neutral-600">
        {formatShare(amount, whole)}
      </span>
    </>
  )
}

function formatShare(part: number, whole: number) {
  if (whole === 0) {
    return "–"
  }

  return new Intl.NumberFormat("sk-SK", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(part / whole)
}

function moneyTone(value: number) {
  if (value > 0) {
    return "profit" as const
  }

  if (value < 0) {
    return "negative" as const
  }

  return "plain" as const
}
