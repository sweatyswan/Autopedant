export const canvasClass = "bg-[#F4F7F9] print:bg-white"

export const surfaceClass =
  "border border-neutral-200 bg-white text-black shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.04)] ring-0 print:shadow-none"

export const insetClass = "bg-[#F8FCFE] print:bg-white"

export const bandClass = "bg-[#b7deec] print:bg-white"

export const rowHoverClass = "hover:bg-[#F2F8FB]"

export const rowActiveClass = "bg-[#F2F8FB]"

export const rowOpenClass = "in-data-open:bg-[#c5e6f2] in-data-open:hover:bg-[#c5e6f2]"

export const rowPanelClass = "in-data-open:bg-[#e0f3fa] print:bg-transparent"

export const popoverSurfaceClass = "border border-neutral-200 bg-white text-black"

export const accentBarClass = "border-l-2 border-l-[#159DD4]"

export const fieldClass =
  "border-[#8a8a8a] bg-white text-sm font-normal text-black shadow-none placeholder:text-neutral-600 data-placeholder:text-neutral-600"

export const fieldOnCardClass = `${fieldClass} ${insetClass}`

export const selectPlaceholderClass = "data-placeholder:font-medium data-placeholder:text-neutral-700"

export const primaryButtonClass =
  "border border-[#0F7AAB] bg-[#0F7AAB] text-sm font-semibold text-white hover:bg-[#0C6A94]"

export const controlHoverClass =
  "hover:border-[#0F7AAB] hover:bg-[#c5e6f2] hover:text-[#0A6288]"

export const quietButtonClass =
  `border border-neutral-200 bg-white text-sm font-medium text-black ${controlHoverClass}`

export const chipClass = "h-7 rounded-md px-2 text-sm font-medium"

export const chipSelectedClass = "bg-[#0F7AAB] text-white"

export const chipRangeClass = "bg-[#159DD4]/15 text-[#0A6288]"

export const iconSize = "1em"

/** Display 18/700 — EČV, Spolu, wordmark */
export const typeDisplay = "text-left text-lg font-bold text-black"

/** Title 16/600 — meno, dátum, hlasná suma */
export const typeTitle = "text-left text-base font-semibold text-black"

/** Body 14/400 — bežný text, diel, nákup */
export const typeBody = "text-left text-sm font-normal text-black"

/** Label 14/500 — formulár, nadpis sumy, switch */
export const typeLabel = "text-left text-sm font-medium text-neutral-700"

/** Caption 12/500 — hlavička stĺpca, filter, štatistika */
export const typeCaption = "text-left text-xs font-medium text-neutral-600"

/** Meta 14/400 — VIN, telefón, km */
export const typeMeta = "text-left text-sm font-normal text-neutral-600"

export const typeInk = "text-black"
export const typeDash = "text-neutral-600"
export const typeAccent = "text-[#0A6288]"
export const typeDanger = "text-red-700"
export const typeTabular = "tabular-nums"
export const typeError = `${typeBody} font-semibold ${typeDanger}`

export function typeTone(value: number) {
  if (value > 0) {
    return typeAccent
  }

  if (value < 0) {
    return typeDanger
  }

  return typeInk
}
