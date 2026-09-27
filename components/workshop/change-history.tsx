"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { iconSize, quietButtonClass, rowHoverClass, typeBody, typeCaption, typeMeta, typeTitle } from "@/components/workshop/styles"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

export function ChangeHistoryButton() {
  const router = useRouter()
  const { changes } = useWorkshop()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" className={quietButtonClass} onClick={() => setOpen(true)}>
        História zmien
        <Clock size={iconSize} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-white sm:max-w-md">
          <SheetHeader>
            <SheetTitle className={typeTitle}>História zmien</SheetTitle>
            <SheetDescription className={typeMeta}>
              Úpravy vozidiel a zákrokov v tejto evidencii.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {changes.length === 0 ? (
              <p className={typeBody}>Po uložení vozidla alebo zákroku sa zmena zapíše sem.</p>
            ) : (
              <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
                {changes.map((change) => {
                  const body = (
                    <>
                      <div className={typeCaption}>{formatChangeAt(change.at)}</div>
                      <div className={typeBody}>{change.title}</div>
                      {change.detail ? <div className={typeMeta}>{change.detail}</div> : null}
                    </>
                  )

                  if (!change.vehicleId) {
                    return (
                      <li key={change.id} className="px-1 py-3 text-left">
                        {body}
                      </li>
                    )
                  }

                  return (
                    <li key={change.id}>
                      <button
                        type="button"
                        className={cn("w-full px-1 py-3 text-left", rowHoverClass)}
                        onClick={() => {
                          setOpen(false)
                          router.push(`/vozidlo?id=${change.vehicleId}`)
                        }}
                      >
                        {body}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function formatChangeAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
