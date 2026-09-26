import { Badge } from "@/components/ui/badge"
import type { ServiceActionType } from "@/lib/types"
import { cn } from "@/lib/utils"

const actionClass: Record<ServiceActionType, string> = {
  Výmena: "border border-[#0B6E96]/30 bg-[#159DD4]/10 text-sm font-medium text-[#0B6E96]",
  Oprava: "border border-neutral-300 bg-neutral-100 text-sm font-medium text-black",
  Kontrola: "border border-dashed border-neutral-300 bg-white text-sm font-medium text-neutral-700",
  Nastavenie: "border border-neutral-300 bg-white text-sm font-medium text-black",
}

export function ActionBadge({ action }: { action: ServiceActionType }) {
  return (
    <Badge variant="outline" className={cn(actionClass[action])}>
      {action}
    </Badge>
  )
}
