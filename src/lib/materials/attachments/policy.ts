// Attachment policy (#114, ADR 0013) — the one place that says which files a
// Teaching Material accepts and how a stored one is served. Pure.

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_MATERIAL = 20
export const MAX_ATTACHMENT_NAME_LENGTH = 200

const TEXT = "; charset=utf-8"

/** The allow-list: extension → the content type it is served with. No svg, no executables. */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: `text/csv${TEXT}`,
  txt: `text/plain${TEXT}`,
  md: `text/markdown${TEXT}`,
  py: `text/x-python${TEXT}`,
  c: `text/x-c${TEXT}`,
  cpp: `text/x-c++src${TEXT}`,
  h: `text/x-c${TEXT}`,
  ipynb: "application/x-ipynb+json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
}

/** For a file input's `accept`. */
export const ATTACHMENT_ACCEPT = Object.keys(TYPES).map((ext) => `.${ext}`).join(",")

/** For "แทรกรูป"'s file input (#116): the allowed types that show inline. */
export const IMAGE_ACCEPT = Object.entries(TYPES)
  .filter(([, type]) => type.startsWith("image/"))
  .map(([ext]) => `.${ext}`)
  .join(",")

const MB = 1024 * 1024
/** Why an upload is refused, as shown to staff. */
export const UPLOAD_ERRORS = {
  name: "ชื่อไฟล์ไม่ถูกต้อง",
  type: `ไม่รับไฟล์ชนิดนี้ (รับ ${Object.keys(TYPES).join(" ")})`,
  size: `ไฟล์ใหญ่เกิน ${MAX_ATTACHMENT_BYTES / MB} MB`,
} as const

export type UploadRefusal = keyof typeof UPLOAD_ERRORS

export type UploadCheck =
  | { ok: true; name: string; contentType: string }
  | { ok: false; reason: UploadRefusal; error: string }

const refuse = (reason: UploadRefusal): UploadCheck => ({ ok: false, reason, error: UPLOAD_ERRORS[reason] })

/** The file name as stored (any path stripped, trimmed), its served type — or why it is refused. */
export function checkUpload(file: { name: string; size: number }): UploadCheck {
  const name = (file.name.split(/[\\/]/).pop() ?? "").trim()
  if (!name || name.length > MAX_ATTACHMENT_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(name)) return refuse("name")
  const dot = name.lastIndexOf(".")
  const contentType = dot > 0 ? TYPES[name.slice(dot + 1).toLowerCase()] : undefined
  if (!contentType) return refuse("type")
  if (file.size > MAX_ATTACHMENT_BYTES) return refuse("size")
  return { ok: true, name, contentType }
}

/** A Material already holding this many Attachments takes no new one. */
export const isAtAttachmentLimit = (count: number) => count >= MAX_ATTACHMENTS_PER_MATERIAL

export const ATTACHMENT_LIMIT_ERROR = `แนบได้ไม่เกิน ${MAX_ATTACHMENTS_PER_MATERIAL} ไฟล์ต่อเอกสาร`

/** File names are unique within one Material (ADR 0013). */
export const nameTakenError = (name: string) => `มีไฟล์ชื่อ ${name} อยู่แล้ว`

const isImageType = (contentType: string) => contentType.startsWith("image/")

// RFC 5987 attr-char leaves out ' ( ) * , which encodeURIComponent keeps.
const encodeRfc5987 = (name: string) =>
  encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/**
 * Response headers for a stored Attachment: an image shows inline (in the
 * Material's text), anything else always downloads — never rendered as a page
 * of this site. `nosniff` stops a browser second-guessing the stored type.
 */
export function attachmentHeaders(a: { name: string; contentType: string; sizeBytes: number }): Record<string, string> {
  const fallback = a.name.replace(/[^\x20-\x7e]|["\\]/g, "_")
  const disposition = isImageType(a.contentType) ? "inline" : "attachment"
  return {
    "Content-Type": a.contentType,
    "Content-Length": String(a.sizeBytes),
    "Content-Disposition": `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(a.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
  }
}
