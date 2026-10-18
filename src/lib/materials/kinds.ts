// Material Kinds (#109) — the fixed kinds of Teaching Material, in the order
// every outline, route param and breadcrumb shows them. The only list of Kinds.

export const MATERIAL_KINDS = ["slides", "handout", "lab"] as const

export type MaterialKind = (typeof MATERIAL_KINDS)[number]

const LABELS: Record<MaterialKind, string> = {
  slides: "สไลด์",
  handout: "เอกสารประกอบ",
  lab: "ใบงานปฏิบัติการ",
}

// The Materials table's column headings (#120) — short enough for a phone.
const COLUMN_LABELS: Record<MaterialKind, string> = { ...LABELS, lab: "ใบงาน" }

export function isMaterialKind(value: unknown): value is MaterialKind {
  return typeof value === "string" && (MATERIAL_KINDS as readonly string[]).includes(value)
}

export function materialKindLabel(kind: MaterialKind): string {
  return LABELS[kind]
}

export function materialKindColumnLabel(kind: MaterialKind): string {
  return COLUMN_LABELS[kind]
}
