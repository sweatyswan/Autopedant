"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  canvasClass,
  fieldClass,
  primaryButtonClass,
  quietButtonClass,
  surfaceClass,
  typeBody,
  typeCaption,
  typeDisplay,
  typeError,
  typeLabel,
  typeMeta,
} from "@/components/workshop/styles"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"in" | "up">("in")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) {
      return
    }

    setError("")
    setNotice("")
    setBusy(true)
    try {
      if (mode === "in") {
        const result = await signIn(email, password)
        if (!result.ok) {
          setError(result.message)
        }
        return
      }

      const result = await signUp(email, password)
      if (!result.ok) {
        setError(result.message)
        return
      }

      if (result.confirm) {
        setNotice("Na e-mail prišiel odkaz na potvrdenie účtu.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex min-h-svh items-center justify-center p-4", canvasClass)}>
      <div className={cn("w-full max-w-sm rounded-lg p-4", surfaceClass)}>
        <div className={typeDisplay}>Autopedant</div>
        <div className={cn(typeMeta, "mt-1")}>Prihlásenie do dielenskej evidencie</div>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <Label className={typeLabel} htmlFor="auth-email">
              E-mail
            </Label>
            <Input
              id="auth-email"
              className={fieldClass}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className={typeLabel} htmlFor="auth-password">
              Heslo
            </Label>
            <Input
              id="auth-password"
              className={fieldClass}
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          {error ? <p className={typeError}>{error}</p> : null}
          {notice ? <p className={typeBody}>{notice}</p> : null}
          <Button type="submit" className={primaryButtonClass} disabled={busy}>
            {mode === "in" ? "Prihlásiť sa" : "Vytvoriť účet"}
          </Button>
          <Button
            type="button"
            className={quietButtonClass}
            disabled={busy}
            onClick={() => {
              setError("")
              setNotice("")
              setMode(mode === "in" ? "up" : "in")
            }}
          >
            {mode === "in" ? "Nový účet" : "Už mám účet"}
          </Button>
          <p className={typeCaption}>Heslo má mať aspoň 6 znakov.</p>
        </form>
      </div>
    </div>
  )
}
