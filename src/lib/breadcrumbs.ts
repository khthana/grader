export interface Crumb {
  label: string
  href: string
}

const HOME: Crumb = { label: "หน้าหลัก", href: "/dashboard" }

// Path segment → Thai label. "dashboard" is represented by the home crumb.
const SEGMENT_LABELS: Record<string, string> = {
  users: "จัดการผู้ใช้",
  logs: "บันทึกกิจกรรม",
  students: "รายชื่อนักศึกษา",
  problems: "โจทย์ปัญหา",
  review: "ตรวจงาน",
  gradebook: "สมุดคะแนน",
  assignments: "งานที่ได้มอบหมาย",
}

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function deriveBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: Crumb[] = [HOME]

  let href = ""
  for (const segment of segments) {
    href += `/${segment}`
    if (segment === "dashboard") continue // already the home crumb
    crumbs.push({ label: labelFor(segment), href })
  }

  return crumbs
}
