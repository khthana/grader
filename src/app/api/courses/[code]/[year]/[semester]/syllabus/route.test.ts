import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { seedStudent } from "@/lib/test-support/quiz"
import { createUser, assignRole } from "@/lib/users/repository"
import { assignInstructor, setCourseInstructors } from "@/lib/courses/repository"
import { addWeek, listWeeks, setWeekReleased } from "@/lib/weeks/repository"

// The Syllabus (#99): general information, Course Description, Learning
// Objectives — read by anyone linked to the course, written by its managers.
describe("/api/courses/[code]/[year]/[semester]/syllabus", () => {
  let f: CourseFixture
  let student: { id: number; email: string }

  function req(email: string, body?: unknown) {
    const r = new NextRequest("http://localhost/api/x", {
      method: body === undefined ? "GET" : "PUT",
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    })
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const params = () => ({
    params: Promise.resolve({ code: f.course.code, year: String(f.course.year), semester: String(f.course.semester) }),
  })
  const get = async (email: string) => GET(req(email), params())
  const put = async (email: string, body: unknown) => PUT(req(email, body), params())

  async function user(email: string, roles: ("Admin" | "Instructor" | "TA" | "Student")[]) {
    const u = await createUser(f.db, { email, name: email.split("@")[0] })
    for (const r of roles) await assignRole(f.db, u.id, r)
    return u
  }

  const content = {
    credits: " 3(2-2-5) ",
    description: "  วิชานี้เรียน **โครงสร้างข้อมูล**  ",
    objectives: "1. อธิบาย Array ได้\n2. เขียน Linked List ได้",
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    student = await seedStudent(f.db, f.course, "1")
  })
  afterEach(() => setTestDb(null))

  it("a course with no Syllabus reads as an empty one, with its staff", async () => {
    const res = await get(student.email)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.syllabus).toEqual({ credits: "", description: "", objectives: "", plan: [] })
    expect(body.staff).toEqual({
      instructors: [{ id: f.ins.id, name: f.ins.name, email: f.ins.email }],
      tas: [{ id: f.ta.id, name: f.ta.name, email: f.ta.email }],
    })
  })

  it("an Instructor saves it; Students and TAs read back the same, trimmed", async () => {
    const res = await put(f.ins.email, content)
    expect(res.status).toBe(200)
    const saved = {
      credits: "3(2-2-5)",
      description: "วิชานี้เรียน **โครงสร้างข้อมูล**",
      objectives: "1. อธิบาย Array ได้\n2. เขียน Linked List ได้",
      plan: [],
    }
    expect((await res.json()).syllabus).toEqual(saved)
    expect((await (await get(student.email)).json()).syllabus).toEqual(saved)
    expect((await (await get(f.ta.email)).json()).syllabus).toEqual(saved)
  })

  it("a PUT replaces the whole Syllabus — a field left out is cleared", async () => {
    await put(f.ins.email, content)
    await put(f.ins.email, { credits: "3" })
    expect((await (await get(student.email)).json()).syllabus).toEqual({ credits: "3", description: "", objectives: "", plan: [] })
  })

  it("an Admin who isn't on the staff may write it", async () => {
    const admin = await user("admin@kmitl.ac.th", ["Admin"])
    expect((await put(admin.email, content)).status).toBe(200)
  })

  it("a TA and a Student may read but not write", async () => {
    expect((await put(f.ta.email, content)).status).toBe(403)
    expect((await put(student.email, content)).status).toBe(403)
    expect((await (await get(student.email)).json()).syllabus.credits).toBe("")
  })

  it("someone not linked to the course is refused", async () => {
    const outsider = await user("out@kmitl.ac.th", ["Instructor"])
    expect((await get(outsider.email)).status).toBe(403)
    expect((await put(outsider.email, content)).status).toBe(403)
  })

  it("no session is a 401; an unknown course is a 404", async () => {
    const anon = new NextRequest("http://localhost/api/x")
    expect((await GET(anon, params())).status).toBe(401)
    const missing = { params: Promise.resolve({ code: "NOPE", year: "2567", semester: "1" }) }
    expect((await GET(req(student.email), missing)).status).toBe(404)
  })

  it("a wrong-typed field is a 400 with field errors, not a crash", async () => {
    const res = await put(f.ins.email, { credits: 3, description: ["x"] })
    expect(res.status).toBe(400)
    const { errors } = await res.json()
    expect(Object.keys(errors).sort()).toEqual(["credits", "description"])
    expect((await put(f.ins.email, "not json")).status).toBe(400)
    expect((await put(f.ins.email, [1, 2])).status).toBe(400)
  })

  it("staff come from Course staff as they stand, each listed once by highest Role", async () => {
    const both = await user("both@kmitl.ac.th", ["TA", "Instructor"])
    const admin = await user("adm@kmitl.ac.th", ["Admin"])
    await assignInstructor(f.db, f.course, both.id)
    await assignInstructor(f.db, f.course, admin.id)

    const { staff } = await (await get(student.email)).json()
    const ids = (list: { id: number }[]) => list.map((s) => s.id).sort()
    expect(ids(staff.instructors)).toEqual([f.ins.id, both.id, admin.id].sort())
    expect(ids(staff.tas)).toEqual([f.ta.id])

    await setCourseInstructors(f.db, f.course, [both.id])
    const after = (await (await get(student.email)).json()).staff
    expect(ids(after.instructors)).toEqual([both.id])
    expect(after.tas).toEqual([])
  })

  it("logs every save as syllabus.update", async () => {
    await put(f.ins.email, content)
    const { rows } = await f.db.query(`SELECT action, actor_id, target_email FROM user_logs WHERE action = 'syllabus.update'`)
    expect(rows).toEqual([{ action: "syllabus.update", actor_id: f.ins.id, target_email: "C01/2567/1" }])
  })

  describe("Teaching Plan (#100)", () => {
    const entry = (weekNo: unknown, topic: unknown = "หัวข้อ", detail?: unknown) => ({ weekNo, topic, detail })
    const planOf = async () => (await (await get(student.email)).json()).syllabus.plan

    it.each([0, 21, 1.5, "3", null])("week %j is a 400 on that row", async (weekNo) => {
      const res = await put(f.ins.email, { plan: [entry(1), entry(weekNo)] })
      expect(res.status).toBe(400)
      expect(Object.keys((await res.json()).errors)).toEqual(["plan.1.weekNo"])
    })

    it("an empty topic, a wrong-typed detail or a non-list plan is a 400", async () => {
      const res = await put(f.ins.email, { plan: [entry(1, "  "), entry(2, "x", 5), "row"] })
      expect(res.status).toBe(400)
      expect(Object.keys((await res.json()).errors).sort()).toEqual(["plan.0.topic", "plan.1.detail", "plan.2"])
      expect((await put(f.ins.email, { plan: "week 1" })).status).toBe(400)
    })

    it("entries come back sorted by week; one week keeps the order sent; text trimmed", async () => {
      const res = await put(f.ins.email, {
        plan: [entry(8, "สอบกลางภาค"), entry(1, " แนะนำวิชา ", " ภาพรวม "), entry(2, "Loop ตอน 2"), entry(2, "Loop ตอน 1"), entry(16, "สอบปลายภาค")],
      })
      expect(res.status).toBe(200)
      const expected = [
        { weekNo: 1, topic: "แนะนำวิชา", detail: "ภาพรวม" },
        { weekNo: 2, topic: "Loop ตอน 2", detail: "" },
        { weekNo: 2, topic: "Loop ตอน 1", detail: "" },
        { weekNo: 8, topic: "สอบกลางภาค", detail: "" },
        { weekNo: 16, topic: "สอบปลายภาค", detail: "" },
      ]
      expect((await res.json()).syllabus.plan).toEqual(expected)
      expect(await planOf()).toEqual(expected)
    })

    it("a PUT replaces the plan — removed entries are gone", async () => {
      await put(f.ins.email, { plan: [entry(1, "a"), entry(2, "b"), entry(3, "c")] })
      await put(f.ins.email, { plan: [entry(2, "b")] })
      expect(await planOf()).toEqual([{ weekNo: 2, topic: "b", detail: "" }])
      await put(f.ins.email, {})
      expect(await planOf()).toEqual([])
    })

    it("Students see the whole plan whatever Weeks are released; adding or releasing a Week changes nothing", async () => {
      await put(f.ins.email, { plan: [entry(1, "a"), entry(12, "b")] })
      const before = await planOf()
      expect(before).toHaveLength(2)
      await addWeek(f.db, f.course)
      const [week1] = await listWeeks(f.db, f.course)
      await setWeekReleased(f.db, week1.id, true)
      expect(await planOf()).toEqual(before)
    })
  })
})
