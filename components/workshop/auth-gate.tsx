"use client"

import type { ReactNode } from "react"

import { AuthScreen } from "@/components/workshop/auth-screen"
import { useAuth } from "@/lib/auth-context"

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, session } = useAuth()

  if (configured && !session) {
    return <AuthScreen />
  }

  return children
}
