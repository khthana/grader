"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { getSidebarMenu, type Role, type MenuItem } from "@/lib/roles"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { ToastProvider } from "./ToastProvider"
import { ImpersonationBanner } from "./ImpersonationBanner"

export interface CourseOption {
  code: string
  year: number
  semester: number
  nameTh: string
}

interface AppShellProps {
  name: string
  picture: string | null
  roles: Role[]
  activeRole: Role
  courses: CourseOption[]
  activeCourseSlug: string | null
  impersonatedName?: string | null
  children: ReactNode
}

export function AppShell({
  name,
  picture,
  roles,
  activeRole,
  courses,
  activeCourseSlug,
  impersonatedName,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const rawMenu = getSidebarMenu(activeRole)

  // For course-scoped menu items, detect the active course from the URL first,
  // then fall back to the cookie-indicated slug so the sidebar links always
  // point to the right course path.
  const urlCourse = courses.find(
    (c) => pathname.startsWith(`/courses/${c.code}/${c.year}/${c.semester}`)
  )
  const cookieCourse = activeCourseSlug
    ? courses.find((c) => `${c.code}/${c.year}/${c.semester}` === activeCourseSlug)
    : undefined
  const activeCourse = urlCourse ?? cookieCourse ?? courses[0] ?? null

  const courseBasePath = activeCourse
    ? `/courses/${activeCourse.code}/${activeCourse.year}/${activeCourse.semester}`
    : null

  const menu: MenuItem[] = rawMenu.map((item) =>
    item.courseScoped && courseBasePath
      ? { ...item, href: `${courseBasePath}/${item.href.replace(/^\//, "")}` }
      : item
  )

  return (
    <ToastProvider>
      <Navbar
        name={name}
        picture={picture}
        roles={roles}
        activeRole={activeRole}
        courses={courses}
        activeCourseSlug={activeCourseSlug}
      />
      <div className="flex min-h-screen bg-[#F8FAFC] pt-[64px]">
        <Sidebar menu={menu} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className="flex min-w-0 flex-1 flex-col">
          {impersonatedName && <ImpersonationBanner userName={impersonatedName} />}
          <Breadcrumbs />
          <main className="mx-auto w-full max-w-[1920px] px-4 py-6 lg:px-8">
            <div key={pathname} className="content-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
