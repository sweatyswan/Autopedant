import { typeCaption } from "@/components/workshop/styles"
import { cn } from "@/lib/utils"

export function StatCell({
  label,
  value,
  share,
  tone = "plain",
}: {
  label: string
  value: string
  share?: string
  tone?: "plain" | "profit" | "negative"
}) {
  const toneClass =
    tone === "profit" ? "text-[#0B6E96]" : tone === "negative" ? "text-red-700" : "text-black"

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 border-neutral-200 px-4 py-2",
        "border-b border-r last:border-b-0 last:border-r-0",
        "even:max-sm:border-r-0 sm:border-b-0 sm:last:border-r-0"
      )}
    >
      <span className={typeCaption}>{label}</span>
      {share ? (
        <div className="grid grid-cols-[4.5rem_2.5rem] items-baseline gap-x-1.5 text-left tabular-nums">
          <span className={cn("text-left text-sm font-semibold", toneClass)}>{value}</span>
          <span className={cn("text-left text-xs font-normal", toneClass)}>({share})</span>
        </div>
      ) : (
        <span className={cn("text-left text-sm font-semibold tabular-nums", toneClass)}>
          {value}
        </span>
      )}
    </div>
  )
}
