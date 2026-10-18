"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { FaEdit, FaPaperclip, FaPlus, FaTrash } from "react-icons/fa"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { materialKindLabel, type MaterialKind } from "@/lib/materials/kinds"
import type { OutlineAttachment, OutlineMaterial } from "@/lib/materials/outline"
import type { StudentOutlineMaterial } from "@/lib/materials/student-view"
import { attachmentUrl } from "@/lib/materials/attachments/references"
import { ATTACHMENT_ACCEPT, formatAttachmentSize } from "@/lib/materials/attachments/policy"
import { UnpublishedBadge } from "./UnpublishedBadge"
import { useAttachmentUpload } from "./useAttachmentUpload"
import { useMaterialRequests } from "./useMaterialRequests"

/**
 * One cell of the Teaching Materials table (#120): the Material's Attachments
 * as download links and "อ่าน" when it has text. A manager also runs the cell
 * from here (#121) — attach files (into an empty planned cell too: the upload
 * creates the Material), switch publishing, delete an Attachment — and the table
 * refreshes in place after each.
 */
export function MaterialCell({
  courseSlug,
  coursePath,
  weekNo,
  kind,
  material,
  canEdit,
  planned,
}: {
  courseSlug: string
  coursePath: string
  weekNo: number
  kind: MaterialKind
  material: OutlineMaterial | StudentOutlineMaterial | undefined
  canEdit: boolean
  /** A Teaching Plan week — only there does an empty cell offer anything (#118: a Material starts in a planned week). */
  planned: boolean
}) {
  const href = `${coursePath}/materials/${weekNo}/${kind}`
  const label = `${materialKindLabel(kind)} สัปดาห์ ${weekNo}`

  if (!material) {
    if (!canEdit || !planned) return <Dash />
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-secondary"
          aria-label={`สร้าง${label}`}
        >
          <FaPlus className="h-2.5 w-2.5" />
          สร้าง
        </Link>
        <CellControls courseSlug={courseSlug} weekNo={weekNo} kind={kind} label={label} />
      </div>
    )
  }

  const published = "isPublished" in material ? material.isPublished : null
  const unpublished = published === false
  const actions = material.hasText || unpublished || canEdit
  if (material.attachments.length === 0 && !actions) return <Dash />
  return (
    <div className="flex flex-col items-start gap-1">
      {material.attachments.map((a) =>
        canEdit ? (
          <ManagedAttachment key={a.id} courseSlug={courseSlug} attachment={a} />
        ) : (
          <AttachmentLink key={a.id} courseSlug={courseSlug} attachment={a} />
        )
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {material.hasText && (
            <Link href={href} className="text-secondary hover:underline">
              อ่าน
            </Link>
          )}
          {canEdit && published !== null ? (
            <CellControls courseSlug={courseSlug} weekNo={weekNo} kind={kind} label={label} published={published} href={href} />
          ) : (
            unpublished && <UnpublishedBadge />
          )}
        </div>
      )}
    </div>
  )
}

function Dash() {
  return <span className="text-slate-300">—</span>
}

function AttachmentLink({ courseSlug, attachment }: { courseSlug: string; attachment: OutlineAttachment }) {
  return (
    <a
      href={attachmentUrl(courseSlug, attachment.id)}
      title={formatAttachmentSize(attachment.sizeBytes)}
      className="inline-flex max-w-full items-start gap-1.5 break-all text-secondary hover:underline"
    >
      <FaPaperclip className="mt-1 h-3 w-3 shrink-0 text-slate-400" />
      {attachment.name}
    </a>
  )
}

// An Attachment with its delete icon (#121), after ConfirmDialog.
function ManagedAttachment({ courseSlug, attachment }: { courseSlug: string; attachment: OutlineAttachment }) {
  const router = useRouter()
  const { removeAttachment } = useMaterialRequests(courseSlug)
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    setDeleting(true)
    const removed = await removeAttachment(attachment)
    setDeleting(false)
    setAsking(false)
    if (removed) router.refresh()
  }

  return (
    <span className="inline-flex max-w-full items-start gap-2">
      <AttachmentLink courseSlug={courseSlug} attachment={attachment} />
      <button
        onClick={() => setAsking(true)}
        aria-label={`ลบไฟล์ ${attachment.name}`}
        className="mt-1 shrink-0 text-slate-300 transition hover:text-red-600"
      >
        <FaTrash className="h-3 w-3" />
      </button>
      {asking && (
        <ConfirmDialog
          title="ลบไฟล์แนบ"
          message={`ต้องการลบไฟล์ ${attachment.name} ใช่หรือไม่?`}
          onConfirm={remove}
          onCancel={() => setAsking(false)}
          busy={deleting}
        />
      )}
    </span>
  )
}

// A manager's controls for one cell (#121): attach (several files at once,
// through the shared upload hook), and — once the Material exists — the
// publish switch and the edit icon.
function CellControls({
  courseSlug,
  weekNo,
  kind,
  label,
  published,
  href,
}: {
  courseSlug: string
  weekNo: number
  kind: MaterialKind
  label: string
  published?: boolean
  href?: string
}) {
  const router = useRouter()
  const { setPublished } = useMaterialRequests(courseSlug)
  const input = useRef<HTMLInputElement>(null)
  const [switching, setSwitching] = useState(false)
  const apiPath = `/api/courses/${courseSlug}/materials/${weekNo}/${kind}`
  const uploader = useAttachmentUpload(apiPath, () => {})

  async function attach(files: FileList) {
    await uploader.upload(Array.from(files))
    if (input.current) input.current.value = ""
    router.refresh()
  }

  async function togglePublished() {
    setSwitching(true)
    const saved = await setPublished(apiPath, !published)
    setSwitching(false)
    if (saved) router.refresh()
  }

  return (
    <>
      {published !== undefined && (
        <button
          role="switch"
          aria-checked={published}
          aria-label={`เผยแพร่${label}`}
          onClick={togglePublished}
          disabled={switching}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs transition disabled:opacity-60 ${
            published ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${published ? "bg-green-500" : "bg-amber-400"}`} />
          {published ? "เผยแพร่แล้ว" : "ยังไม่เผยแพร่"}
        </button>
      )}
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
        disabled={uploader.uploading}
        aria-label={`แนบไฟล์${label}`}
        title="แนบไฟล์"
        className="text-slate-400 transition hover:text-secondary disabled:opacity-60"
      >
        <FaPaperclip className={`h-3.5 w-3.5 ${uploader.uploading ? "animate-pulse" : ""}`} />
      </button>
      {href && (
        <Link href={href} className="text-slate-400 transition hover:text-secondary" aria-label={`แก้ไข${label}`} title="แก้ไข">
          <FaEdit className="h-3.5 w-3.5" />
        </Link>
      )}
      {uploader.dialog}
    </>
  )
}
