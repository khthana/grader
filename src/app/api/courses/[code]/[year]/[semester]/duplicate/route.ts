import { NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { validateCourseOffering } from "@/lib/courses/validation"
import { duplicateCourseOffering } from "@/lib/courses/duplicate"

export const POST = courseRoute({ manage: true }, async (request, auth) => {
  const body = (await request.json().catch(() => null)) as
    | { year?: unknown; semester?: unknown }
    | null
  const year = Number(body?.year)
  const semester = Number(body?.semester)

  const { valid, errors } = validateCourseOffering(year, semester)
  if (!valid) {
    return NextResponse.json(
      { error: "ปีหรือภาคการศึกษาปลายทางไม่ถูกต้อง", errors },
      { status: 400 }
    )
  }

  const result = await withTransaction((tx) =>
    duplicateCourseOffering(tx, auth.course, { year, semester }, auth.user.id)
  )

  if (!result.ok) {
    if (result.reason === "target-exists") {
      return NextResponse.json(
        { error: "มีรายวิชาในปี/ภาคการศึกษานี้อยู่แล้ว" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "ปลายทางต้องเป็นปี/ภาคการศึกษาที่ต่างจากต้นทาง" },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { course: result.course, slug: courseSlugString(result.course) },
    { status: 201 }
  )
})
