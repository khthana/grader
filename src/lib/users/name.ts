interface NameSource {
  firstNameTh?: string | null
  lastNameTh?: string | null
  name?: string | null
}

// Prefer the structured Thai name; otherwise derive it from the display name
// (first token → first name, the rest → last name) so the edit form is never
// blank for legacy/imported users that only have a display name.
export function resolveNameFields(d: NameSource): { firstNameTh: string; lastNameTh: string } {
  const first = (d.firstNameTh ?? "").trim()
  const last = (d.lastNameTh ?? "").trim()
  if (first || last) return { firstNameTh: first, lastNameTh: last }

  const parts = (d.name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstNameTh: "", lastNameTh: "" }
  return { firstNameTh: parts[0], lastNameTh: parts.slice(1).join(" ") }
}
