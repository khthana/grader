import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { courseRoute } from "./route"
import type { CourseAuth } from "./authorize"
import { courseFixture, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("courseRoute", () => {
  let f: CourseFixture
  let courseId: number

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    courseId = f.course.id
  })

  afterEach(() => setTestDb(null))

  it("returns 401 and never calls handler when request has no session", async () => {
    const handler = vi.fn()
    const route = courseRoute({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${courseId}`)
    const ctx = { params: Promise.resolve({ id: String(courseId) }) }

    const res = await route(req, ctx)

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns 403 without calling handler when options.manage and caller is TA", async () => {
    const handler = vi.fn()
    const route = courseRoute({ manage: true }, handler)
    const req = new NextRequest(`http://localhost/api/courses/${courseId}`)
    req.cookies.set("session", sessionFor(f.ta.email))
    const ctx = { params: Promise.resolve({ id: String(courseId) }) }

    const res = await route(req, ctx)

    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("calls handler with auth and params when request is entitled", async () => {
    let capturedAuth: (CourseAuth & { ok: true }) | undefined
    let capturedParams: { id: string } | undefined

    const handler = vi.fn(async (req, auth, params) => {
      capturedAuth = auth
      capturedParams = params
      return NextResponse.json({ ok: true })
    })

    const route = courseRoute({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${courseId}`)
    req.cookies.set("session", sessionFor(f.ins.email))
    const ctx = { params: Promise.resolve({ id: String(courseId) }) }

    const res = await route(req, ctx)

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    expect(capturedAuth!.courseId).toBe(courseId)
    expect(capturedParams!.id).toBe(String(courseId))
  })

  it("passes extra params through to the handler", async () => {
    let capturedParams: { id: string; pid: string } | undefined

    const handler = vi.fn(async (req, auth, params: { id: string; pid: string }) => {
      capturedParams = params
      return NextResponse.json({ ok: true })
    })

    const route = courseRoute<{ id: string; pid: string }>({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${courseId}/problems/99`)
    req.cookies.set("session", sessionFor(f.ins.email))
    const ctx = { params: Promise.resolve({ id: String(courseId), pid: "99" }) }

    await route(req, ctx)

    expect(capturedParams!.id).toBe(String(courseId))
    expect(capturedParams!.pid).toBe("99")
  })
})
