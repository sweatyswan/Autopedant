import {
  typeCaption,
  typeDisplay,
  typeTabular,
  typeTitle,
  typeTone,
} from "@/components/workshop/styles"
import { cn } from "@/lib/utils"

export function StatCell({
  label,
  value,
  share,
  tone = "plain",
  loud = false,
}: {
  label: string
  value: string
  share?: string
  tone?: "plain" | "profit" | "negative"
  loud?: boolean
}) {
  const toneClass = tone === "profit" ? typeTone(1) : tone === "negative" ? typeTone(-1) : typeTone(0)
  const valueClass = loud ? typeDisplay : typeTitle

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 px-4 py-2"
      )}
    >
      <span className={typeCaption}>{label}</span>
      {share ? (
        <div className="flex items-baseline gap-x-1.5 text-left tabular-nums">
          <span className={cn(valueClass, typeTabular, toneClass)}>{value}</span>
          <span className={cn(typeCaption, "font-normal", toneClass)}>({share})</span>
        </div>
      ) : (
        <span className={cn(valueClass, typeTabular, toneClass)}>{value}</span>
      )}
    </div>
  )
}
