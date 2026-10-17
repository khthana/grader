import { describe, it, expect } from "vitest"
import { applyFormat, type FormatKind } from "./markdown-toolbar"

// The toolbar's text transforms (#98): (text, selection, kind) → (text, selection).
// `[` and `]` mark the selection in these cases; `|` is a collapsed cursor.
function parse(marked: string) {
  const cursor = marked.indexOf("|")
  if (cursor >= 0) return { text: marked.replace("|", ""), selection: { start: cursor, end: cursor } }
  const start = marked.indexOf("[")
  const end = marked.indexOf("]") - 1
  return { text: marked.replace("[", "").replace("]", ""), selection: { start, end } }
}
function mark({ text, selection: { start, end } }: { text: string; selection: { start: number; end: number } }) {
  if (start === end) return text.slice(0, start) + "|" + text.slice(start)
  return text.slice(0, start) + "[" + text.slice(start, end) + "]" + text.slice(end)
}
const run = (marked: string, kind: FormatKind) => {
  const { text, selection } = parse(marked)
  return mark(applyFormat(text, selection, kind))
}

describe("applyFormat — inline (bold, italic)", () => {
  it.each([
    ["bold", "ab [cd] ef", "ab **[cd]** ef"],
    ["italic", "ab [cd] ef", "ab *[cd]* ef"],
    ["bold", "ab | ef", "ab **|** ef"],
    ["italic", "|", "*|*"],
    ["bold", "[line one\nline two]", "**[line one\nline two]**"],
  ] as const)("%s: %j → %j", (kind, input, expected) => {
    expect(run(input, kind)).toBe(expected)
  })

  it("unwraps a selection that is already wrapped (a second click undoes the first)", () => {
    expect(run("ab **[cd]** ef", "bold")).toBe("ab [cd] ef")
    expect(run("ab *[cd]* ef", "italic")).toBe("ab [cd] ef")
  })

  it("italic does not unwrap bold", () => {
    expect(run("ab **[cd]** ef", "italic")).toBe("ab ***[cd]*** ef")
  })

  it("a second click on an empty pair removes it instead of stacking markers", () => {
    expect(run("ab **|** ef", "bold")).toBe("ab | ef")
  })

  it("does not unwrap text that only sits between two neighbouring bold spans", () => {
    expect(run("**x**[cd]**y**", "bold")).toBe("**x****[cd]****y**")
  })

  it("leaves whitespace at the edges of the selection outside the markers (as a double-click selects it)", () => {
    expect(run("ab [cd ]ef", "bold")).toBe("ab **[cd]** ef")
    expect(run("ab[ cd] ef", "italic")).toBe("ab *[cd]* ef")
  })
})

describe("applyFormat — lists (bullet, numbered)", () => {
  it.each([
    ["bullet", "|", "- |"],
    // A cursor formats its own line and lands at the end of it, ready to type on.
    ["bullet", "ab|c", "- abc|"],
    ["numbered", "ab|c", "1. abc|"],
    ["bullet", "[one\ntwo\nthree]", "[- one\n- two\n- three]"],
    ["numbered", "[one\ntwo\nthree]", "[1. one\n2. two\n3. three]"],
    // Every line the selection touches, even partly.
    ["numbered", "intro\no[ne\ntw]o\nend", "intro\n[1. one\n2. two]\nend"],
    // A selection ending at the very start of a line doesn't take that line.
    ["bullet", "[one\n]two", "[- one]\ntwo"],
    // Indentation (a nested item) is kept; the marker goes after it.
    ["bullet", "[one\n  sub]", "[- one\n  - sub]"],
  ] as const)("%s: %j → %j", (kind, input, expected) => {
    expect(run(input, kind)).toBe(expected)
  })

  it("skips blank lines inside a multi-line selection, numbering only the items", () => {
    expect(run("[one\n\ntwo]", "numbered")).toBe("[1. one\n\n2. two]")
  })

  it("numbers a nested level from 1 on its own, and resumes the outer count", () => {
    expect(run("[one\n  sub a\n  sub b\ntwo]", "numbered")).toBe("[1. one\n  1. sub a\n  2. sub b\n2. two]")
  })

  it("formats the first line when the text starts with a blank line and the cursor is at 0", () => {
    expect(run("|\nabc", "bullet")).toBe("- |\nabc")
  })

  it("doesn't take a year at the start of a line for a list number (it would be lost)", () => {
    expect(run("[2567. ปีการศึกษา]", "bullet")).toBe("[- 2567. ปีการศึกษา]")
  })

  it("switches one list kind to the other instead of stacking markers", () => {
    expect(run("[- one\n- two]", "numbered")).toBe("[1. one\n2. two]")
    expect(run("[1. one\n2. two]", "bullet")).toBe("[- one\n- two]")
  })

  it("removes the list when every line already is that kind (a second click undoes the first)", () => {
    expect(run("[- one\n- two]", "bullet")).toBe("[one\ntwo]")
    expect(run("[1. one\n2. two]", "numbered")).toBe("[one\ntwo]")
  })

  it("renumbers from 1 when some lines are already numbered", () => {
    expect(run("[3. one\ntwo]", "numbered")).toBe("[1. one\n2. two]")
  })

  it("leaves the text outside the touched lines alone", () => {
    expect(run("before\n[x]\nafter", "bullet")).toBe("before\n[- x]\nafter")
  })
})
