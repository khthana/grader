"use client"

import { useToast } from "@/components/shell/ToastProvider"
import { attachmentUrl } from "@/lib/materials/attachments/references"
import type { Material } from "@/lib/materials/repository"

/**
 * The manager requests both the Material page and the table's cells make
 * (#121) — publishing a Material and deleting one Attachment — with their
 * toasts, so the two never word or handle them differently.
 */
export function useMaterialRequests(courseSlug: string) {
  const { notify } = useToast()

  /** The Material as saved, or null when the switch failed. */
  async function setPublished(materialApiPath: string, published: boolean): Promise<Material | null> {
    const res = await fetch(`${materialApiPath}/publish`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) {
      notify("error", body.error ?? "เปลี่ยนสถานะไม่สำเร็จ")
      return null
    }
    notify("success", body.material.isPublished ? "เผยแพร่เอกสารแล้ว" : "เลิกเผยแพร่เอกสารแล้ว")
    return body.material
  }

  /** Whether the Attachment was deleted. */
  async function removeAttachment(attachment: { id: number; name: string }): Promise<boolean> {
    const res = await fetch(attachmentUrl(courseSlug, attachment.id), { method: "DELETE" }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) {
      notify("error", body.error ?? "ลบไฟล์ไม่สำเร็จ")
      return false
    }
    notify("success", `ลบไฟล์ ${attachment.name} แล้ว`)
    return true
  }

  return { setPublished, removeAttachment }
}
