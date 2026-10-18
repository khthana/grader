import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { courseFixture, setTestDb } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { EMPTY_SYLLABUS } from "@/lib/syllabus/draft"
import { saveSyllabus } from "@/lib/syllabus/repository"
import { listMaterials, saveMaterial, setMaterialPublished } from "@/lib/materials/repository"
import { duplicateCourseOffering } from "./duplicate"

// Course duplication copies every Teaching Material, unpublished (#112, ADR 0006/0012).
describe("duplicateCourseOffering — Teaching Materials", () => {
  let f: CourseFixture
  const target = () => ({ code: f.course.code, year: f.course.year, semester: 2 })
  const duplicate = () => duplicateCourseOffering(f.db, f.course, { year: target().year, semester: target().semester }, f.ins.id)
  const shape = async (key: typeof f.course | ReturnType<typeof target>) =>
    (await listMaterials(f.db, key)).map(({ weekNo, kind, body, isPublished }) => ({ weekNo, kind, body, isPublished }))

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    await saveSyllabus(f.db, f.course, { ...EMPTY_SYLLABUS, plan: [{ weekNo: 1, topic: "Intro", detail: "" }] }, f.ins.id)
  })
  afterEach(() => setTestDb(null))

  it("copies each Material 1:1 — week, Kind, body — Unplanned ones included, every copy unpublished", async () => {
    await saveMaterial(f.db, f.course, { weekNo: 1, kind: "slides" }, "# Intro", f.ins.id)
    await saveMaterial(f.db, f.course, { weekNo: 1, kind: "lab" }, "lab 1", f.ins.id)
    await saveMaterial(f.db, f.course, { weekNo: 9, kind: "handout" }, "old handout", f.ins.id)
    await setMaterialPublished(f.db, f.course, { weekNo: 1, kind: "slides" }, true)

    expect((await duplicate()).ok).toBe(true)
    expect(await shape(target())).toEqual([
      { weekNo: 1, kind: "slides", body: "# Intro", isPublished: false },
      { weekNo: 1, kind: "lab", body: "lab 1", isPublished: false },
      { weekNo: 9, kind: "handout", body: "old handout", isPublished: false },
    ])
    // The source keeps its published state.
    expect((await shape(f.course))[0].isPublished).toBe(true)
  })

  it("a source with no Materials gives the target none", async () => {
    expect((await duplicate()).ok).toBe(true)
    expect(await listMaterials(f.db, target())).toEqual([])
  })

  it("editing a copy leaves the source unchanged", async () => {
    await saveMaterial(f.db, f.course, { weekNo: 1, kind: "slides" }, "# Intro", f.ins.id)
    await duplicate()
    await saveMaterial(f.db, target(), { weekNo: 1, kind: "slides" }, "# Intro v2", f.ins.id)
    expect((await shape(f.course))[0].body).toBe("# Intro")
    expect((await shape(target()))[0].body).toBe("# Intro v2")
  })
})
