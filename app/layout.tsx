import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"
import { AuthGate } from "@/components/workshop/auth-gate"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { WorkshopProvider } from "@/lib/workshop-context"
import { canvasClass } from "@/components/workshop/styles"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://sweatyswan.github.io/Autopedant"),
  title: "Autopedant | Prehľad servisovaných vozidiel",
  description: "Servisná evidencia dielne. Vyhľadávanie podľa EČV a VIN, práca a zisk z dielov.",
  openGraph: {
    title: "Autopedant | Prehľad servisovaných vozidiel",
    description: "Servisná evidencia dielne. Vyhľadávanie podľa EČV a VIN, práca a zisk z dielov.",
    locale: "sk_SK",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="sk"
      suppressHydrationWarning
      className={cn(inter.variable)}
    >
      <body className={cn("min-h-svh font-sans text-black antialiased print:bg-white", canvasClass)}>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate>
              <WorkshopProvider>{children}</WorkshopProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
