"use client"

import { useState } from "react"
import { Eye, EyeOff } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError, fieldDescribedBy, focusControl } from "@/components/workshop/field-error"
import {
  canvasClass,
  fieldClass,
  iconSize,
  primaryButtonClass,
  quietButtonClass,
  surfaceClass,
  typeBody,
  typeCaption,
  typeDisplay,
  typeLabel,
  typeMeta,
} from "@/components/workshop/styles"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type AuthField = "email" | "password" | "form"

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"in" | "up">("in")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({})
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  function clearField(field: AuthField) {
    setErrors((current) => {
      if (!current[field] && !current.form) {
        return current
      }

      const next = { ...current }
      delete next[field]
      delete next.form
      return next
    })
  }

  async function submit() {
    if (busy) {
      return
    }

    const nextErrors: Partial<Record<AuthField, string>> = {}
    if (!email.trim()) {
      nextErrors.email = "Zadajte e-mail."
    }

    if (password.length < 6) {
      nextErrors.password = "Heslo má mať aspoň 6 znakov."
    }

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors)
      focusControl(nextErrors.email ? "auth-email" : "auth-password")
      return
    }

    setErrors({})
    setNotice("")
    setBusy(true)
    try {
      if (mode === "in") {
        const result = await signIn(email, password)
        if (!result.ok) {
          setErrors({ form: result.message })
          focusControl("auth-form-error")
        }
        return
      }

      const result = await signUp(email, password)
      if (!result.ok) {
        setErrors({ form: result.message })
        focusControl("auth-form-error")
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
        <h1 className={cn(typeDisplay, "m-0")}>Autopedant</h1>
        <div className={cn(typeMeta, "mt-1")}>Prihlásenie do dielenskej evidencie</div>

        <form
          className="mt-4 flex flex-col gap-4"
          method="dialog"
          noValidate
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
              type="text"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                clearField("email")
                setEmail(event.target.value)
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy("auth-email-error", errors.email)}
            />
            <FieldError id="auth-email-error">{errors.email}</FieldError>
          </div>
          <div className="flex flex-col gap-1">
            <Label className={typeLabel} htmlFor="auth-password">
              Heslo
            </Label>
            <div className="relative">
              <Input
                id="auth-password"
                className={cn(fieldClass, "pr-10")}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => {
                  clearField("password")
                  setPassword(event.target.value)
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={fieldDescribedBy("auth-password-error", errors.password)}
              />
              <Button
                type="button"
                className="absolute inset-y-0 right-0 h-full min-h-[32px] min-w-[32px] border-0 bg-transparent px-2 text-neutral-700 shadow-none hover:bg-transparent"
                aria-label={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
              </Button>
            </div>
            <FieldError id="auth-password-error">{errors.password}</FieldError>
          </div>
          <FieldError id="auth-form-error">{errors.form}</FieldError>
          {notice ? <p className={typeBody}>{notice}</p> : null}
          <Button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy
              ? mode === "in"
                ? "Prihlasujem sa…"
                : "Vytváram účet…"
              : mode === "in"
                ? "Prihlásiť sa"
                : "Vytvoriť účet"}
          </Button>
          <Button
            type="button"
            className={quietButtonClass}
            disabled={busy}
            onClick={() => {
              setErrors({})
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
