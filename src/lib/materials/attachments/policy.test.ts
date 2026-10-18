import { describe, it, expect } from "vitest"
import {
  attachmentHeaders,
  checkUpload,
  IMAGE_ACCEPT,
  isAtAttachmentLimit,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MATERIAL,
} from "./policy"

// What a Teaching Material accepts as an Attachment, and how one is served (#114, ADR 0013).
describe("checkUpload", () => {
  it.each([
    "slides.pdf", "deck.pptx", "old.ppt", "sheet.docx", "old.doc", "data.xlsx", "old.xls", "data.csv",
    "notes.txt", "readme.md", "main.py", "main.c", "main.cpp", "lib.h", "lab3.ipynb",
    "a.png", "b.jpg", "c.jpeg", "d.gif", "e.webp", "starter.zip", "SLIDES.PDF", "Photo.JPG",
  ])("accepts %s", (name) => {
    expect(checkUpload({ name, size: 10 })).toMatchObject({ ok: true, name })
  })

  it.each(["logo.svg", "setup.exe", "page.html", "run.sh", "Makefile", "archive.tar.gz", "noext."])(
    "refuses the type of %s",
    (name) => {
      expect(checkUpload({ name, size: 10 })).toMatchObject({ ok: false, reason: "type" })
    }
  )

  it("takes its content type from the allow-list, never the client", () => {
    expect(checkUpload({ name: "a.pdf", size: 1 })).toMatchObject({ contentType: "application/pdf" })
    expect(checkUpload({ name: "a.PNG", size: 1 })).toMatchObject({ contentType: "image/png" })
    expect(checkUpload({ name: "main.py", size: 1 })).toMatchObject({ contentType: "text/x-python; charset=utf-8" })
  })

  it("allows exactly 50 MB, refuses one byte more", () => {
    expect(checkUpload({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES }).ok).toBe(true)
    expect(checkUpload({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES + 1 })).toMatchObject({ ok: false, reason: "size" })
  })

  it("keeps only the file name — any path is stripped — trimmed", () => {
    expect(checkUpload({ name: "C:\\Users\\me\\slides.pdf", size: 1 })).toMatchObject({ ok: true, name: "slides.pdf" })
    expect(checkUpload({ name: "../../etc/  week 3.png ", size: 1 })).toMatchObject({ ok: true, name: "week 3.png" })
    expect(checkUpload({ name: "สไลด์บทที่ 3.pdf", size: 1 })).toMatchObject({ ok: true, name: "สไลด์บทที่ 3.pdf" })
  })

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["only a path", "folder/"],
    ["a control character", "a\u0000b.pdf"],
    ["over 200 characters", `${"a".repeat(197)}.pdf`],
  ])("refuses a name that is %s", (_label, name) => {
    expect(checkUpload({ name, size: 1 })).toMatchObject({ ok: false, reason: "name" })
  })

  it("a refusal carries a message to show", () => {
    const result = checkUpload({ name: "a.svg", size: 1 })
    expect(result.ok === false && result.error.length > 0).toBe(true)
  })
})

describe("isAtAttachmentLimit", () => {
  it("a Material holds at most 20 Attachments", () => {
    expect(isAtAttachmentLimit(MAX_ATTACHMENTS_PER_MATERIAL - 1)).toBe(false)
    expect(isAtAttachmentLimit(MAX_ATTACHMENTS_PER_MATERIAL)).toBe(true)
  })
})

describe("attachmentHeaders", () => {
  const headers = (name: string, contentType: string) => attachmentHeaders({ name, contentType, sizeBytes: 42 })

  it("an image is shown inline; everything else downloads", () => {
    expect(headers("a.png", "image/png")["Content-Disposition"]).toMatch(/^inline;/)
    expect(headers("a.pdf", "application/pdf")["Content-Disposition"]).toMatch(/^attachment;/)
    expect(headers("notes.txt", "text/plain; charset=utf-8")["Content-Disposition"]).toMatch(/^attachment;/)
  })

  it("always sends nosniff, the stored type and the length", () => {
    const h = headers("a.pdf", "application/pdf")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["Content-Type"]).toBe("application/pdf")
    expect(h["Content-Length"]).toBe("42")
  })

  it("names a Thai file with an RFC 5987 filename* and an ASCII fallback", () => {
    const d = headers("สไลด์ (1).pdf", "application/pdf")["Content-Disposition"]
    expect(d).toContain(`filename*=UTF-8''${encodeURIComponent("สไลด์")}%20%281%29.pdf`)
    expect(d).toMatch(/filename="[\x20-\x7e]+"/)
    expect(d).not.toMatch(/filename="[^"]*[^\x20-\x7e]/)
  })

  it("a quote in the name can't break the header", () => {
    const d = headers('a"b.pdf', "application/pdf")["Content-Disposition"]
    expect(d).toContain('filename="a_b.pdf"')
  })
})

describe("IMAGE_ACCEPT", () => {
  it("offers \"แทรกรูป\" only the allowed images that show inline (#116)", () => {
    expect(IMAGE_ACCEPT.split(",")).toEqual([".png", ".jpg", ".jpeg", ".gif", ".webp"])
    for (const ext of IMAGE_ACCEPT.split(",")) expect(checkUpload({ name: `a${ext}`, size: 1 })).toMatchObject({ ok: true })
  })
})
