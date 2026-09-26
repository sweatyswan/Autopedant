"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"

import { canvasClass } from "@/components/workshop/styles"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

type AuthContextValue = {
  configured: boolean
  ready: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>
  signUp: (email: string, password: string) => Promise<{ ok: true; confirm: boolean } | { ok: false; message: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [ready, setReady] = useState(!configured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const client = getSupabase()
    if (!client) {
      setReady(true)
      return
    }

    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) {
        return
      }
      setSession(data.session)
      setReady(true)
    })

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      session,
      async signIn(email, password) {
        const client = getSupabase()
        if (!client) {
          return { ok: false as const, message: "Cloud nie je nastavený." }
        }

        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          return { ok: false as const, message: "Prihlásenie sa nepodarilo." }
        }

        return { ok: true as const }
      },
      async signUp(email, password) {
        const client = getSupabase()
        if (!client) {
          return { ok: false as const, message: "Cloud nie je nastavený." }
        }

        const { data, error } = await client.auth.signUp({ email: email.trim(), password })
        if (error) {
          return { ok: false as const, message: "Účet sa nepodarilo vytvoriť." }
        }

        return { ok: true as const, confirm: !data.session }
      },
      async signOut() {
        await getSupabase()?.auth.signOut()
      },
    }),
    [configured, ready, session]
  )

  return (
    <AuthContext.Provider value={value}>
      {ready ? children : <div className={`min-h-svh ${canvasClass}`} />}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("AuthProvider chýba.")
  }

  return context
}
