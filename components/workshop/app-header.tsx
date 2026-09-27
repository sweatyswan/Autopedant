"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ChangeHistoryButton } from "@/components/workshop/change-history"
import { quietButtonClass, typeCaption, typeDisplay } from "@/components/workshop/styles"
import { useAuth } from "@/lib/auth-context"
import { useWorkshop } from "@/lib/workshop-context"

export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  const { configured, session, signOut } = useAuth()
  const { cloudError } = useWorkshop()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-left leading-tight">
          <div className={typeDisplay}>Autopedant</div>
          <div className={typeCaption}>Prehľad servisovaných vozidiel</div>
          {cloudError ? <div className={typeCaption}>{cloudError}</div> : null}
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
    </header>
  )
}
