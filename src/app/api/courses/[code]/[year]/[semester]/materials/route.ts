import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { loadMaterialsOutline } from "@/lib/materials/access"

/** Teaching Materials by Teaching Plan week — anyone linked, shaped for the viewer (#109). */
export const GET = courseRoute({}, async (_req, auth) => {
  const { outline } = await loadMaterialsOutline(getDb(), auth.course, auth)
  return NextResponse.json(outline)
})
