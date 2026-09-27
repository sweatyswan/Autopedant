"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { Eye, Paperclip, X } from "@keyline-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  fieldClass,
  iconSize,
  quietButtonClass,
  typeBody,
  typeCaption,
  typeError,
  typeMeta,
} from "@/components/workshop/styles"
import {
  deleteDiagnosticReport,
  diagnosticReportError,
  putDiagnosticReport,
  resolveDiagnosticReportUrl,
} from "@/lib/diagnostic-report"
import type { DraftItem } from "@/lib/record-draft"
import { cn } from "@/lib/utils"

type ReportRef = {
  id?: string
  name?: string
  path?: string
}

export function DiagnosticReportField({
  item,
  onChange,
}: {
  item: DraftItem
  onChange: (patch: Partial<DraftItem>) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  function setDragActive(next: boolean) {
    dragDepth.current = next ? dragDepth.current + 1 : dragDepth.current - 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
      return
    }

    setDragging(true)
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "copy"
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragging(false)
    const file = event.dataTransfer.files.item(0)
    if (file) {
      void attach(file)
    }
  }

  async function attach(file: File) {
    const problem = diagnosticReportError(file)
    if (problem) {
      setError(problem)
      return
    }

    const id = item.diagnosticReportId || item.key
    await putDiagnosticReport(id, file, file.name)
    onChange({
      diagnosticReportId: id,
      diagnosticReportName: file.name,
    })
    setError("")
  }

  async function remove() {
    if (item.diagnosticReportId) {
      await deleteDiagnosticReport(item.diagnosticReportId)
    }
    onChange({
      diagnosticReportId: "",
      diagnosticReportName: "",
      diagnosticReportPath: "",
    })
    setError("")
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div
      className="mt-3 flex min-w-0 flex-col gap-1 text-left"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={typeCaption}>Diagnostický report</div>
      {item.diagnosticReportName ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg",
            dragging && "bg-[#c5e6f2] ring-1 ring-[#0F7AAB]"
          )}
        >
          <DiagnosticReportPreviewButton
            report={{
              id: item.diagnosticReportId,
              name: item.diagnosticReportName,
              path: item.diagnosticReportPath,
            }}
          />
          <div className={cn(typeBody, "min-w-0 truncate")}>{item.diagnosticReportName}</div>
          <Button
            type="button"
            className={cn(quietButtonClass, "px-2")}
            aria-label="Odstrániť report"
            onClick={() => {
              void remove()
            }}
          >
            <X size={iconSize} />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className={cn(
            quietButtonClass,
            fieldClass,
            "w-fit",
            dragging && "border-[#0F7AAB] bg-[#c5e6f2] text-[#095A7C]"
          )}
          aria-label="Priložiť PDF alebo ho presuňte sem"
          onClick={() => inputRef.current?.click()}
        >
          Priložiť PDF
          <Paperclip size={iconSize} />
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void attach(file)
          }
        }}
      />
      {error ? <p className={typeError}>{error}</p> : null}
    </div>
  )
}

export function DiagnosticReportView({ report }: { report: ReportRef }) {
  if (!report.name) {
    return null
  }

  return (
    <div className="mt-3 min-w-0 text-left">
      <div className={typeCaption}>Diagnostický report</div>
      <div className="flex min-w-0 items-center gap-2">
        <DiagnosticReportPreviewButton report={report} />
        <div className={cn(typeBody, "min-w-0 truncate")}>{report.name}</div>
      </div>
    </div>
  )
}

function DiagnosticReportPreviewButton({ report }: { report: ReportRef }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState("")
  const objectUrl = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current)
      }
    }
  }, [])

  async function openPreview() {
    setError("")
    setOpen(true)
    if (url) {
      return
    }

    const next = await resolveDiagnosticReportUrl(report.id, report.path)
    if (!next) {
      setError("Report sa nepodarilo otvoriť.")
      return
    }

    if (next.startsWith("blob:")) {
      objectUrl.current = next
    }
    setUrl(next)
  }

  return (
    <>
      <Button
        type="button"
        className={quietButtonClass}
        onClick={() => {
          void openPreview()
        }}
      >
        Náhľad
        <Eye size={iconSize} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex h-[min(88vh,52rem)] w-[min(64rem,calc(100%-2rem))] max-w-none flex-col gap-3 sm:max-w-none"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Diagnostický report</DialogTitle>
            <DialogDescription className={typeMeta}>{report.name}</DialogDescription>
          </DialogHeader>
          {error ? <p className={typeError}>{error}</p> : null}
          {url ? (
            <iframe title={report.name || "Diagnostický report"} src={url} className="min-h-0 flex-1 rounded-lg bg-white" />
          ) : error ? null : (
            <p className={typeMeta}>Načítava sa náhľad.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
