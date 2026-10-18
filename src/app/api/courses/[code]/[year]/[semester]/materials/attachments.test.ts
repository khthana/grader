import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { GET as getOne, PUT as saveMaterialRoute, DELETE as deleteMaterialRoute } from "./[week]/[kind]/route"
import { PUT as publishRoute } from "./[week]/[kind]/publish/route"
import { POST as UPLOAD } from "./[week]/[kind]/attachments/route"
import { GET as DOWNLOAD, DELETE as REMOVE } from "./attachments/[aid]/route"
import { DELETE as deleteCourseRoute } from "../route"
import { POST as DUPLICATE } from "../duplicate/route"
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
  async function upload(
    email: string | null,
    name: string,
    content: string | Uint8Array = "data",
    week = 3,
    kind = "slides",
    replace = false
  ) {
    const form = new FormData()
    form.set("file", new File([content as BlobPart], name))
    if (replace) form.set("replace", "true")
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

  it("a download is served with the stored type, always as a file — an image too (#119) — and nosniff", async () => {
    const pdf = await uploaded(f.ins.email, "สไลด์.pdf")
    const png = await uploaded(f.ins.email, "diagram.png")
    const a = await download(f.ins.email, pdf.id)
    expect(a.headers.get("content-type")).toBe("application/pdf")
    expect(a.headers.get("content-disposition")).toContain(`attachment; filename="_____.pdf"; filename*=UTF-8''${encodeURIComponent("สไลด์")}.pdf`)
    expect(a.headers.get("x-content-type-options")).toBe("nosniff")
    const b = await download(f.ins.email, png.id)
    expect(b.headers.get("content-type")).toBe("image/png")
    expect(b.headers.get("content-disposition")).toMatch(/^attachment;/)
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

  it("a Material with Attachments but no body saves and publishes, and a Student downloads them (#116)", async () => {
    const a = await uploaded(f.ins.email, "slides.pdf", "%PDF-1")
    const put = (route: typeof publishRoute, body: unknown) =>
      route(
        withSession(
          new NextRequest("http://localhost/api/x", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
          f.ins.email
        ),
        at(3, "slides")
      )
    expect((await put(saveMaterialRoute, { body: "" })).status).toBe(200)
    expect((await put(publishRoute, { published: true })).status).toBe(200)
    expect(await (await download(student.email, a.id)).text()).toBe("%PDF-1")
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

  describe("replace, delete and sweep (#115)", () => {
    const HOUR = 60 * 60 * 1000
    const replace = (name: string, content: string) => upload(f.ins.email, name, content, 3, "slides", true)
    const remove = (email: string | null, aid: number | string) =>
      REMOVE(withSession(new NextRequest("http://localhost/api/x", { method: "DELETE" }), email), {
        params: Promise.resolve({ ...course(), aid: String(aid) }),
      })
    const storedFiles = async () =>
      (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((e) => e.isFile() && !e.parentPath.endsWith(".tmp"))
        .map((e) => e.name)
    /** Make every stored file look older than the sweep's grace period. */
    const ageStore = async () => {
      const t = new Date(Date.now() - 2 * HOUR)
      for (const e of await readdir(dir, { recursive: true, withFileTypes: true })) {
        if (e.isFile()) await utimes(path.join(e.parentPath, e.name), t, t)
      }
    }
    const details = async () =>
      (await f.db.query<{ detail: string }>(`SELECT detail FROM user_logs WHERE action = 'material.update' ORDER BY id`)).rows.map(
        (r) => r.detail
      )

    it("replacing keeps the Attachment's id and name, serves the new bytes and sweeps the old ones", async () => {
      const first = await uploaded(f.ins.email, "slides.pdf", "v1")
      await ageStore()
      const res = await replace("slides.pdf", "version 2")
      expect(res.status).toBe(200)
      const { attachment, replaced } = await res.json()
      expect(replaced).toBe(true)
      expect(attachment).toMatchObject({ id: first.id, name: "slides.pdf", sizeBytes: 9 })
      expect(await (await download(f.ins.email, first.id)).text()).toBe("version 2")
      expect(await storedFiles()).toHaveLength(1)
    })

    it("replacing a name that isn't there simply attaches it", async () => {
      const res = await replace("new.pdf", "x")
      expect(res.status).toBe(201)
      expect((await res.json()).replaced).toBe(false)
    })

    it("a Material at its 20-file limit still takes a replacement, never a new name", async () => {
      await uploaded(f.ins.email, "slides.pdf", "v1")
      const materialId = (await findMaterialId(f.db, f.course, { weekNo: 3, kind: "slides" }))!
      for (let i = 1; i < MAX_ATTACHMENTS_PER_MATERIAL; i++) {
        await createAttachment(f.db, materialId, { name: `f${i}.txt`, contentType: "text/plain", sizeBytes: 1, sha256: "x" }, f.ins.id)
      }
      expect((await replace("slides.pdf", "v2")).status).toBe(200)
      expect((await replace("other.pdf", "v2")).status).toBe(409)
    })

    it("a manager deletes an Attachment: it leaves the Material, its old bytes are swept", async () => {
      const a = await uploaded(f.ins.email, "a.pdf", "aaa")
      const b = await uploaded(f.ins.email, "b.pdf", "bbb")
      await ageStore()
      const res = await remove(f.ins.email, a.id)
      expect(res.status).toBe(200)
      expect((await download(f.ins.email, a.id)).status).toBe(404)
      expect(await (await download(f.ins.email, b.id)).text()).toBe("bbb")
      const { attachments } = await (await getOne(withSession(new NextRequest("http://localhost/api/x"), f.ins.email), at(3, "slides"))).json()
      expect(attachments.map((x: { name: string }) => x.name)).toEqual(["b.pdf"])
      expect(await storedFiles()).toHaveLength(1)
    })

    it("bytes another Attachment still uses are never swept", async () => {
      const a = await uploaded(f.ins.email, "a.pdf", "same")
      const b = await uploaded(f.ins.email, "b.pdf", "same")
      await ageStore()
      await remove(f.ins.email, a.id)
      expect(await (await download(f.ins.email, b.id)).text()).toBe("same")
    })

    it("a just-deleted upload younger than an hour stays on disk until a later sweep", async () => {
      const a = await uploaded(f.ins.email, "a.pdf", "fresh")
      await remove(f.ins.email, a.id)
      expect(await storedFiles()).toHaveLength(1)
    })

    it("a TA or a Student can't delete; another course's or a malformed id is a 404", async () => {
      const a = await uploaded(f.ins.email, "a.pdf")
      expect((await remove(f.ta.email, a.id)).status).toBe(403)
      expect((await remove(student.email, a.id)).status).toBe(403)
      expect((await remove(null, a.id)).status).toBe(401)
      expect((await remove(f.ins.email, "abc")).status).toBe(404)
      expect((await remove(f.ins.email, 9999)).status).toBe(404)

      const other = await createCourse(f.db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
      await saveMaterial(f.db, other, { weekNo: 3, kind: "slides" }, "x", f.ins.id)
      const otherId = (await findMaterialId(f.db, other, { weekNo: 3, kind: "slides" }))!
      const o = await createAttachment(f.db, otherId, { name: "o.pdf", contentType: "application/pdf", sizeBytes: 1, sha256: "x" }, f.ins.id)
      expect((await remove(f.ins.email, o!.id)).status).toBe(404)
      expect((await f.db.query(`SELECT 1 FROM material_attachments WHERE id = $1::int`, [o!.id])).rows).toHaveLength(1)
    })

    it("deleting the Material sweeps its Attachments' bytes", async () => {
      await uploaded(f.ins.email, "a.pdf", "aaa")
      await uploaded(f.ins.email, "b.pdf", "bbb")
      await ageStore()
      const res = await deleteMaterialRoute(
        withSession(new NextRequest("http://localhost/api/x", { method: "DELETE" }), f.ins.email),
        at(3, "slides")
      )
      expect(res.status).toBe(200)
      expect(await storedFiles()).toEqual([])
    })

    it("deleting the Course sweeps its Materials' Attachment bytes", async () => {
      await uploaded(f.ins.email, "a.pdf", "aaa")
      await ageStore()
      const res = await deleteCourseRoute(
        withSession(new NextRequest("http://localhost/api/x", { method: "DELETE" }), f.ins.email),
        { params: Promise.resolve(course()) }
      )
      expect(res.status).toBe(200)
      expect(await storedFiles()).toEqual([])
    })

    it("a failing sweep never fails the request", async () => {
      const a = await uploaded(f.ins.email, "a.pdf")
      // A store root that is a file, not a folder: the sweep throws.
      const notADir = path.join(dir, "not-a-dir")
      await writeFile(notADir, "x")
      setTestAttachmentStore(notADir)
      const errors = vi.spyOn(console, "error").mockImplementation(() => {})
      expect((await remove(f.ins.email, a.id)).status).toBe(200)
      expect(errors).toHaveBeenCalledWith("attachment sweep failed", expect.anything())
      errors.mockRestore()
    })

    it("logs replace and remove as material.update, naming the Material and the file", async () => {
      const a = await uploaded(f.ins.email, "slides.pdf", "v1")
      await replace("slides.pdf", "v2")
      await remove(f.ins.email, a.id)
      expect(await details()).toEqual(["attach 3/slides slides.pdf", "replace 3/slides slides.pdf", "remove 3/slides slides.pdf"])
    })

    describe("Course Duplication (#117)", () => {
      // The copy: the same course in 2568/1, made by the duplicate route.
      const copy = () => ({ code: f.course.code, year: "2568", semester: "1" })
      const duplicate = () =>
        DUPLICATE(
          withSession(
            new NextRequest("http://localhost/api/x", { method: "POST", body: JSON.stringify({ year: 2568, semester: 1 }) }),
            f.ins.email
          ),
          { params: Promise.resolve(course()) }
        )
      const copiedAttachments = async () => {
        const res = await getOne(withSession(new NextRequest("http://localhost/api/x"), f.ins.email), {
          params: Promise.resolve({ ...copy(), week: "3", kind: "slides" }),
        })
        return (await res.json()).attachments as { id: number; name: string }[]
      }
      const inCopy = {
        download: (aid: number) =>
          DOWNLOAD(withSession(new NextRequest("http://localhost/api/x"), f.ins.email), {
            params: Promise.resolve({ ...copy(), aid: String(aid) }),
          }),
        replace: (name: string, content: string) => {
          const form = new FormData()
          form.set("file", new File([content], name))
          form.set("replace", "true")
          return UPLOAD(withSession(new NextRequest("http://localhost/api/x", { method: "POST", body: form }), f.ins.email), {
            params: Promise.resolve({ ...copy(), week: "3", kind: "slides" }),
          })
        },
        remove: (aid: number) =>
          REMOVE(withSession(new NextRequest("http://localhost/api/x", { method: "DELETE" }), f.ins.email), {
            params: Promise.resolve({ ...copy(), aid: String(aid) }),
          }),
      }

      it("copies every Material's Attachments by name and hash — no bytes are copied", async () => {
        const a = await uploaded(f.ins.email, "diagram.png", "png")
        await uploaded(f.ins.email, "slides.pdf", "pdf")
        const before = await storedFiles()
        expect((await duplicate()).status).toBe(201)

        const copied = await copiedAttachments()
        expect(copied.map((x) => x.name)).toEqual(["diagram.png", "slides.pdf"])
        expect(copied[0].id).not.toBe(a.id)
        const hashes = await f.db.query<{ sha256: string; n: number }>(
          `SELECT sha256, COUNT(*)::int AS n FROM material_attachments GROUP BY sha256`
        )
        expect(hashes.rows.map((r) => r.n)).toEqual([2, 2]) // each source file now named by two rows
        expect(await storedFiles()).toEqual(before)
        expect(await (await inCopy.download(copied[0].id)).text()).toBe("png")
      })

      it("replacing or deleting an Attachment on the copy leaves the source's Attachment and file alone", async () => {
        const a = await uploaded(f.ins.email, "slides.pdf", "v1")
        const b = await uploaded(f.ins.email, "notes.txt", "keep")
        await duplicate()
        const [copiedA, copiedB] = await copiedAttachments()
        await ageStore()

        expect((await inCopy.replace("slides.pdf", "v2")).status).toBe(200)
        expect(await (await inCopy.download(copiedA.id)).text()).toBe("v2")
        expect(await (await download(f.ins.email, a.id)).text()).toBe("v1")

        expect((await inCopy.remove(copiedB.id)).status).toBe(200)
        expect(await (await download(f.ins.email, b.id)).text()).toBe("keep")
      })
    })
  })
})
