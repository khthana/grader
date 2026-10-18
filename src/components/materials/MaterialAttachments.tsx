"use client"

import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { FaPaperclip, FaTrash } from "react-icons/fa"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
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
 * saved — each upload takes effect at once, no body save needed — replaces one
 * by uploading its name again (after confirming) and deletes one (#115).
 */
export function MaterialAttachments({
  courseSlug,
  materialApiPath,
  attachments,
  onChange,
  canEdit,
  saved,
}: {
  courseSlug: string
  /** The Material's API path; uploads go to `…/attachments`. */
  materialApiPath: string
  attachments: Attachment[]
  onChange: Dispatch<SetStateAction<Attachment[]>>
  canEdit: boolean
  /** Whether the Material exists yet — only a saved one takes Attachments. */
  saved: boolean
}) {
  const { notify } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [replaceAsk, setReplaceAsk] = useState<{ name: string; answer: (replace: boolean) => void } | null>(null)
  const [toDelete, setToDelete] = useState<Attachment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const attachmentPath = (id: number) => `/api/courses/${courseSlug}/materials/attachments/${id}`

  if (!canEdit && attachments.length === 0) return null

  const askReplace = (name: string) =>
    new Promise<boolean>((resolve) =>
      setReplaceAsk({
        name,
        answer: (replace) => {
          setReplaceAsk(null)
          resolve(replace)
        },
      })
    )

  async function send(file: File, replace: boolean) {
    const form = new FormData()
    form.set("file", file)
    if (replace) form.set("replace", "true")
    const res = await fetch(`${materialApiPath}/attachments`, { method: "POST", body: form }).catch(() => null)
    return { res, body: res ? await res.json().catch(() => ({})) : {} }
  }

  async function attach(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      let { res, body } = await send(file, false)
      if (res?.status === 409 && body.reason === "name-taken") {
        if (!(await askReplace(file.name))) continue
        ;({ res, body } = await send(file, true))
      }
      if (!res?.ok) {
        notify("error", `${file.name}: ${body.error ?? "แนบไฟล์ไม่สำเร็จ"}`)
        continue
      }
      const attachment: Attachment = body.attachment
      onChange((list) =>
        body.replaced ? list.map((a) => (a.id === attachment.id ? attachment : a)) : [...list, attachment]
      )
      if (body.replaced) notify("success", `แทนที่ไฟล์ ${attachment.name} แล้ว`)
    }
    setUploading(false)
    if (input.current) input.current.value = ""
  }

  async function remove(attachment: Attachment) {
    setDeleting(true)
    const res = await fetch(attachmentPath(attachment.id), { method: "DELETE" }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    setDeleting(false)
    setToDelete(null)
    if (res?.ok) {
      onChange((list) => list.filter((a) => a.id !== attachment.id))
      notify("success", `ลบไฟล์ ${attachment.name} แล้ว`)
    } else {
      notify("error", body.error ?? "ลบไฟล์ไม่สำเร็จ")
    }
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
              <a href={attachmentPath(a.id)} download={a.name} className="break-all text-secondary hover:underline">
                {a.name}
              </a>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-slate-400">{formatSize(a.sizeBytes)}</span>
                {canEdit && (
                  <button
                    onClick={() => setToDelete(a)}
                    aria-label={`ลบไฟล์ ${a.name}`}
                    className="text-slate-400 transition hover:text-red-600 print:hidden"
                  >
                    <FaTrash className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {replaceAsk && (
        <ConfirmDialog
          title="แทนที่ไฟล์"
          message={`มีไฟล์ชื่อ ${replaceAsk.name} อยู่แล้ว ต้องการแทนที่ไฟล์เดิมใช่หรือไม่? รูปหรือลิงก์ในเนื้อหาที่อ้างชื่อนี้จะใช้ไฟล์ใหม่`}
          confirmLabel="แทนที่"
          onConfirm={() => replaceAsk.answer(true)}
          onCancel={() => replaceAsk.answer(false)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="ลบไฟล์แนบ"
          message={`ต้องการลบไฟล์ ${toDelete.name} ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบไฟล์"
          onConfirm={() => remove(toDelete)}
          onCancel={() => setToDelete(null)}
          busy={deleting}
        />
      )}
    </section>
  )
}
