import { StatCell } from "@/components/workshop/stat-cell"
import { bandClass } from "@/components/workshop/styles"
import { formatMoney, formatPercent } from "@/lib/format"
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
    <div className={cn("overflow-hidden rounded-lg border border-neutral-200", bandClass)}>
      <div className="grid grid-cols-2 sm:grid-cols-5">
        <StatCell label="Vozidlá" value={String(vehicles)} />
        <StatCell label="Servisné zákroky" value={String(visits)} />
        <StatCell
          label="Zárobok za prácu"
          value={formatMoney(totals.labor)}
          share={formatPercent(totals.labor, totals.billed) || undefined}
          tone={moneyTone(totals.labor)}
        />
        <StatCell
          label="Zárobok na materiáli"
          value={formatMoney(totals.margin)}
          share={formatPercent(totals.margin, totals.billed) || undefined}
          tone={moneyTone(totals.margin)}
        />
        <StatCell label="Obrat za servisné zákroky" value={formatMoney(totals.billed)} loud />
      </div>
    </div>
  )
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
