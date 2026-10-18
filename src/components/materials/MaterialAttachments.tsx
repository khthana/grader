"use client"

import { useRef, useState } from "react"
import { FaPaperclip } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { ATTACHMENT_ACCEPT } from "@/lib/materials/attachments/policy"
import type { Attachment } from "@/lib/materials/attachments/repository"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A Teaching Material's Attachments (#114): listed under its content for every
 * viewer, in upload order. A manager attaches files once the Material has been
 * saved — each upload takes effect at once, no body save needed.
 */
export function MaterialAttachments({
  courseSlug,
  materialApiPath,
  attachments,
  onAttached,
  canEdit,
  saved,
}: {
  courseSlug: string
  /** The Material's API path; uploads go to `…/attachments`. */
  materialApiPath: string
  attachments: Attachment[]
  onAttached: (attachment: Attachment) => void
  canEdit: boolean
  /** Whether the Material exists yet — only a saved one takes Attachments. */
  saved: boolean
}) {
  const { notify } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  if (!canEdit && attachments.length === 0) return null

  async function attach(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.set("file", file)
      const res = await fetch(`${materialApiPath}/attachments`, { method: "POST", body: form }).catch(() => null)
      const body = res ? await res.json().catch(() => ({})) : {}
      if (res?.ok) onAttached(body.attachment)
      else notify("error", `${file.name}: ${body.error ?? "แนบไฟล์ไม่สำเร็จ"}`)
    }
    setUploading(false)
    if (input.current) input.current.value = ""
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 print:rounded-none print:border-0 print:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-primary">ไฟล์แนบ</h2>
        {canEdit && saved && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files && attach(e.target.files)}
            />
            <button
              onClick={() => input.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 print:hidden"
            >
              <FaPaperclip className="h-3.5 w-3.5" />
              {uploading ? "กำลังแนบ..." : "แนบไฟล์"}
            </button>
          </>
        )}
      </div>
      {canEdit && !saved ? (
        <p className="mt-2 text-sm text-slate-400">บันทึกเอกสารก่อนจึงแนบไฟล์ได้</p>
      ) : attachments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-gray-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <a
                href={`/api/courses/${courseSlug}/materials/attachments/${a.id}`}
                download={a.name}
                className="break-all text-secondary hover:underline"
              >
                {a.name}
              </a>
              <span className="shrink-0 text-xs text-slate-400">{formatSize(a.sizeBytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
