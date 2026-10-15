import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { listCourseInstructors, createCourse } from "@/lib/courses/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { PoolLike } from "@/lib/db"
import type { CourseFixture, Queryable } from "@/lib/test-support/db"
import { seedQuiz } from "@/lib/test-support/quiz"

describe("POST /api/courses/[code]/[year]/[semester]/duplicate", () => {
  let f: CourseFixture
  let studentSession: string

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/duplicate`,
      { method: "POST", body: JSON.stringify(body) }
    )
    if (session) r.cookies.set("session", session)
    return r
  }

  function ctx() {
    return {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
      }),
    }
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const student = await createUser(f.db, { email: "stu@kmitl.ac.th", name: "Stu" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    studentSession = sessionFor("stu@kmitl.ac.th")
  })

  afterEach(() => setTestDb(null))

  it("Instructor duplicates the offering — 201 with copied weeks and instructors", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.course.semester).toBe(2)

    const target = { code: f.course.code, year: f.course.year, semester: 2 }
    expect(await listWeeks(f.db, target)).toHaveLength(6)
    const staff = await listCourseInstructors(f.db, target)
    expect(staff.map((s) => s.id)).toContain(f.ins.id)
  })

  it("forbids a TA (not a course manager) — 403", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ta.email)), ctx())
    expect(res.status).toBe(403)
  })

  it("forbids an enrolled Student — 403", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, studentSession), ctx())
    expect(res.status).toBe(403)
  })

  it("rejects an unauthenticated request — 401", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }), ctx())
    expect(res.status).toBe(401)
  })

  it("returns 409 when the target offering already exists", async () => {
    await createCourse(f.db, {
      code: f.course.code,
      year: f.course.year,
      semester: 2,
      nameTh: "ของเดิม",
      nameEn: "Existing",
    })
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(409)
  })

  it("returns 400 for an invalid target semester", async () => {
    const res = await POST(req({ year: f.course.year, semester: 5 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(400)
  })

  it("returns 400 when the target equals the source", async () => {
    const res = await POST(
      req({ year: f.course.year, semester: f.course.semester }, sessionFor(f.ins.email)),
      ctx()
    )
    expect(res.status).toBe(400)
  })

  it("copies inside one transaction — a failure part-way (copying Quiz questions) rolls back", async () => {
    // pg-mem accepts BEGIN / ROLLBACK but doesn't undo writes, so "nothing left
    // behind" can't be read back from the DB. Instead: every write must run on the
    // transaction's connection, and the failure must end it with ROLLBACK.
    await seedQuiz(f.db, f.course)
    const real = f.db as Queryable & PoolLike
    const log: [via: "pool" | "tx", sql: string][] = []
    const recording = {
      query: (text: string, params?: unknown[]) => {
        log.push(["pool", text])
        return real.query(text, params)
      },
      connect: async () => {
        const client = await real.connect()
        return {
          query: (text: string, params?: unknown[]) => {
            log.push(["tx", text])
            if (/INSERT INTO quiz_questions/.test(text)) throw new Error("boom")
            return client.query(text, params)
          },
          release: () => client.release(),
        }
      },
    }
    setTestDb(recording as unknown as Queryable)

    await expect(POST(req({ year: 2568, semester: 1 }, sessionFor(f.ins.email)), ctx())).rejects.toThrow("boom")

    const tx = log.filter(([via]) => via === "tx").map(([, sql]) => sql.trim().split(/\s+/).slice(0, 3).join(" "))
    expect(tx[0]).toBe("BEGIN")
    expect(tx).toContain("INSERT INTO courses")
    expect(tx).toContain("INSERT INTO quizzes")
    expect(tx.at(-1)).toBe("ROLLBACK")
    expect(tx).not.toContain("COMMIT")
    // Every write went through the transaction's connection, none through the pool.
    expect(log.filter(([via, sql]) => via === "pool" && /^\s*(INSERT|UPDATE|DELETE)/i.test(sql))).toEqual([])
  })
})
