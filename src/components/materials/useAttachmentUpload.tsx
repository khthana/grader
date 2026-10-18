"use client"

import { useState, type ReactNode } from "react"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { useToast } from "@/components/shell/ToastProvider"
import type { Attachment } from "@/lib/materials/attachments/repository"

export interface AttachmentUploader {
  /** Upload files one by one; a name the Material already has asks "แทนที่ไฟล์" first. Returns those that went in. */
  upload: (files: File[]) => Promise<Attachment[]>
  uploading: boolean
  /** The replace confirmation — render it once. */
  dialog: ReactNode
}

/**
 * Uploading into one Teaching Material (#114–#116) — shared by "แนบไฟล์" and
 * "แทรกรูป", so a name clash goes through the same replace confirmation.
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

  async function uploadOne(file: File): Promise<Attachment | null> {
    let { res, body } = await send(file, false)
    if (res?.status === 409 && body.reason === "name-taken") {
      if (!(await askReplace(file.name))) return null
      ;({ res, body } = await send(file, true))
    }
    if (!res?.ok) {
      notify("error", `${file.name}: ${body.error ?? "แนบไฟล์ไม่สำเร็จ"}`)
      return null
    }
    const attachment: Attachment = body.attachment
    onUploaded(attachment, body.replaced === true)
    if (body.replaced) notify("success", `แทนที่ไฟล์ ${attachment.name} แล้ว`)
    return attachment
  }

  // Busy for the whole batch, not file by file.
  async function upload(files: File[]): Promise<Attachment[]> {
    setUploading(true)
    try {
      const done: Attachment[] = []
      for (const file of files) {
        const attachment = await uploadOne(file)
        if (attachment) done.push(attachment)
      }
      return done
    } finally {
      setUploading(false)
    }
  }

  const dialog = replaceAsk && (
    <ConfirmDialog
      title="แทนที่ไฟล์"
      message={`มีไฟล์ชื่อ ${replaceAsk.name} อยู่แล้ว ต้องการแทนที่ไฟล์เดิมใช่หรือไม่? รูปหรือลิงก์ในเนื้อหาที่อ้างชื่อนี้จะใช้ไฟล์ใหม่`}
      confirmLabel="แทนที่"
      onConfirm={() => replaceAsk.answer(true)}
      onCancel={() => replaceAsk.answer(false)}
    />
  )

  return { upload, uploading, dialog }
}
