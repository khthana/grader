import { describe, it, expect } from "vitest"
import { isExternalLink } from "./markdown-links"

// Which Markdown links open in a new tab (#106): only http(s) links that lead
// outside CE-Grader. `appOrigin` is null while it isn't known (server render).
describe("isExternalLink", () => {
  const app = "https://grader.example.ac.th"

  it.each([
    ["another host", "https://docs.python.org/3/", app, true],
    ["another host over http", "http://example.com", app, true],
    ["protocol-relative to another host", "//example.com/x", app, true],
    ["same origin, absolute", "https://grader.example.ac.th/courses/C01/2567/1", app, false],
    ["same host, other port", "https://grader.example.ac.th:8443/x", app, true],
    ["relative path", "/courses/C01/2567/1/syllabus", app, false],
    ["relative file", "notes.md", app, false],
    ["in-page anchor", "#week-3", app, false],
    ["mailto", "mailto:someone@kmitl.ac.th", app, false],
    ["tel", "tel:021234567", app, false],
    ["empty", "", app, false],
    ["missing", undefined, app, false],
    ["unknown origin — absolute is external", "https://docs.python.org", null, true],
    ["unknown origin — relative stays", "/courses", null, false],
  ] as const)("%s: %j → %s", (_, href, origin, external) => {
    expect(isExternalLink(href, origin)).toBe(external)
  })
})
