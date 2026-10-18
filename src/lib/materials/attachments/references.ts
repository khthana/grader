// `attachment:` references (#116, ADR 0013) — the one rule for how a Teaching
// Material's body refers to its Attachments. A reference names the file, never
// its id, and resolves against the Material's own Attachments each time the
// body renders — so it survives a move to another week and a duplicated
// course. Pure.

import { defaultUrlTransform } from "react-markdown"

const SCHEME = /^attachment:/i

/** Where an Attachment downloads from. */
export const attachmentUrl = (courseSlug: string, id: number) =>
  `/api/courses/${courseSlug}/materials/attachments/${id}`

// The name a URL refers to (URL-decoded — Markdown percent-encodes spaces and
// Thai), or null when it isn't an `attachment:` URL.
function referencedName(url: string): string | null {
  if (!SCHEME.test(url)) return null
  const raw = url.replace(SCHEME, "")
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw // a malformed escape names no Attachment
  }
}

/**
 * The renderer's URL transform for one Material: `attachment:<name>` → that
 * Attachment's download URL, or "" when it has none (a broken image or link);
 * anything else goes through react-markdown's own sanitising, unchanged.
 */
export function attachmentUrlTransform(
  courseSlug: string,
  attachments: readonly { id: number; name: string }[]
): (url: string) => string {
  const urls = new Map(attachments.map((a) => [a.name, attachmentUrl(courseSlug, a.id)]))
  return (url) => {
    const name = referencedName(url)
    return name === null ? defaultUrlTransform(url) : (urls.get(name) ?? "")
  }
}

// `](attachment:…)` / `](<attachment:…>)` inline (a `\)` escape doesn't end it),
// and `[x]: attachment:…` definitions.
const REFERENCE =
  /\]\(\s*(?:<(attachment:[^>\n]*)>|(attachment:(?:\\.|[^\s)\\])*))|^ {0,3}\[[^\]\n]+\]:\s*<?(attachment:[^\s>]+)>?/gim
// Code shows its text, never a reference: fenced blocks and inline spans.
const CODE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))|`[^`\n]+`/gm
// Markdown's backslash escapes (`\(`), as the renderer reads them.
const unescape = (s: string) => s.replace(/\\([!-/:-@[-`{-~])/g, "$1")

/** The names the body refers to that no Attachment has, each once, in order — the editor's warning. */
export function missingReferences(body: string, names: Iterable<string>): string[] {
  const present = new Set(names)
  const missing = new Set<string>()
  for (const match of body.replace(CODE, "").matchAll(REFERENCE)) {
    const name = referencedName(unescape(match[1] ?? match[2] ?? match[3]))
    if (name !== null && !present.has(name)) missing.add(name)
  }
  return [...missing]
}

const hex = (c: string) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`

/** The Markdown that shows (`image`) or links an Attachment by name — what "แทรกรูป" inserts. */
export function attachmentReference(name: string, { image }: { image: boolean }): string {
  const text = name.replace(/[[\]\\]/g, "\\$&")
  // Encode what would end the URL early; the rest (Thai included) stays readable.
  const target = name.replace(/[%\s()<>]/g, hex)
  return `${image ? "!" : ""}[${text}](attachment:${target})`
}
