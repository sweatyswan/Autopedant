import type { ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import { typeMeta } from "@/components/workshop/styles"
import { formatKmInput } from "@/lib/format"
import { cn } from "@/lib/utils"

export function KmInput({
  value,
  onValueChange,
  className,
  placeholder: _placeholder,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0">
      <Input
        {...props}
        inputMode="numeric"
        className={cn("pr-9 tabular-nums", className)}
        value={value}
        onChange={(event) => {
          const input = event.currentTarget
          const digitsBefore = input.value.slice(0, input.selectionStart ?? 0).replace(/\D/g, "").length
          const next = formatKmInput(input.value)
          onValueChange(next)

          requestAnimationFrame(() => {
            if (digitsBefore === 0) {
              input.setSelectionRange(0, 0)
              return
            }

            let seen = 0
            let position = next.length
            for (let index = 0; index < next.length; index += 1) {
              if (/\d/.test(next[index] ?? "")) {
                seen += 1
                if (seen === digitsBefore) {
                  position = index + 1
                  break
                }
              }
            }

            input.setSelectionRange(position, position)
          })
        }}
      />
      <span className={cn(typeMeta, "pointer-events-none absolute inset-y-0 right-2.5 flex items-center")}>
        km
      </span>
    </div>
  )
}
