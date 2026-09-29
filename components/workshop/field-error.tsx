import { typeError } from "@/components/workshop/styles"

export function FieldError({
  id,
  children,
}: {
  id: string
  children?: string
}) {
  if (!children) {
    return null
  }

  return (
    <p id={id} className={typeError} role="alert" tabIndex={-1}>
      {children}
    </p>
  )
}

export function fieldDescribedBy(id: string, error?: string) {
  return error ? id : undefined
}

export function focusControl(id: string) {
  let attempts = 0
  const tryFocus = () => {
    const node = document.getElementById(id)
    if (node) {
      node.focus()
      return
    }

    attempts += 1
    if (attempts < 4) {
      requestAnimationFrame(tryFocus)
    }
  }

  requestAnimationFrame(tryFocus)
}
