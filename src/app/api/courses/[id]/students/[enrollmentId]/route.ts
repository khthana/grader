import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
} from "@/lib/enrollments/repository"
import { validateEnrollInput } from "@/lib/enrollments/validation"
import { updateUserName, getUserById } from "@/lib/users/repository"
import { safeLog } from "@/lib/logs"

// Edit a roster row: enrollment fields (group/program/year) + the shared user's
// prefix/name. รหัสนักศึกษา is read-only (any id_code in the body is ignored).
export const PUT = courseRoute<{ id: string; enrollmentId: string }>(
  { mutate: true },
  async (request, auth, { enrollmentId }) => {
    const { user, courseId } = auth

    const db = getDb()
    const eid = Number.parseInt(enrollmentId, 10)
    const enrollment = Number.isFinite(eid) ? await getEnrollmentById(db, eid) : null
    if (!enrollment || enrollment.courseId !== courseId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      titleTh?: string
      firstNameTh?: string
      lastNameTh?: string
      studyGroup?: string
      program?: string
      year?: string
    }

    // id_code is read-only here; reuse the roster field validation for the name.
    const { valid, errors } = validateEnrollInput({
      idCode: "ignored", // not editable on this route — satisfy the shared check
      firstNameTh: body.firstNameTh ?? "",
      lastNameTh: body.lastNameTh ?? "",
    })
    if (!valid) {
      delete errors.idCode
      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ errors }, { status: 400 })
      }
    }

    await updateEnrollment(db, enrollment.id, {
      studyGroup: body.studyGroup ?? null,
      program: body.program ?? null,
      year: body.year ?? null,
    })

    const name = `${(body.firstNameTh ?? "").trim()} ${(body.lastNameTh ?? "").trim()}`.trim()
    await updateUserName(db, enrollment.userId, {
      name,
      titleTh: body.titleTh ?? null,
      firstNameTh: body.firstNameTh ?? null,
      lastNameTh: body.lastNameTh ?? null,
    })

    await safeLog(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "enrollment.update",
      targetId: enrollment.userId,
    })

    return NextResponse.json({ ok: true })
  }
)

// Un-enroll: remove only the enrollment row. The user account and any
// other-course enrollments survive.
export const DELETE = courseRoute<{ id: string; enrollmentId: string }>(
  { mutate: true },
  async (_request, auth, { enrollmentId }) => {
    const { user, courseId } = auth

    const db = getDb()
    const eid = Number.parseInt(enrollmentId, 10)
    const enrollment = Number.isFinite(eid) ? await getEnrollmentById(db, eid) : null
    if (!enrollment || enrollment.courseId !== courseId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const target = await getUserById(db, enrollment.userId)
    await deleteEnrollment(db, enrollment.id)

    await safeLog(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "enrollment.remove",
      targetId: enrollment.userId,
      targetEmail: target?.email ?? null,
    })

    return NextResponse.json({ ok: true })
  }
)
