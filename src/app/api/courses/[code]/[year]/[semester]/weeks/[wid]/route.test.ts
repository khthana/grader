import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { listWeeks, seedWeeks } from "@/lib/weeks/repository"
import { createCourse } from "@/lib/courses/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("PUT /api/courses/[code]/[year]/[semester]/weeks/[wid]", () => {
  let f: CourseFixture
  let weekId: number

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/weeks/${weekId}`,
      { method: "PUT", body: JSON.stringify(body) }
    )
    r.cookies.set("session", session ?? sessionFor(f.ins.email))
    return r
  }

  function ctx() {
    return {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
        wid: String(weekId),
      }),
    }
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const weeks = await listWeeks(f.db, f.course)
    weekId = weeks[0].id
  })

  afterEach(() => setTestDb(null))

  it("{ isReleased: true } releases the week", async () => {
    const res = await PUT(req({ isReleased: true }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.week.isReleased).toBe(true)
  })

  it("{ isReleased: false } hides the week", async () => {
    const res = await PUT(req({ isReleased: false }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.week.isReleased).toBe(false)
  })

  it("{ topic } alone still updates the topic", async () => {
    const res = await PUT(req({ topic: "Python พื้นฐาน" }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.week.topic).toBe("Python พื้นฐาน")
  })

  it("{ topic, isReleased } updates both fields", async () => {
    const res = await PUT(req({ topic: "Loop", isReleased: true }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.week.topic).toBe("Loop")
    expect(body.week.isReleased).toBe(true)
  })

  it("neither field returns 400", async () => {
    const res = await PUT(req({}), ctx())
    expect(res.status).toBe(400)
  })

  it("week from another course → 404, not editable through this course's URL", async () => {
    // A week belonging to a different course must not be mutable via this
    // course-scoped URL (cross-course leak regression).
    const other = await createCourse(f.db, {
      code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "Other",
    })
    await seedWeeks(f.db, other)
    const otherWeekId = (await listWeeks(f.db, other))[0].id

    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/weeks/${otherWeekId}`,
      { method: "PUT", body: JSON.stringify({ isReleased: true }) }
    )
    r.cookies.set("session", sessionFor(f.ins.email))
    const ctxOther = {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
        wid: String(otherWeekId),
      }),
    }

    const res = await PUT(r, ctxOther)
    expect(res.status).toBe(404)
    // and the other course's week is unchanged
    expect((await listWeeks(f.db, other))[0].isReleased).toBe(false)
  })
})
