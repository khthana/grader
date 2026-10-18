"use client"

import { useState, type ReactNode } from "react"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { useToast } from "@/components/shell/ToastProvider"
import type { Attachment } from "@/lib/materials/attachments/repository"

export interface AttachmentUploader {
  /** Upload files one by one; a name the Material already has asks "แทนที่ไฟล์" first. */
  upload: (files: File[]) => Promise<void>
  uploading: boolean
  /** The replace confirmation — render it once. */
  dialog: ReactNode
}

/**
 * Uploading into one Teaching Material (#114–#115) — one place for the
 * replace confirmation a name clash goes through.
 * `onUploaded` gets the Attachment and whether it replaced one of the same id.
 */
export function useAttachmentUpload(
  materialApiPath: string,
  onUploaded: (attachment: Attachment, replaced: boolean) => void
): AttachmentUploader {
  const { notify } = useToast()
  const [uploading, setUploading] = useState(false)
  const [replaceAsk, setReplaceAsk] = useState<{ name: string; answer: (replace: boolean) => void } | null>(null)

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

  async function uploadOne(file: File) {
    let { res, body } = await send(file, false)
    if (res?.status === 409 && body.reason === "name-taken") {
      if (!(await askReplace(file.name))) return
      ;({ res, body } = await send(file, true))
    }
    if (!res?.ok) {
      notify("error", `${file.name}: ${body.error ?? "แนบไฟล์ไม่สำเร็จ"}`)
      return
    }
    const attachment: Attachment = body.attachment
    onUploaded(attachment, body.replaced === true)
    if (body.replaced) notify("success", `แทนที่ไฟล์ ${attachment.name} แล้ว`)
  }

  // Busy for the whole batch, not file by file.
  async function upload(files: File[]) {
    setUploading(true)
    try {
      for (const file of files) await uploadOne(file)
    } finally {
      setUploading(false)
    }
  }

  const dialog = replaceAsk && (
    <ConfirmDialog
      title="แทนที่ไฟล์"
      message={`มีไฟล์ชื่อ ${replaceAsk.name} อยู่แล้ว ต้องการแทนที่ไฟล์เดิมใช่หรือไม่? ลิงก์ในเนื้อหาที่อ้างชื่อนี้จะใช้ไฟล์ใหม่`}
      confirmLabel="แทนที่"
      onConfirm={() => replaceAsk.answer(true)}
      onCancel={() => replaceAsk.answer(false)}
    />
  )

  return { upload, uploading, dialog }
}
