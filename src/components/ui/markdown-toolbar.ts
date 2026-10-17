// The Markdown toolbar's text transforms (#98) — pure, so they're tested
// without a DOM. MarkdownField applies the result to its textarea.

export type FormatKind = "bold" | "italic" | "bullet" | "numbered"

export interface TextSelection {
  start: number
  end: number
}

export interface FormatResult {
  text: string
  selection: TextSelection
}

const INLINE_MARKER: Record<"bold" | "italic", string> = { bold: "**", italic: "*" }

export function applyFormat(text: string, selection: TextSelection, kind: FormatKind): FormatResult {
  return kind === "bold" || kind === "italic"
    ? toggleInline(text, selection, INLINE_MARKER[kind])
    : toggleList(text, selection, kind)
}

// Wrap the selection in the marker (or put an empty pair at the cursor).
// Whitespace at the selection's edges stays outside — `**cd **` isn't bold in
// Markdown. A selection already wrapped in exactly this marker (or in
// bold+italic `***`) is unwrapped, so a second click undoes the first.
function toggleInline(text: string, selection: TextSelection, marker: string): FormatResult {
  const { start, end } = trimSelection(text, selection)
  const n = marker.length
  if (isWrapped(text, start, end, n)) {
    return {
      text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n),
      selection: { start: start - n, end: end - n },
    }
  }
  return {
    text: text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end),
    selection: { start: start + n, end: end + n },
  }
}

function trimSelection(text: string, { start, end }: TextSelection): TextSelection {
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return { start, end }
}

// The star runs on both sides match the marker and stand at a word boundary —
// text between two neighbouring spans (`**x**cd**y**`) isn't wrapped.
function isWrapped(text: string, start: number, end: number, n: number): boolean {
  const before = /\*+$/.exec(text.slice(0, start))?.[0].length ?? 0
  const after = /^\*+/.exec(text.slice(end))?.[0].length ?? 0
  if (before !== after || (before !== n && before !== 3)) return false
  const outerBefore = text[start - before - 1]
  const outerAfter = text[end + after]
  return !isWordChar(outerBefore) && !isWordChar(outerAfter)
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c)

// `  - item` / `  12. item` → indentation, marker kind, content. A number is a
// list marker only up to three digits, so a year (`2567. ปีการศึกษา`) stays text.
const LIST_LINE = /^(\s*)(?:([-*+])|(\d{1,3})\.)\s(.*)$/

function listKindOf(line: string): "bullet" | "numbered" | null {
  const m = LIST_LINE.exec(line)
  return m ? (m[2] ? "bullet" : "numbered") : null
}

// Make every line the selection touches an item of this list kind, keeping
// each line's indentation (a nested level numbers from 1 on its own); blank
// lines are skipped unless the cursor is on one. Lines that already are all
// this kind lose their marker instead.
function toggleList(text: string, { start, end }: TextSelection, kind: "bullet" | "numbered"): FormatResult {
  const from = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1
  // A selection that ends right at a line start doesn't take that line.
  const last = end > start && text[end - 1] === "\n" ? end - 1 : end
  const lineEnd = text.indexOf("\n", last)
  const to = lineEnd === -1 ? text.length : lineEnd

  const lines = text.slice(from, to).split("\n")
  const items = lines.filter((l) => l.trim() !== "")
  const removing = items.length > 0 && items.every((l) => listKindOf(l) === kind)

  // Item count per indentation width; a shallower line ends the deeper levels.
  const counts = new Map<number, number>()
  const formatted = lines.map((line) => {
    if (line.trim() === "" && lines.length > 1) return line
    const m = LIST_LINE.exec(line)
    const indent = m ? m[1] : /^\s*/.exec(line)![0]
    const content = m ? m[4] : line.slice(indent.length)
    if (removing) return indent + content
    for (const depth of counts.keys()) if (depth > indent.length) counts.delete(depth)
    const n = (counts.get(indent.length) ?? 0) + 1
    counts.set(indent.length, n)
    return indent + (kind === "bullet" ? "- " : `${n}. `) + content
  })

  const block = formatted.join("\n")
  const blockEnd = from + block.length
  return {
    text: text.slice(0, from) + block + text.slice(to),
    selection: start === end ? { start: blockEnd, end: blockEnd } : { start: from, end: blockEnd },
  }
}
