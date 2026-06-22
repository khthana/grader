export function checkCodePolicy(
  code: string,
  blacklist: string[],
  whitelist: string[]
): { ok: boolean; violations: string[] } {
  const violations: string[] = []

  for (const term of blacklist) {
    if (new RegExp(`\\b${escapeRegex(term)}\\b`).test(code)) {
      violations.push(term)
    }
  }

  for (const term of whitelist) {
    if (!new RegExp(`\\b${escapeRegex(term)}\\b`).test(code)) {
      violations.push(term)
    }
  }

  return { ok: violations.length === 0, violations }
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
