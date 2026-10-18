import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { buildPublishDraft } from "@/lib/materials/draft"
import { materialNotFound, materialRef, parseMaterialAddress } from "@/lib/materials/params"
import { setMaterialPublished } from "@/lib/materials/repository"

type Params = { code: string; year: string; semester: string; week: string; kind: string }

/** Publish or unpublish one Teaching Material (#110) — Instructor/Admin of this course. */
export const PUT = courseRoute<Params>({ manage: true }, async (req: NextRequest, auth, params) => {
  const address = parseMaterialAddress(params.week, params.kind)
  if (!address) return materialNotFound()
  const result = buildPublishDraft(await req.json().catch(() => null))
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })

  const db = getDb()
  const material = await setMaterialPublished(db, auth.course, address, result.published)
  if (!material) return materialNotFound()
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "material.publish",
    targetEmail: courseSlugString(auth.course),
    detail: `${result.published ? "publish" : "unpublish"} ${materialRef(address)}`,
  })
  return NextResponse.json({ material })
})
