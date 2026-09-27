import { Badge } from "@/components/ui/badge"
import { typeLabel } from "@/components/workshop/styles"
import type { ServiceActionType } from "@/lib/types"
import { cn } from "@/lib/utils"

const actionClass: Record<ServiceActionType, string> = {
  Výmena: "border border-[#095A7C]/30 bg-[#159DD4]/10 text-[#095A7C]",
  Oprava: "border border-neutral-300 bg-neutral-100 text-black",
  Kontrola: "border border-dashed border-neutral-300 bg-white text-neutral-700",
  Nastavenie: "border border-neutral-300 bg-white text-black",
}

export function ActionBadge({ action }: { action: ServiceActionType }) {
  return (
    <Badge variant="outline" className={cn(typeLabel, actionClass[action])}>
      {action}
    </Badge>
  )
}
