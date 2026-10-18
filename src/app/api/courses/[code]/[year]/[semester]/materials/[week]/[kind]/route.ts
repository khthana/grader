import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { loadMaterial } from "@/lib/materials/access"
import { buildMaterialDraft } from "@/lib/materials/draft"
import { materialNotFound, parseMaterialAddress } from "@/lib/materials/params"
import { saveMaterial } from "@/lib/materials/repository"

type Params = { code: string; year: string; semester: string; week: string; kind: string }

/** One Teaching Material with its live heading (null = Unplanned) — anyone linked (#109). */
export const GET = courseRoute<Params>({}, async (_req, auth, params) => {
  const address = parseMaterialAddress(params.week, params.kind)
  if (!address) return materialNotFound()
  const { material, heading } = await loadMaterial(getDb(), auth.course, address, auth)
  if (!material) return materialNotFound()
  return NextResponse.json({ material, heading })
})

/** Write the body — the first save creates it, unpublished (Instructor/Admin of this course). */
export const PUT = courseRoute<Params>({ manage: true }, async (req: NextRequest, auth, params) => {
  const address = parseMaterialAddress(params.week, params.kind)
  if (!address) return materialNotFound()
  const result = buildMaterialDraft(await req.json().catch(() => null))
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })

  const db = getDb()
  const material = await saveMaterial(db, auth.course, address, result.draft.body, auth.user.id)
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "material.update",
    targetEmail: courseSlugString(auth.course),
  })
  return NextResponse.json({ material })
})
