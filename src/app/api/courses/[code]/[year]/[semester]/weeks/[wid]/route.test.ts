import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { listWeeks } from "@/lib/weeks/repository"
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
})
