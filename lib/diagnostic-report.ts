import { getSupabase } from "@/lib/supabase"

export const DIAGNOSTIC_REPORT_BUCKET = "diagnostic-reports"
export const DIAGNOSTIC_REPORT_MAX_BYTES = 8 * 1024 * 1024

const DB_NAME = "autopedant.reports.v1"
const STORE = "files"

type StoredReport = {
  id: string
  name: string
  blob: Blob
}

function openReportDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function diagnosticReportPath(userId: string, reportId: string) {
  return `${userId}/${reportId}.pdf`
}

export function diagnosticReportError(file: File) {
  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  if (!pdf) {
    return "Priložte súbor PDF."
  }

  if (file.size > DIAGNOSTIC_REPORT_MAX_BYTES) {
    return "PDF môže mať najviac 8 MB."
  }

  return ""
}

export async function putDiagnosticReport(id: string, file: Blob, name: string) {
  const db = await openReportDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put({ id, name, blob: file } satisfies StoredReport)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getDiagnosticReport(id: string) {
  const db = await openReportDb()
  const stored = await new Promise<StoredReport | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const request = tx.objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result as StoredReport | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return stored ?? null
}

export async function deleteDiagnosticReport(id: string) {
  const db = await openReportDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function resolveDiagnosticReportUrl(reportId?: string, path?: string) {
  if (reportId) {
    const local = await getDiagnosticReport(reportId)
    if (local) {
      return URL.createObjectURL(local.blob)
    }
  }

  if (!path) {
    return null
  }

  const client = getSupabase()
  if (!client) {
    return null
  }

  const { data, error } = await client.storage.from(DIAGNOSTIC_REPORT_BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}
