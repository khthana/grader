import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  getEnrollmentByUser,
  updateEnrollment,
  deleteEnrollment,
} from "@/lib/enrollments/repository"
import { validateEnrollInput } from "@/lib/enrollments/validation"
import { updateUserName, getUserById } from "@/lib/users/repository"
import { safeLog } from "@/lib/logs"

export const PUT = courseRoute<{ code: string; year: string; semester: string; userId: string }>(
  { mutate: true },
  async (request, auth, { userId: userIdParam }) => {
    const { user, course } = auth

    const db = getDb()
    const targetUserId = Number.parseInt(userIdParam, 10)
    const enrollment = Number.isFinite(targetUserId)
      ? await getEnrollmentByUser(db, course, targetUserId)
      : null
    if (!enrollment) {
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

    const { valid, errors } = validateEnrollInput({
      idCode: "ignored",
      firstNameTh: body.firstNameTh ?? "",
      lastNameTh: body.lastNameTh ?? "",
    })
    if (!valid) {
      delete errors.idCode
      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ errors }, { status: 400 })
      }
    }

    await updateEnrollment(db, course, targetUserId, {
      studyGroup: body.studyGroup ?? null,
      program: body.program ?? null,
      year: body.year ?? null,
    })

    const name = `${(body.firstNameTh ?? "").trim()} ${(body.lastNameTh ?? "").trim()}`.trim()
    await updateUserName(db, targetUserId, {
      name,
      titleTh: body.titleTh ?? null,
      firstNameTh: body.firstNameTh ?? null,
      lastNameTh: body.lastNameTh ?? null,
    })

    await safeLog(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "enrollment.update",
      targetId: targetUserId,
    })

    return NextResponse.json({ ok: true })
  }
)

export const DELETE = courseRoute<{ code: string; year: string; semester: string; userId: string }>(
  { mutate: true },
  async (_request, auth, { userId: userIdParam }) => {
    const { user, course } = auth

    const db = getDb()
    const targetUserId = Number.parseInt(userIdParam, 10)
    const enrollment = Number.isFinite(targetUserId)
      ? await getEnrollmentByUser(db, course, targetUserId)
      : null
    if (!enrollment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const target = await getUserById(db, targetUserId)
    await deleteEnrollment(db, course, targetUserId)

    await safeLog(db, {
      actorId: user.id,
      actorEmail: user.email,
      action: "enrollment.remove",
      targetId: targetUserId,
      targetEmail: target?.email ?? null,
    })

    return NextResponse.json({ ok: true })
  }
)
