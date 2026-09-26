import { surfaceClass, typeDash, typeLabel, typeTabular, typeTitle, typeTone } from "@/components/workshop/styles"
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
  const toneClass = tone === "profit" ? typeTone(1) : tone === "negative" ? typeTone(-1) : typeTone(0)

  return (
    <div className={cn("flex items-baseline justify-between gap-4 rounded-lg p-4", surfaceClass)}>
      <span className={typeLabel}>{label}</span>
      <span className={cn(typeTitle, typeTabular, value === "–" && typeDash, toneClass)}>{value}</span>
    </div>
  )
}
