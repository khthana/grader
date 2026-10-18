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
import { createAttachment, findMaterialId, listAttachments } from "@/lib/materials/attachments/repository"
import { putFile } from "@/lib/materials/attachments/store"

type Params = { code: string; year: string; semester: string; week: string; kind: string }

const REFUSAL_STATUS: Record<UploadRefusal, number> = { name: 400, type: 400, size: 413 }
// Room for the multipart envelope around a file at the size limit.
const MAX_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 1024 * 1024

const refuse = (status: number, reason: string, error: string) => NextResponse.json({ reason, error }, { status })

/**
 * Attach one file (multipart field `file`) to a saved Teaching Material (#114) —
 * Instructor/Admin of this course; takes effect at once, no body save needed.
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

  const file = (await req.formData().catch(() => null))?.get("file")
  if (!(file instanceof File)) return refuse(400, "file", "ไม่พบไฟล์ที่อัปโหลด")
  const check = checkUpload(file)
  if (!check.ok) return refuse(REFUSAL_STATUS[check.reason], check.reason, check.error)

  const existing = await listAttachments(db, auth.course, address)
  if (existing.some((a) => a.name === check.name)) return refuse(409, "name-taken", nameTakenError(check.name))
  if (isAtAttachmentLimit(existing.length)) return refuse(409, "limit", ATTACHMENT_LIMIT_ERROR)

  const { sha256, size } = await putFile(new Uint8Array(await file.arrayBuffer()))
  const attachment = await createAttachment(
    db,
    materialId,
    { name: check.name, contentType: check.contentType, sizeBytes: size, sha256 },
    auth.user.id
  )
  if (!attachment) return refuse(409, "name-taken", nameTakenError(check.name))

  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "material.update",
    targetEmail: courseSlugString(auth.course),
    detail: `attach ${materialRef(address)} ${attachment.name}`,
  })
  return NextResponse.json({ attachment, replaced: false }, { status: 201 })
})
