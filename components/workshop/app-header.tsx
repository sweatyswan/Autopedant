import Link from "next/link"

import { typeBrand, typeMeta } from "@/components/workshop/styles"

export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-left">
          <div className={typeBrand}>Autopedant</div>
          <div className={typeMeta}>Prehľad servisovaných vozidiel</div>
        </Link>
        <div className="flex flex-wrap items-center gap-4">{actions}</div>
      </div>
    </header>
  )
}
