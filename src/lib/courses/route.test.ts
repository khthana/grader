import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { courseRoute } from "./route"
import type { CourseAuth } from "./authorize"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("courseRoute", () => {
  let f: CourseFixture

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })

  afterEach(() => setTestDb(null))

  function courseParams() {
    return { code: f.course.code, year: String(f.course.year), semester: String(f.course.semester) }
  }

  it("returns 401 and never calls handler when request has no session", async () => {
    const handler = vi.fn()
    const route = courseRoute({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}`)
    const ctx = { params: Promise.resolve(courseParams()) }

    const res = await route(req, ctx)

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns 403 without calling handler when options.manage and caller is TA", async () => {
    const handler = vi.fn()
    const route = courseRoute({ manage: true }, handler)
    const req = new NextRequest(`http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}`)
    req.cookies.set("session", sessionFor(f.ta.email))
    const ctx = { params: Promise.resolve(courseParams()) }

    const res = await route(req, ctx)

    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("calls handler with auth and params when request is entitled", async () => {
    let capturedAuth: (CourseAuth & { ok: true }) | undefined
    let capturedParams: { code: string; year: string; semester: string } | undefined

    const handler = vi.fn(async (_req, auth, params) => {
      capturedAuth = auth
      capturedParams = params
      return NextResponse.json({ ok: true })
    })

    const route = courseRoute({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}`)
    req.cookies.set("session", sessionFor(f.ins.email))
    const ctx = { params: Promise.resolve(courseParams()) }

    const res = await route(req, ctx)

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    expect(capturedAuth!.course.code).toBe(f.course.code)
    expect(capturedParams!.code).toBe(f.course.code)
  })

  it("passes extra params through to the handler", async () => {
    let capturedParams: { code: string; year: string; semester: string; pid: string } | undefined

    const handler = vi.fn(async (_req, _auth, params: { code: string; year: string; semester: string; pid: string }) => {
      capturedParams = params
      return NextResponse.json({ ok: true })
    })

    const route = courseRoute<{ code: string; year: string; semester: string; pid: string }>({}, handler)
    const req = new NextRequest(`http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/99`)
    req.cookies.set("session", sessionFor(f.ins.email))
    const ctx = { params: Promise.resolve({ ...courseParams(), pid: "99" }) }

    await route(req, ctx)

    expect(capturedParams!.code).toBe(f.course.code)
    expect(capturedParams!.pid).toBe("99")
  })
})
