import { surfaceClass, typeDash, typeLabel, typeNegative, typeNumber, typeProfit } from "@/components/workshop/styles"
import { cn } from "@/lib/utils"

export function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string
  value: string
  tone?: "plain" | "profit" | "negative"
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 rounded-lg p-4", surfaceClass)}>
      <span className={typeLabel}>{label}</span>
      <span
        className={cn(
          typeNumber,
          "text-left",
          value === "–" && typeDash,
          tone === "profit" && typeProfit,
          tone === "negative" && typeNegative
        )}
      >
        {value}
      </span>
    </div>
  )
}
