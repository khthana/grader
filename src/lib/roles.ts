export type Role = "Admin" | "Instructor" | "TA" | "Student"

export interface MenuItem {
  label: string
  href: string
  icon: string
  courseScoped?: boolean
}

const MENU = {
  userManagement: { label: "จัดการผู้ใช้", href: "/users", icon: "users" },
  logs: { label: "บันทึกกิจกรรม", href: "/logs", icon: "logs" },
  courses: { label: "รายวิชา", href: "/courses", icon: "courses" },
  students: { label: "รายชื่อนักศึกษา", href: "/students", icon: "students", courseScoped: true },
  problems: { label: "โจทย์ปัญหา", href: "/problems", icon: "problems", courseScoped: true },
  review: { label: "ตรวจงาน", href: "/review", icon: "review", courseScoped: true },
  gradebook: { label: "สมุดคะแนน", href: "/gradebook", icon: "gradebook", courseScoped: true },
  assignments: { label: "งานที่ได้มอบหมาย", href: "/assignments", icon: "assignments", courseScoped: true },
} satisfies Record<string, MenuItem>

const TEACHING_MENU: MenuItem[] = [
  MENU.students,
  MENU.problems,
  MENU.review,
  MENU.gradebook,
]

const SIDEBAR_MENU: Record<Role, MenuItem[]> = {
  // Admin is the superset: User Management + activity log + course mgmt + teaching.
  Admin: [MENU.userManagement, MENU.logs, MENU.courses, ...TEACHING_MENU],
  // Instructor manages courses; TA gets the teaching menu without course mgmt.
  Instructor: [MENU.courses, ...TEACHING_MENU],
  TA: TEACHING_MENU,
  // The Scorebook is staff-only; a Student sees only their own assignments.
  Student: [MENU.assignments],
}

export function getSidebarMenu(role: Role): MenuItem[] {
  return SIDEBAR_MENU[role]
}

const LANDING_ROUTE: Record<Role, string> = {
  Admin: "/users",
  Instructor: "/students",
  TA: "/students",
  Student: "/assignments",
}

export function getLandingRoute(role: Role): string {
  return LANDING_ROUTE[role]
}

// Highest → lowest privilege. Admin is the superset.
const ROLE_PRIORITY: Role[] = ["Admin", "Instructor", "TA", "Student"]

export const ALL_ROLES: Role[] = ["Admin", "Instructor", "TA", "Student"]

export function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value)
}

export function getAssignableRoles(role: Role): Role[] {
  return role === "Admin" ? [...ALL_ROLES] : []
}

export function resolveActiveRole(roles: Role[], requested?: Role): Role | null {
  if (requested && roles.includes(requested)) return requested
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role
  }
  return null
}
