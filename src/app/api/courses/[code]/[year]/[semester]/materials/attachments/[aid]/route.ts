import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { loadAttachment } from "@/lib/materials/access"
import { attachmentHeaders } from "@/lib/materials/attachments/policy"
import { openFile } from "@/lib/materials/attachments/store"

type Params = { code: string; year: string; semester: string; aid: string }

/** One body for every Attachment a viewer can't reach, so a Student can't probe what exists. */
const attachmentNotFound = () => NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 })

/**
 * Download one Attachment (#114) — anyone linked who may see its Teaching
 * Material. Missing, another course's, an invisible Material's, or bytes gone
 * from disk: the same 404.
 */
export const GET = courseRoute<Params>({}, async (_req, auth, params) => {
  if (!/^\d+$/.test(params.aid)) return attachmentNotFound()
  const attachment = await loadAttachment(getDb(), auth.course, Number(params.aid), auth)
  if (!attachment) return attachmentNotFound()
  const body = await openFile(attachment.sha256)
  if (!body) return attachmentNotFound()
  return new NextResponse(body, { headers: attachmentHeaders(attachment) })
})
