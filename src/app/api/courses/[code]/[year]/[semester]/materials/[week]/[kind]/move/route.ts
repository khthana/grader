import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { buildMoveDraft } from "@/lib/materials/draft"
import { materialNotFound, materialRef, parseMaterialAddress } from "@/lib/materials/params"
import { moveMaterial } from "@/lib/materials/repository"

type Params = { code: string; year: string; semester: string; week: string; kind: string }

/** Move one Teaching Material to another week (#111) — Instructor/Admin of this course. */
export const POST = courseRoute<Params>({ manage: true }, async (req: NextRequest, auth, params) => {
  const address = parseMaterialAddress(params.week, params.kind)
  if (!address) return materialNotFound()
  const result = buildMoveDraft(await req.json().catch(() => null))
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })

  const db = getDb()
  const moved = await moveMaterial(db, auth.course, address, result.weekNo)
  if (!moved.ok) {
    return moved.reason === "not-found"
      ? materialNotFound()
      : NextResponse.json({ error: `สัปดาห์ ${result.weekNo} มีเอกสารประเภทนี้อยู่แล้ว` }, { status: 409 })
  }
  if (moved.moved) {
    await safeLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "material.update",
      targetEmail: courseSlugString(auth.course),
      detail: `move ${materialRef(address)} → ${materialRef({ ...address, weekNo: result.weekNo })}`,
    })
  }
  return NextResponse.json({ material: moved.material })
})
