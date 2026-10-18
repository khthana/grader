import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { loadAttachment } from "@/lib/materials/access"
import { materialRef } from "@/lib/materials/params"
import { deleteAttachment } from "@/lib/materials/attachments/repository"
import { sweepAttachmentsQuietly } from "@/lib/materials/attachments/sweep"
import { attachmentHeaders } from "@/lib/materials/attachments/policy"
import { openFile } from "@/lib/materials/attachments/store"

type Params = { code: string; year: string; semester: string; aid: string }

/** One body for every Attachment a viewer can't reach, so a Student can't probe what exists. */
const attachmentNotFound = () => NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 })

const parseAttachmentId = (aid: string) => (/^\d+$/.test(aid) ? Number(aid) : null)

/**
 * Download one Attachment (#114) — anyone linked who may see its Teaching
 * Material. Missing, another course's, an invisible Material's, or bytes gone
 * from disk: the same 404.
 */
export const GET = courseRoute<Params>({}, async (_req, auth, params) => {
  const id = parseAttachmentId(params.aid)
  if (id === null) return attachmentNotFound()
  const attachment = await loadAttachment(getDb(), auth.course, id, auth)
  if (!attachment) return attachmentNotFound()
  const body = await openFile(attachment.sha256)
  if (!body) return attachmentNotFound()
  return new NextResponse(body, { headers: attachmentHeaders(attachment) })
})

/** Delete one Attachment (#115) — Instructor/Admin of this course; the UI confirms first. */
export const DELETE = courseRoute<Params>({ manage: true }, async (_req, auth, params) => {
  const id = parseAttachmentId(params.aid)
  if (id === null) return attachmentNotFound()
  const db = getDb()
  const deleted = await deleteAttachment(db, auth.course, id)
  if (!deleted) return attachmentNotFound()
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "material.update",
    targetEmail: courseSlugString(auth.course),
    detail: `remove ${materialRef(deleted.material)} ${deleted.name}`,
  })
  await sweepAttachmentsQuietly(db)
  return NextResponse.json({ ok: true })
})
