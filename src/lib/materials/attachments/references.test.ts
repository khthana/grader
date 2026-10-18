import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { attachmentReference, attachmentUrlTransform, missingReferences } from "./references"

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

describe("attachmentReference", () => {
  it.each([
    ["an image", "diagram.png", true, "![diagram.png](attachment:diagram.png)"],
    ["a link", "slides.pdf", false, "[slides.pdf](attachment:slides.pdf)"],
    ["spaces and parens are encoded", "week 3 (a).png", true, "![week 3 (a).png](attachment:week%203%20%28a%29.png)"],
    ["brackets in the text are escaped", "a[1].png", true, "![a\\[1\\].png](attachment:a[1].png)"],
  ])("%s", (_, name, image, expected) => {
    expect(attachmentReference(name, { image })).toBe(expected)
  })

  it("every inserted reference resolves back to its Attachment", () => {
    for (const { name } of attachments) {
      expect(missingReferences(attachmentReference(name, { image: true }), [name])).toEqual([])
    }
  })
})

// The shared renderer, through the transform only Teaching Materials pass.
describe("MarkdownContent with attachment references", () => {
  const render = (content: string, urlTransform?: (url: string) => string) =>
    renderToStaticMarkup(createElement(MarkdownContent, { content, urlTransform }))

  it("shows an Attachment image and links a file by name", () => {
    const html = render("![d](attachment:array-diagram.png)\n\n[s](attachment:week%203.png)", resolve)
    expect(html).toContain(`src="${url(7)}"`)
    expect(html).toContain(`href="${url(8)}"`)
  })

  it("an unknown name renders as a broken image, never another URL", () => {
    expect(render("![x](attachment:gone.png)", resolve)).not.toContain("attachment:")
  })

  it("without the transform (Problems, Syllabus) Markdown works as before", () => {
    const html = render("[docs](https://docs.python.org/3/) [x](attachment:array-diagram.png)")
    expect(html).toContain('href="https://docs.python.org/3/"')
    expect(html).not.toContain(url(7))
  })
})
