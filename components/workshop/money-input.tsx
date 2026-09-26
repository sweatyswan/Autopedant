import type { ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import { typeMeta } from "@/components/workshop/styles"
import { cn } from "@/lib/utils"

export function MoneyInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0">
      <Input
        {...props}
        inputMode="decimal"
        className={cn("pr-7 tabular-nums", className)}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="0,00"
      />
      <span className={cn(typeMeta, "pointer-events-none absolute inset-y-0 right-2.5 flex items-center")}>
        €
      </span>
    </div>
  )
}
