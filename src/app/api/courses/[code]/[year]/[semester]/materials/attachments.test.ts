import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { GET as getOne } from "./[week]/[kind]/route"
import { POST as UPLOAD } from "./[week]/[kind]/attachments/route"
import { GET as DOWNLOAD } from "./attachments/[aid]/route"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { seedStudent } from "@/lib/test-support/quiz"
import { createCourse } from "@/lib/courses/repository"
import { saveSyllabus } from "@/lib/syllabus/repository"
import { EMPTY_SYLLABUS } from "@/lib/syllabus/draft"
import { saveMaterial, setMaterialPublished } from "@/lib/materials/repository"
import { createAttachment, findMaterialId } from "@/lib/materials/attachments/repository"
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MATERIAL } from "@/lib/materials/attachments/policy"
import { setTestAttachmentStore } from "@/lib/materials/attachments/store"

// Attachments of a Teaching Material (#114, ADR 0013): a manager uploads, anyone
// who may see the Material downloads; a Student gets one 404 for everything else.
describe("Teaching Material Attachments", () => {
  let f: CourseFixture
  let dir: string
  let student: { id: number; email: string }

  const course = () => ({ code: f.course.code, year: String(f.course.year), semester: String(f.course.semester) })
  const at = (week: number, kind: string) => ({ params: Promise.resolve({ ...course(), week: String(week), kind }) })

  function withSession(r: NextRequest, email: string | null) {
    if (email) r.cookies.set("session", sessionFor(email))
    return r
  }
  async function upload(email: string | null, name: string, content: string | Uint8Array = "data", week = 3, kind = "slides") {
    const form = new FormData()
    form.set("file", new File([content as BlobPart], name))
    const r = new NextRequest("http://localhost/api/x", { method: "POST", body: form })
    return UPLOAD(withSession(r, email), at(week, kind))
  }
  const download = (email: string | null, aid: number | string) =>
    DOWNLOAD(withSession(new NextRequest("http://localhost/api/x"), email), {
      params: Promise.resolve({ ...course(), aid: String(aid) }),
    })
  const uploaded = async (email: string, name: string, content?: string) => (await (await upload(email, name, content)).json()).attachment

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    dir = await mkdtemp(path.join(tmpdir(), "attachments-"))
    setTestAttachmentStore(dir)
    student = await seedStudent(f.db, f.course, "1")
    await saveSyllabus(f.db, f.course, { ...EMPTY_SYLLABUS, plan: [{ weekNo: 3, topic: "Array", detail: "" }] }, f.ins.id)
    await saveMaterial(f.db, f.course, { weekNo: 3, kind: "slides" }, "# Array", f.ins.id)
  })
  afterEach(async () => {
    setTestDb(null)
    setTestAttachmentStore(null)
    await rm(dir, { recursive: true, force: true })
  })

  it("a manager attaches a file; the Material lists it in upload order and it downloads", async () => {
    const res = await upload(f.ins.email, "slides.pdf", "%PDF-1")
    expect(res.status).toBe(201)
    const { attachment, replaced } = await res.json()
    expect(replaced).toBe(false)
    expect(attachment).toMatchObject({ name: "slides.pdf", contentType: "application/pdf", sizeBytes: 6 })
    expect(attachment).not.toHaveProperty("sha256")
    await upload(f.ins.email, "starter.zip", "PK")

    const { attachments } = await (await getOne(withSession(new NextRequest("http://localhost/api/x"), f.ins.email), at(3, "slides"))).json()
    expect(attachments.map((a: { name: string }) => a.name)).toEqual(["slides.pdf", "starter.zip"])

    const file = await download(f.ins.email, attachment.id)
    expect(file.status).toBe(200)
    expect(await file.text()).toBe("%PDF-1")
  })

  it("a download is served with the stored type: an image inline, anything else as a file, always nosniff", async () => {
    const pdf = await uploaded(f.ins.email, "สไลด์.pdf")
    const png = await uploaded(f.ins.email, "diagram.png")
    const a = await download(f.ins.email, pdf.id)
    expect(a.headers.get("content-type")).toBe("application/pdf")
    expect(a.headers.get("content-disposition")).toContain(`attachment; filename="_____.pdf"; filename*=UTF-8''${encodeURIComponent("สไลด์")}.pdf`)
    expect(a.headers.get("x-content-type-options")).toBe("nosniff")
    const b = await download(f.ins.email, png.id)
    expect(b.headers.get("content-type")).toBe("image/png")
    expect(b.headers.get("content-disposition")).toMatch(/^inline;/)
    expect(b.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("the client's content type is ignored", async () => {
    const form = new FormData()
    form.set("file", new File(["<script>"], "notes.txt", { type: "text/html" }))
    const res = await UPLOAD(withSession(new NextRequest("http://localhost/api/x", { method: "POST", body: form }), f.ins.email), at(3, "slides"))
    expect((await res.json()).attachment.contentType).toBe("text/plain; charset=utf-8")
  })

  it("refuses a disallowed type or a bad name (400), an oversized file (413), a duplicate name or a 21st file (409)", async () => {
    expect(await (await upload(f.ins.email, "logo.svg")).json()).toMatchObject({ reason: "type" })
    expect((await upload(f.ins.email, "setup.exe")).status).toBe(400)
    expect((await upload(f.ins.email, "   ")).status).toBe(400)

    const big = await upload(f.ins.email, "big.pdf", new Uint8Array(MAX_ATTACHMENT_BYTES + 1))
    expect(big.status).toBe(413)
    expect(await big.json()).toMatchObject({ reason: "size" })

    await upload(f.ins.email, "slides.pdf")
    const dup = await upload(f.ins.email, "slides.pdf", "other")
    expect(dup.status).toBe(409)
    expect(await dup.json()).toMatchObject({ reason: "name-taken" })

    const materialId = (await findMaterialId(f.db, f.course, { weekNo: 3, kind: "slides" }))!
    for (let i = 1; i < MAX_ATTACHMENTS_PER_MATERIAL; i++) {
      await createAttachment(f.db, materialId, { name: `f${i}.txt`, contentType: "text/plain", sizeBytes: 1, sha256: "x" }, f.ins.id)
    }
    const full = await upload(f.ins.email, "one-more.pdf")
    expect(full.status).toBe(409)
    expect(await full.json()).toMatchObject({ reason: "limit" })
  })

  it("an oversized request is refused from its length, before it is read", async () => {
    const r = new NextRequest("http://localhost/api/x", {
      method: "POST",
      body: "x",
      headers: { "content-length": String(MAX_ATTACHMENT_BYTES * 2) },
    })
    expect((await UPLOAD(withSession(r, f.ins.email), at(3, "slides"))).status).toBe(413)
  })

  it("a request without a file is a 400", async () => {
    const r = new NextRequest("http://localhost/api/x", { method: "POST", body: new FormData() })
    expect((await UPLOAD(withSession(r, f.ins.email), at(3, "slides"))).status).toBe(400)
  })

  it("a Material that was never saved takes no Attachment — 404", async () => {
    expect((await upload(f.ins.email, "a.pdf", "x", 3, "lab")).status).toBe(404)
    expect((await upload(f.ins.email, "a.pdf", "x", 99, "slides")).status).toBe(404)
  })

  it("a TA or a Student can't upload; no session is a 401", async () => {
    expect((await upload(f.ta.email, "a.pdf")).status).toBe(403)
    expect((await upload(student.email, "a.pdf")).status).toBe(403)
    expect((await upload(null, "a.pdf")).status).toBe(401)
  })

  it("a TA downloads every Attachment, published or not", async () => {
    const a = await uploaded(f.ins.email, "a.pdf")
    expect((await download(f.ta.email, a.id)).status).toBe(200)
  })

  describe("what a Student downloads", () => {
    it("an Attachment of a published, planned Material", async () => {
      const a = await uploaded(f.ins.email, "a.pdf", "hello")
      await setMaterialPublished(f.db, f.course, { weekNo: 3, kind: "slides" }, true)
      const res = await download(student.email, a.id)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("hello")
      const { attachments } = await (await getOne(withSession(new NextRequest("http://localhost/api/x"), student.email), at(3, "slides"))).json()
      expect(attachments.map((x: { name: string }) => x.name)).toEqual(["a.pdf"])
    })

    it("the same 404 for an unpublished, Unplanned, missing, other-course or vanished one", async () => {
      const a = await uploaded(f.ins.email, "a.pdf")
      const unpublished = await download(student.email, a.id)

      await saveMaterial(f.db, f.course, { weekNo: 9, kind: "lab" }, "old", f.ins.id)
      await setMaterialPublished(f.db, f.course, { weekNo: 9, kind: "lab" }, true)
      const unplannedId = (await findMaterialId(f.db, f.course, { weekNo: 9, kind: "lab" }))!
      const u = await createAttachment(f.db, unplannedId, { name: "u.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "x" }, f.ins.id)
      const unplanned = await download(student.email, u!.id)

      const missing = await download(student.email, 9999)
      const malformed = await download(student.email, "abc")

      const other = await createCourse(f.db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
      await saveMaterial(f.db, other, { weekNo: 3, kind: "slides" }, "x", f.ins.id)
      await setMaterialPublished(f.db, other, { weekNo: 3, kind: "slides" }, true)
      const otherId = (await findMaterialId(f.db, other, { weekNo: 3, kind: "slides" }))!
      const o = await createAttachment(f.db, otherId, { name: "o.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "x" }, f.ins.id)
      const otherCourse = await download(student.email, o!.id)

      await setMaterialPublished(f.db, f.course, { weekNo: 3, kind: "slides" }, true)
      const gone = await createAttachment(
        f.db,
        (await findMaterialId(f.db, f.course, { weekNo: 3, kind: "slides" }))!,
        { name: "gone.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "f".repeat(64) },
        f.ins.id
      )
      const vanished = await download(student.email, gone!.id)

      const bodies = await Promise.all(
        [unpublished, unplanned, missing, malformed, otherCourse, vanished].map(async (r) => [r.status, await r.json()])
      )
      for (const b of bodies) expect(b).toEqual(bodies[0])
      expect(bodies[0][0]).toBe(404)
    })

    it("an unpublished Material's GET carries no Attachments", async () => {
      await uploaded(f.ins.email, "a.pdf")
      const res = await getOne(withSession(new NextRequest("http://localhost/api/x"), student.email), at(3, "slides"))
      expect(res.status).toBe(404)
      expect(await res.json()).not.toHaveProperty("attachments")
    })
  })

  it("staff get 404 for another course's Attachment too", async () => {
    const other = await createCourse(f.db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
    await saveMaterial(f.db, other, { weekNo: 3, kind: "slides" }, "x", f.ins.id)
    const otherId = (await findMaterialId(f.db, other, { weekNo: 3, kind: "slides" }))!
    const o = await createAttachment(f.db, otherId, { name: "o.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "x" }, f.ins.id)
    expect((await download(f.ins.email, o!.id)).status).toBe(404)
  })

  it("deleting the Material deletes its Attachments' rows", async () => {
    const a = await uploaded(f.ins.email, "a.pdf")
    await f.db.query(`DELETE FROM teaching_materials WHERE course_code = $1`, [f.course.code])
    expect((await f.db.query(`SELECT 1 FROM material_attachments`)).rows).toEqual([])
    expect((await download(f.ins.email, a.id)).status).toBe(404)
  })

  it("logs each upload as material.update, naming the Material and the file", async () => {
    await upload(f.ins.email, "slides.pdf")
    const { rows } = await f.db.query<{ action: string; target_email: string; detail: string }>(
      `SELECT action, target_email, detail FROM user_logs WHERE detail LIKE 'attach%'`
    )
    expect(rows).toEqual([{ action: "material.update", target_email: "C01/2567/1", detail: "attach 3/slides slides.pdf" }])
  })
})
