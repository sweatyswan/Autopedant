"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock } from "@keyline-icons/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  iconSize,
  primaryButtonClass,
  quietButtonClass,
  rowHoverClass,
  typeBody,
  typeCaption,
  typeError,
  typeMeta,
  typeTitle,
} from "@/components/workshop/styles"
import { canRevertChange } from "@/lib/change-log"
import { useWorkshop } from "@/lib/workshop-context"
import { cn } from "@/lib/utils"

export function ChangeHistoryButton() {
  const router = useRouter()
  const { changes, revertChange } = useWorkshop()
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const pending = changes.find((change) => change.id === pendingId)

  return (
    <>
      <Button type="button" className={quietButtonClass} onClick={() => setOpen(true)}>
        História zmien
        <Clock size={iconSize} />
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setError("")
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-md">
          <SheetHeader>
            <SheetTitle className={typeTitle}>História zmien</SheetTitle>
            <SheetDescription className={typeMeta}>
              Úpravy vozidiel a zákrokov v tejto evidencii.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {error ? <p className={cn(typeError, "pb-3")}>{error}</p> : null}
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
                      {change.reverted ? <div className={typeCaption}>Vrátené</div> : null}
                    </>
                  )

                  return (
                    <li key={change.id} className="flex items-start gap-2">
                      {change.vehicleId ? (
                        <button
                          type="button"
                          className={cn("min-w-0 flex-1 px-1 py-3 text-left", rowHoverClass)}
                          onClick={() => {
                            setOpen(false)
                            router.push(`/vozidlo?id=${change.vehicleId}`)
                          }}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="min-w-0 flex-1 px-1 py-3 text-left">{body}</div>
                      )}
                      {canRevertChange(change) ? (
                        <Button
                          type="button"
                          className={`${quietButtonClass} mt-3 shrink-0`}
                          onClick={() => {
                            setError("")
                            setPendingId(change.id)
                          }}
                        >
                          Vrátiť
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(next) => {
          if (!next) {
            setPendingId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vrátiť zmenu?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `Úprava sa vráti do stavu pred ňou. ${pending.detail || pending.title}.`
                : "Úprava sa vráti do stavu pred ňou."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={quietButtonClass}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              className={primaryButtonClass}
              onClick={() => {
                if (!pendingId) {
                  return
                }

                const result = revertChange(pendingId)
                setPendingId(null)
                if (result.ok) {
                  setError("")
                  setDone(true)
                  return
                }

                setError(result.message)
              }}
            >
              Vrátiť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={done} onOpenChange={setDone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmena je vrátená.</AlertDialogTitle>
            <AlertDialogDescription>Evidencia je v stave pred touto úpravou.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className={primaryButtonClass} onClick={() => setDone(false)}>
              Hotovo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
