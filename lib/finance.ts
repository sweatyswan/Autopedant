import type { ServiceRecord } from "@/lib/types"

export type MoneyTotals = {
  purchase: number
  sell: number
  margin: number
  labor: number
  profit: number
  billed: number
}

export function recordTotals(record: ServiceRecord): MoneyTotals {
  const purchase = record.items.reduce((sum, item) => sum + item.purchasePrice, 0)
  const sell = record.items.reduce((sum, item) => sum + item.sellPrice, 0)
  const margin = record.materialEarnings ?? sell - purchase
  const billed = record.billedAmount ?? 0

  return {
    purchase,
    sell,
    margin,
    labor: record.laborCost,
    profit: margin + record.laborCost,
    billed,
  }
}

export function sumTotals(records: ServiceRecord[]): MoneyTotals {
  return records.reduce<MoneyTotals>(
    (totals, record) => {
      const next = recordTotals(record)
      totals.purchase += next.purchase
      totals.sell += next.sell
      totals.margin += next.margin
      totals.labor += next.labor
      totals.profit += next.profit
      totals.billed += next.billed
      return totals
    },
    { purchase: 0, sell: 0, margin: 0, labor: 0, profit: 0, billed: 0 }
  )
}
