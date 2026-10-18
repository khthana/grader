import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as getOutline } from "./route"
import { GET as getOne, PUT, DELETE } from "./[week]/[kind]/route"
import { POST as MOVE } from "./[week]/[kind]/move/route"
import { PUT as PUBLISH } from "./[week]/[kind]/publish/route"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { seedStudent } from "@/lib/test-support/quiz"
import { createUser, assignRole } from "@/lib/users/repository"
import { saveSyllabus } from "@/lib/syllabus/repository"
import { EMPTY_SYLLABUS } from "@/lib/syllabus/draft"
import type { PlanEntry } from "@/lib/syllabus/plan"

// Teaching Materials (#109): staff write them by Teaching Plan week; the
// heading is the plan's topics, read live (ADR 0012).
describe("/api/courses/[code]/[year]/[semester]/materials", () => {
  let f: CourseFixture
  let student: { id: number; email: string }

  function req(email: string | null, method = "GET", body?: unknown) {
    const r = new NextRequest("http://localhost/api/x", {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    })
    if (email) r.cookies.set("session", sessionFor(email))
    return r
  }
  const course = () => ({ code: f.course.code, year: String(f.course.year), semester: String(f.course.semester) })
  const outline = async (email: string | null) => getOutline(req(email), { params: Promise.resolve(course()) })
  const one = async (email: string, week: string | number, kind: string) =>
    getOne(req(email), { params: Promise.resolve({ ...course(), week: String(week), kind }) })
  const put = async (email: string, week: string | number, kind: string, body: unknown) =>
    PUT(req(email, "PUT", body), { params: Promise.resolve({ ...course(), week: String(week), kind }) })

  const plan = (entries: [number, string][]) =>
    saveSyllabus(
      f.db,
      f.course,
      { ...EMPTY_SYLLABUS, plan: entries.map(([weekNo, topic]): PlanEntry => ({ weekNo, topic, detail: "" })) },
      f.ins.id
    )

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    student = await seedStudent(f.db, f.course, "1")
    await plan([
      [1, "Intro"],
      [3, "Array"],
      [3, "Lab Array"],
    ])
  })
  afterEach(() => setTestDb(null))

  it("an Instructor's first PUT creates the Material, the second updates it; it starts unpublished", async () => {
    const created = await put(f.ins.email, 3, "slides", { body: "  # Array  " })
    expect(created.status).toBe(200)
    expect((await created.json()).material).toMatchObject({ weekNo: 3, kind: "slides", body: "# Array", isPublished: false })

    expect((await put(f.ins.email, 3, "slides", { body: "# Array v2" })).status).toBe(200)
    const res = await one(f.ins.email, 3, "slides")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material).toMatchObject({ weekNo: 3, kind: "slides", body: "# Array v2", isPublished: false })
    expect(body.heading).toBe("Array · Lab Array")
  })

  it("the outline lists the plan weeks with live headings and each Material in its Kind slot", async () => {
    await put(f.ins.email, 3, "lab", { body: "lab" })
    await put(f.ins.email, 1, "slides", { body: "s" })
    const res = await outline(f.ins.email)
    expect(res.status).toBe(200)
    const { weeks, unplanned } = await res.json()
    expect(weeks.map((w: { weekNo: number; heading: string }) => [w.weekNo, w.heading])).toEqual([
      [1, "Intro"],
      [3, "Array · Lab Array"],
    ])
    expect(weeks[0].materials).toEqual({ slides: { weekNo: 1, kind: "slides", isPublished: false } })
    expect(weeks[1].materials).toEqual({ lab: { weekNo: 3, kind: "lab", isPublished: false } })
    expect(unplanned).toEqual([])
  })

  it("editing the Teaching Plan changes the heading on the next read", async () => {
    await put(f.ins.email, 1, "handout", { body: "h" })
    await plan([[1, "Python basics"]])
    expect((await (await one(f.ins.email, 1, "handout")).json()).heading).toBe("Python basics")
    expect((await (await outline(f.ins.email)).json()).weeks[0].heading).toBe("Python basics")
  })

  it("a Material outside the plan is Unplanned — staff still read it, with no heading", async () => {
    await put(f.ins.email, 9, "slides", { body: "old" })
    const { unplanned } = await (await outline(f.ins.email)).json()
    expect(unplanned).toEqual([{ weekNo: 9, kind: "slides", isPublished: false }])
    const body = await (await one(f.ta.email, 9, "slides")).json()
    expect(body.heading).toBeNull()
  })

  it("a TA reads everything but can't write; a Student can't write", async () => {
    await put(f.ins.email, 1, "slides", { body: "s" })
    expect((await one(f.ta.email, 1, "slides")).status).toBe(200)
    expect((await (await outline(f.ta.email)).json()).weeks[0].materials.slides).toBeDefined()
    expect((await put(f.ta.email, 1, "slides", { body: "x" })).status).toBe(403)
    expect((await put(student.email, 1, "slides", { body: "x" })).status).toBe(403)
  })

  it("a Student sees no Material while none is published — the outline is empty, a Material is a 404", async () => {
    await put(f.ins.email, 1, "slides", { body: "s" })
    const res = await outline(student.email)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ weeks: [], unplanned: [] })
    const unpublished = await one(student.email, 1, "slides")
    const missing = await one(student.email, 1, "lab")
    expect(unpublished.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await unpublished.json()).toEqual(await missing.json())
  })

  it("a missing Material is a 404 for staff too", async () => {
    expect((await one(f.ins.email, 1, "lab")).status).toBe(404)
  })

  it("an Admin who isn't on the staff may write", async () => {
    const admin = await createUser(f.db, { email: "adm@kmitl.ac.th", name: "adm" })
    await assignRole(f.db, admin.id, "Admin")
    expect((await put(admin.email, 1, "slides", { body: "s" })).status).toBe(200)
  })

  it("someone not linked to the course is refused; no session is a 401", async () => {
    const outsider = await createUser(f.db, { email: "out@kmitl.ac.th", name: "out" })
    await assignRole(f.db, outsider.id, "Instructor")
    expect((await outline(outsider.email)).status).toBe(403)
    expect((await one(outsider.email, 1, "slides")).status).toBe(403)
    expect((await put(outsider.email, 1, "slides", { body: "x" })).status).toBe(403)
    expect((await outline(null)).status).toBe(401)
  })

  it("a bad body is a 400 with field errors", async () => {
    const res = await put(f.ins.email, 1, "slides", { body: 3 })
    expect(res.status).toBe(400)
    expect(Object.keys((await res.json()).errors)).toEqual(["body"])
    expect((await put(f.ins.email, 1, "slides", "not json")).status).toBe(400)
  })

  it.each([
    ["0", "slides"],
    ["21", "slides"],
    ["1.5", "slides"],
    ["x", "slides"],
    ["1", "Slides"],
    ["1", "lab-sheet"],
  ])("week %s / kind %s is a 404", async (week, kind) => {
    expect((await one(f.ins.email, week, kind)).status).toBe(404)
    expect((await put(f.ins.email, week, kind, { body: "x" })).status).toBe(404)
  })

  describe("publishing (#110)", () => {
    const publish = async (email: string, week: string | number, kind: string, body: unknown) =>
      PUBLISH(req(email, "PUT", body), { params: Promise.resolve({ ...course(), week: String(week), kind }) })

    beforeEach(async () => {
      await put(f.ins.email, 1, "slides", { body: "s" })
      await put(f.ins.email, 1, "lab", { body: "l" })
      await put(f.ins.email, 3, "handout", { body: "h" })
    })

    it("an Instructor publishes and unpublishes; each change logs material.publish", async () => {
      const on = await publish(f.ins.email, 1, "slides", { published: true })
      expect(on.status).toBe(200)
      expect((await on.json()).material).toMatchObject({ weekNo: 1, kind: "slides", isPublished: true })
      const off = await publish(f.ins.email, 1, "slides", { published: false })
      expect((await off.json()).material.isPublished).toBe(false)

      const { rows } = await f.db.query(
        `SELECT action, actor_id, target_email, detail FROM user_logs WHERE action = 'material.publish' ORDER BY id`
      )
      expect(rows).toEqual([
        { action: "material.publish", actor_id: f.ins.id, target_email: "C01/2567/1", detail: "publish 1/slides" },
        { action: "material.publish", actor_id: f.ins.id, target_email: "C01/2567/1", detail: "unpublish 1/slides" },
      ])
    })

    it("a TA and a Student can't publish", async () => {
      expect((await publish(f.ta.email, 1, "slides", { published: true })).status).toBe(403)
      expect((await publish(student.email, 1, "slides", { published: true })).status).toBe(403)
    })

    it("publishing a Material that doesn't exist is a 404; a non-boolean is a 400", async () => {
      expect((await publish(f.ins.email, 1, "handout", { published: true })).status).toBe(404)
      expect((await publish(f.ins.email, 0, "slides", { published: true })).status).toBe(404)
      expect((await publish(f.ins.email, 1, "slides", { published: "yes" })).status).toBe(400)
      expect((await publish(f.ins.email, 1, "slides", "nope")).status).toBe(400)
    })

    it("a Student's outline holds only Published Materials of planned weeks, without the flag", async () => {
      await publish(f.ins.email, 1, "slides", { published: true })
      expect(await (await outline(student.email)).json()).toEqual({
        weeks: [{ weekNo: 1, heading: "Intro", materials: { slides: { weekNo: 1, kind: "slides" } } }],
        unplanned: [],
      })
    })

    it("a Student reads a Published planned Material; unpublished and missing are the same 404", async () => {
      await publish(f.ins.email, 1, "slides", { published: true })
      expect((await one(student.email, 1, "slides")).status).toBe(200)
      const unpublished = await one(student.email, 1, "lab")
      const missing = await one(student.email, 1, "handout")
      expect(unpublished.status).toBe(404)
      expect(await unpublished.json()).toEqual(await missing.json())
    })

    it("a Published Material that leaves the plan is hidden from Students again", async () => {
      await publish(f.ins.email, 3, "handout", { published: true })
      expect((await one(student.email, 3, "handout")).status).toBe(200)
      await plan([[1, "Intro"]])
      expect((await one(student.email, 3, "handout")).status).toBe(404)
      expect((await (await outline(student.email)).json()).weeks.map((w: { weekNo: number }) => w.weekNo)).toEqual([])
    })

    it("a TA reads an unpublished Material", async () => {
      expect((await one(f.ta.email, 1, "lab")).status).toBe(200)
    })

    it("saving the body keeps the published state", async () => {
      await publish(f.ins.email, 1, "slides", { published: true })
      await put(f.ins.email, 1, "slides", { body: "s v2" })
      expect((await (await one(f.ins.email, 1, "slides")).json()).material).toMatchObject({ body: "s v2", isPublished: true })
    })

    it("a Student's single Material carries no published flag", async () => {
      await publish(f.ins.email, 1, "slides", { published: true })
      const { material } = await (await one(student.email, 1, "slides")).json()
      expect(material).toMatchObject({ weekNo: 1, kind: "slides", body: "s" })
      expect(material).not.toHaveProperty("isPublished")
    })
  })

  it("logs every save as material.update, naming the Material", async () => {
    await put(f.ins.email, 1, "slides", { body: "a" })
    await put(f.ins.email, 1, "slides", { body: "b" })
    const { rows } = await f.db.query(
      `SELECT action, actor_id, target_email, detail FROM user_logs WHERE action = 'material.update' ORDER BY id`
    )
    expect(rows).toEqual([
      { action: "material.update", actor_id: f.ins.id, target_email: "C01/2567/1", detail: "save 1/slides" },
      { action: "material.update", actor_id: f.ins.id, target_email: "C01/2567/1", detail: "save 1/slides" },
    ])
  })

  describe("Unplanned, move and delete (#111)", () => {
    const move = async (email: string, week: string | number, kind: string, body: unknown) =>
      MOVE(req(email, "POST", body), { params: Promise.resolve({ ...course(), week: String(week), kind }) })
    const del = async (email: string, week: string | number, kind: string) =>
      DELETE(req(email, "DELETE"), { params: Promise.resolve({ ...course(), week: String(week), kind }) })
    const logDetails = async () =>
      (
        await f.db.query(
          `SELECT detail FROM user_logs WHERE action = 'material.update' AND detail NOT LIKE 'save%' ORDER BY id`
        )
      ).rows.map((r) => r.detail)

    beforeEach(async () => {
      await put(f.ins.email, 3, "slides", { body: "array slides" })
      await put(f.ins.email, 1, "slides", { body: "intro slides" })
    })

    it("saving a Syllabus that drops a week leaves its Materials, listed under Unplanned for staff", async () => {
      await plan([[1, "Intro"]])
      expect((await (await one(f.ins.email, 3, "slides")).json()).material.body).toBe("array slides")
      const { weeks, unplanned } = await (await outline(f.ins.email)).json()
      expect(weeks.map((w: { weekNo: number }) => w.weekNo)).toEqual([1])
      expect(unplanned).toEqual([{ weekNo: 3, kind: "slides", isPublished: false }])
    })

    it("a move into an empty slot carries the Material to that week, same Kind", async () => {
      const res = await move(f.ins.email, 3, "slides", { weekNo: 5 })
      expect(res.status).toBe(200)
      expect((await res.json()).material).toMatchObject({ weekNo: 5, kind: "slides", body: "array slides" })
      expect((await one(f.ins.email, 5, "slides")).status).toBe(200)
      expect((await one(f.ins.email, 3, "slides")).status).toBe(404)
    })

    it("a move keeps the published state", async () => {
      await PUBLISH(req(f.ins.email, "PUT", { published: true }), {
        params: Promise.resolve({ ...course(), week: "3", kind: "slides" }),
      })
      expect((await (await move(f.ins.email, 3, "slides", { weekNo: 5 })).json()).material.isPublished).toBe(true)
    })

    it("a move into a taken slot is a 409 with a reason; both Materials stay as they were", async () => {
      const res = await move(f.ins.email, 3, "slides", { weekNo: 1 })
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBeTruthy()
      expect((await (await one(f.ins.email, 3, "slides")).json()).material.body).toBe("array slides")
      expect((await (await one(f.ins.email, 1, "slides")).json()).material.body).toBe("intro slides")
      expect(await logDetails()).toEqual([])
    })

    it("a move to week 0 or 21 is a 400; to the same week a 200 with no change", async () => {
      expect((await move(f.ins.email, 3, "slides", { weekNo: 0 })).status).toBe(400)
      expect((await move(f.ins.email, 3, "slides", { weekNo: 21 })).status).toBe(400)
      expect((await move(f.ins.email, 3, "slides", "nope")).status).toBe(400)
      const same = await move(f.ins.email, 3, "slides", { weekNo: 3 })
      expect(same.status).toBe(200)
      expect((await same.json()).material).toMatchObject({ weekNo: 3, kind: "slides", body: "array slides" })
      expect(await logDetails()).toEqual([])
    })

    it("moving a Material that doesn't exist is a 404", async () => {
      expect((await move(f.ins.email, 3, "lab", { weekNo: 5 })).status).toBe(404)
      expect((await move(f.ins.email, 0, "slides", { weekNo: 5 })).status).toBe(404)
    })

    it("DELETE removes the Material; the next GET is a 404, a second DELETE too", async () => {
      expect((await del(f.ins.email, 3, "slides")).status).toBe(200)
      expect((await one(f.ins.email, 3, "slides")).status).toBe(404)
      expect((await del(f.ins.email, 3, "slides")).status).toBe(404)
      expect((await one(f.ins.email, 1, "slides")).status).toBe(200)
    })

    it("a TA and a Student get 403 on move and on delete", async () => {
      for (const email of [f.ta.email, student.email]) {
        expect((await move(email, 3, "slides", { weekNo: 5 })).status).toBe(403)
        expect((await del(email, 3, "slides")).status).toBe(403)
      }
      expect((await one(f.ins.email, 3, "slides")).status).toBe(200)
    })

    it("move and delete each log material.update with the operation and week/Kind", async () => {
      await move(f.ins.email, 3, "slides", { weekNo: 5 })
      await del(f.ins.email, 5, "slides")
      expect(await logDetails()).toEqual(["move 3/slides → 5/slides", "delete 5/slides"])
    })
  })
})
