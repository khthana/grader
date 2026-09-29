export function checkCodePolicy(
  code: string,
  blacklist: string[],
  whitelist: string[]
): { ok: boolean; violations: string[] } {
  const violations: string[] = []

  for (const term of blacklist) {
    if (termPattern(term).test(code)) {
      violations.push(term)
    }
  }

  for (const term of whitelist) {
    if (!termPattern(term).test(code)) {
      violations.push(term)
    }
  }

  return { ok: violations.length === 0, violations }
}

// Whole-word match, but only on an edge that is itself a word character:
// `sort` must not match inside `quicksort`, while a symbol-edged term like
// `sum(` or `.sort` needs no boundary on its symbol side (`\b` there would
// require a word char next to the symbol and so almost never match — #67).
function termPattern(term: string): RegExp {
  const start = /^\w/.test(term) ? "(?<!\\w)" : ""
  const end = /\w$/.test(term) ? "(?!\\w)" : ""
  return new RegExp(`${start}${escapeRegex(term)}${end}`)
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
