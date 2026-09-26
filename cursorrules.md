# 1. System Directive & Design Authority
You are an expert Frontend Engineer and Design Systems specialist. You must strictly follow the rules, component standards, and design tokens outlined in this document. Never guess styles, generate arbitrary Tailwind values, or drift from this specification.

# 2. Tech Stack & Component Hierarchy
- Framework: Next.js (App Router), React, TypeScript, Tailwind CSS
- Component Library: Shadcn UI (built on Radix UI primitives)
- Icons: Lucide React
- Accessibility: Fully keyboard-navigable dialogs, forms, and accordions. All text and UI contrast must meet WCAG AA (4.5:1 for body text, 3:1 for large text and UI chrome).
- CRITICAL: Use Shadcn UI primitives for every interactive element (Button, Input, Select, Dialog, Sheet, Accordion, Badge, Card, Textarea). Do not construct raw HTML replacements for elements that exist in Shadcn.

# 3. Design Tokens (Light, Black, Accent)
The visual language is white surfaces, black text, and one accent, `#159DD4`:
- App Canvas: `bg-white`
- Surface / Cards / Dialogs: `bg-white`
- Elevated / Active / Hover States: `bg-neutral-100`
- Structural Borders: `border-neutral-200`
- Primary Accent (filled actions only): `bg-[#159DD4] hover:bg-[#1288b8] text-white border-[#159DD4]`
- Text accent (profit, Výmena badge): `#0B6E96` — never use `#159DD4` as small text on white
- Negative numbers and errors: `text-red-700`
- Geometry / Radii: Use the shadcn radius (`rounded-lg` / `rounded-xl` from `--radius`). Do not flatten components with `rounded-none`.
- Depth: 1px strokes (`border border-neutral-200`). The sticky header may use `backdrop-blur`.

# 4. Typography
Font is Inter only. Import it via `next/font` as `--font-sans`. Do not use `font-mono` in workshop UI. Numbers use `tabular-nums`.

Use the roles from `components/workshop/styles.ts`:

- Brand: `text-lg font-bold text-black` — Autopedant
- Title: `text-base font-semibold text-black` — EČV, dialog titles
- Body: `text-sm font-normal text-black` — names, notes, part names
- Label: `text-sm font-medium text-neutral-700` — field and stat labels
- Meta: `text-sm font-normal text-neutral-700` — VIN, dates, help
- Number: `text-sm font-semibold text-black tabular-nums text-right`
- Profit: `text-sm font-semibold text-[#0B6E96] tabular-nums text-right`
- Negative: `text-sm font-semibold text-red-700 tabular-nums text-right`
- Error: `text-sm font-semibold text-red-700`
- Placeholder: `placeholder:text-neutral-600`

# 5. Domain Patterns for Auto Service Records

## Action Type Badges:
- "Výmena": `border border-[#0B6E96]/30 bg-[#159DD4]/10 text-sm font-medium text-[#0B6E96]`
- "Oprava": `border border-neutral-300 bg-neutral-100 text-sm font-medium text-black`
- "Kontrola": `border border-dashed border-neutral-300 bg-white text-sm font-medium text-neutral-700`
- "Nastavenie": `border border-neutral-300 bg-white text-sm font-medium text-black`

## Data Scanning & Layout:
- All monetary and numerical values must be right-aligned with `tabular-nums`.
- All text labels and descriptions must be left-aligned (`text-left`).
- Context Header: Must be sticky (`sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200`).
- Spacing Scale: Strictly adhere to a 4px grid (`p-2`, `p-4`, `p-6`, `gap-4`).

# 6. Localization
- All customer- and mechanic-facing text, button labels, placeholders, and error messages MUST be in Slovak.

# 7. Pre-Execution Self-Audit
Before outputting code, verify that:
1. Surfaces stay white and text stays black. Filled actions use `#159DD4`. Small accent text uses `#0B6E96`.
2. Interactive surfaces keep a radius. `rounded-none` is not used to flatten shadcn components.
3. Every button, input, and modal uses Shadcn UI.
4. Typography uses Inter roles from `styles.ts`. No `font-mono`. No `neutral-400` or `neutral-500` text.
