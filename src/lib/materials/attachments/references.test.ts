import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { attachmentUrlTransform, missingReferences } from "./references"

// `attachment:` references in a Teaching Material's body (#116, ADR 0013):
// resolved by name against the Material's own Attachments at render time.
const SLUG = "C01/2567/1"
const attachments = [
  { id: 7, name: "array-diagram.png" },
  { id: 8, name: "week 3.png" },
  { id: 9, name: "สไลด์ (1).pdf" },
]
const resolve = attachmentUrlTransform(SLUG, attachments)
const url = (id: number) => `/api/courses/${SLUG}/materials/attachments/${id}`

describe("attachmentUrlTransform", () => {
  it.each([
    ["a known name", "attachment:array-diagram.png", url(7)],
    ["a URL-encoded name", "attachment:week%203.png", url(8)],
    ["a percent-encoded Thai name with parens", "attachment:%E0%B8%AA%E0%B9%84%E0%B8%A5%E0%B8%94%E0%B9%8C%20%281%29.pdf", url(9)],
    ["the scheme in capitals", "ATTACHMENT:array-diagram.png", url(7)],
    ["an unknown name", "attachment:gone.png", ""],
    ["a malformed escape", "attachment:%E0%A4%A.png", ""],
    ["an https link, unchanged", "https://docs.python.org/3/", "https://docs.python.org/3/"],
    ["a relative link, unchanged", "/courses/C01/2567/1/syllabus", "/courses/C01/2567/1/syllabus"],
    ["an anchor, unchanged", "#week-3", "#week-3"],
    ["javascript:, still dropped", "javascript:alert(1)", ""],
  ])("%s", (_, input, expected) => {
    expect(resolve(input)).toBe(expected)
  })
})

describe("missingReferences", () => {
  const names = attachments.map((a) => a.name)

  it.each([
    ["no references", "# Hi\n\n[docs](https://x.y)", []],
    ["every reference present", "![d](attachment:array-diagram.png) [s](attachment:week%203.png)", []],
    ["an image and a link missing", "![a](attachment:a.png)\n[b](attachment:b.pdf)", ["a.png", "b.pdf"]],
    ["a name listed once", "![a](attachment:a.png) ![a again](attachment:a.png)", ["a.png"]],
    ["an angle-bracket URL", "![a](<attachment:my file.png>)", ["my file.png"]],
    ["a URL with a title", '![a](attachment:a.png "title")', ["a.png"]],
    ["a reference definition", "![a][d]\n\n[d]: attachment:defined.png", ["defined.png"]],
    ["only the missing ones", "![x](attachment:array-diagram.png) ![y](attachment:nope.png)", ["nope.png"]],
    ["backslash escapes, read as the renderer does", "![a](attachment:a\\(1\\).png) ![b](attachment:b\\_c.png)", ["a(1).png", "b_c.png"]],
    ["references in code are text", "```md\n![a](attachment:a.png)\n```\n\n`![b](attachment:b.png)` ![c](attachment:c.png)", ["c.png"]],
  ])("%s", (_, body, expected) => {
    expect(missingReferences(body, names)).toEqual(expected)
  })
})

// The shared renderer as Teaching Materials use it: references resolved, and
// no image shown — an image is a link to its file (#119).
describe("MarkdownContent for a Teaching Material", () => {
  const material = (content: string) =>
    renderToStaticMarkup(createElement(MarkdownContent, { content, urlTransform: resolve, imagesAsLinks: true }))
  const plain = (content: string) => renderToStaticMarkup(createElement(MarkdownContent, { content }))

  it("links a file by name", () => {
    expect(material("[s](attachment:week%203.png)")).toContain(`href="${url(8)}"`)
  })

  it("an Attachment image is a link to its download, named by its alt text", () => {
    const html = material("![แผนภาพ](attachment:array-diagram.png)")
    expect(html).not.toContain("<img")
    expect(html).toMatch(new RegExp(`<a href="${url(7)}"[^>]*>แผนภาพ</a>`))
  })

  it.each([
    ["an Attachment", "![](attachment:week%203.png)", url(8), "week 3.png"],
    ["an outside image", "![](https://example.com/img/logo.png?v=2)", "https://example.com/img/logo.png?v=2", "logo.png"],
  ])("an image without alt text is labelled by its file name: %s", (_, content, href, label) => {
    const html = material(content)
    expect(html).toContain(`<a href="${href}"`)
    expect(html).toMatch(new RegExp(`>${label.replace(/\./g, "\\.")}</a>`))
  })

  it("an external image is a link too", () => {
    const html = material("![logo](https://example.com/logo.png)")
    expect(html).not.toContain("<img")
    expect(html).toContain('href="https://example.com/logo.png"')
  })

  it("an unknown name is a link to nowhere, never another URL", () => {
    const html = material("![x](attachment:gone.png)")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("attachment:")
    expect(html).toContain('href=""')
  })

  it("Problems and the Syllabus still show images, and leave attachment: alone", () => {
    const html = plain("![logo](https://example.com/logo.png) [x](attachment:array-diagram.png)")
    expect(html).toContain('<img src="https://example.com/logo.png"')
    expect(html).not.toContain(url(7))
  })
})
