import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { materialNotFound, materialRef, parseMaterialAddress } from "@/lib/materials/params"
import {
  ATTACHMENT_LIMIT_ERROR,
  checkUpload,
  isAtAttachmentLimit,
  MAX_ATTACHMENT_BYTES,
  nameTakenError,
  UPLOAD_ERRORS,
  type UploadRefusal,
} from "@/lib/materials/attachments/policy"
import {
  createAttachment,
  findMaterialId,
  listAttachments,
  replaceAttachment,
  type AttachmentFile,
} from "@/lib/materials/attachments/repository"
import { putFile } from "@/lib/materials/attachments/store"
import { sweepAttachmentsQuietly } from "@/lib/materials/attachments/sweep"

type Params = { code: string; year: string; semester: string; week: string; kind: string }

const REFUSAL_STATUS: Record<UploadRefusal, number> = { name: 400, type: 400, size: 413 }
// Room for the multipart envelope around a file at the size limit.
const MAX_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 1024 * 1024

const refuse = (status: number, reason: string, error: string) => NextResponse.json({ reason, error }, { status })

/**
 * Attach one file (multipart field `file`) to a saved Teaching Material (#114) —
 * Instructor/Admin of this course; takes effect at once, no body save needed.
 * A name the Material already has is refused (409 `name-taken`, so the UI can
 * ask) unless `replace=true`: then that Attachment points at the new bytes —
 * same id and name, so references to it keep working (#115).
 */
export const POST = courseRoute<Params>({ manage: true }, async (req: NextRequest, auth, params) => {
  const address = parseMaterialAddress(params.week, params.kind)
  if (!address) return materialNotFound()
  // Refuse an oversized upload before reading it.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return refuse(413, "size", UPLOAD_ERRORS.size)
  }
  const db = getDb()
  const materialId = await findMaterialId(db, auth.course, address)
  if (materialId === null) return materialNotFound()

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  const replace = form?.get("replace") === "true"
  if (!(file instanceof File)) return refuse(400, "file", "ไม่พบไฟล์ที่อัปโหลด")
  const check = checkUpload(file)
  if (!check.ok) return refuse(REFUSAL_STATUS[check.reason], check.reason, check.error)

  const existing = await listAttachments(db, auth.course, address)
  const replacing = existing.some((a) => a.name === check.name)
  if (replacing && !replace) return refuse(409, "name-taken", nameTakenError(check.name))
  // A replacement adds no file, so only a new name counts against the limit.
  if (!replacing && isAtAttachmentLimit(existing.length)) return refuse(409, "limit", ATTACHMENT_LIMIT_ERROR)

  const { sha256, size } = await putFile(new Uint8Array(await file.arrayBuffer()))
  const stored: AttachmentFile = { name: check.name, contentType: check.contentType, sizeBytes: size, sha256 }
  const attachment = replacing
    ? await replaceAttachment(db, materialId, stored, auth.user.id)
    : await createAttachment(db, materialId, stored, auth.user.id)
  // Lost a race: another request added or removed this name in between.
  if (!attachment) return refuse(409, "name-taken", nameTakenError(check.name))

  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "material.update",
    targetEmail: courseSlugString(auth.course),
    detail: `${replacing ? "replace" : "attach"} ${materialRef(address)} ${attachment.name}`,
  })
  // The replaced bytes may now be unreferenced.
  if (replacing) await sweepAttachmentsQuietly(db)
  return NextResponse.json({ attachment, replaced: replacing }, { status: replacing ? 200 : 201 })
})
