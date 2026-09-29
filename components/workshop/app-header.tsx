"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ChangeHistoryButton } from "@/components/workshop/change-history"
import { quietButtonClass, typeCaption, typeDisplay, typeError } from "@/components/workshop/styles"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useWorkshop } from "@/lib/workshop-context"

export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  const { configured, session, signOut } = useAuth()
  const { cloudError } = useWorkshop()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-left leading-tight">
          <h1 className={cn(typeDisplay, "m-0")}>Autopedant</h1>
          <div className={typeCaption}>Prehľad servisovaných vozidiel</div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <div className="flex items-center gap-2">
            <ChangeHistoryButton />
            {configured && session ? (
              <Button type="button" className={quietButtonClass} onClick={() => void signOut()}>
                Odhlásiť sa
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {cloudError ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(typeError, "mx-auto max-w-6xl px-3 pb-2")}
        >
          {cloudError}
        </p>
      ) : null}
    </header>
  )
}
