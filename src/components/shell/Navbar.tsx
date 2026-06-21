"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import { FaChevronDown, FaSignOutAlt, FaUser, FaBook, FaPlus, FaCog } from "react-icons/fa"
import { HiArrowsRightLeft } from "react-icons/hi2"
import { getLandingRoute, type Role } from "@/lib/roles"
import { canManageCourses } from "@/lib/courses/access"
import { isCourseScopedPath } from "@/lib/courses/scope"
import type { CourseOption } from "./AppShell"

interface NavbarProps {
  name: string
  picture: string | null
  roles: Role[]
  activeRole: Role
  courses: CourseOption[]
  activeCourseSlug: string | null
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 font-bold text-white">
        CE
      </div>
      <span className="font-thai text-lg font-semibold text-white">CE-Grader</span>
    </div>
  )
}

function setActiveRoleCookie(role: Role) {
  document.cookie = `active_role=${role}; path=/; max-age=${60 * 60 * 8}; samesite=lax`
}

function setActiveCourseCookie(slug: string) {
  document.cookie = `active_course=${slug}; path=/; max-age=${60 * 60 * 8}; samesite=lax`
}

function courseSlug(c: CourseOption) {
  return `${c.code}/${c.year}/${c.semester}`
}

function coursePath(c: CourseOption) {
  return `/courses/${c.code}/${c.year}/${c.semester}`
}

function CourseSwitcher({
  courses,
  activeCourseSlug,
  canManage,
}: {
  courses: CourseOption[]
  activeCourseSlug: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (courses.length === 0) {
    if (!canManage) return null
    return (
      <button
        onClick={() => router.push("/courses?new=1")}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-thai text-sm text-white hover:bg-white/20"
      >
        <FaPlus className="h-3 w-3" /> เพิ่มรายวิชา
      </button>
    )
  }

  // Determine active course: URL-first (most accurate), then cookie, then first.
  const urlActive = courses.find((c) =>
    pathname.startsWith(coursePath(c))
  )
  const cookieActive = activeCourseSlug
    ? courses.find((c) => courseSlug(c) === activeCourseSlug)
    : undefined
  const active = urlActive ?? cookieActive ?? courses[0]

  function select(c: CourseOption) {
    setOpen(false)
    if (courseSlug(c) === courseSlug(active)) return
    setActiveCourseCookie(courseSlug(c))
    // Preserve the current section when switching courses.
    const section =
      pathname.match(/^\/courses\/[^/]+\/\d+\/\d+\/([^/]+)/)?.[1] ?? "problems"
    router.push(`${coursePath(c)}/${section}`)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-thai text-sm text-white hover:bg-white/20"
      >
        <FaBook className="h-3.5 w-3.5" />
        <span className="font-medium">{active.code}</span>
        <span className="hidden max-w-[280px] truncate text-white/70 md:inline">
          {active.nameTh}
        </span>
        <FaChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="content-enter absolute left-1/2 mt-2 w-80 -translate-x-1/2 rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5">
          {courses.map((c) => (
            <button
              key={courseSlug(c)}
              onClick={() => select(c)}
              className={`flex w-full flex-col items-start px-4 py-2 text-left font-thai text-sm hover:bg-slate-50 ${
                courseSlug(c) === courseSlug(active) ? "text-secondary" : "text-slate-600"
              }`}
            >
              <span className="font-medium">{c.code}</span>
              <span className="truncate text-xs text-slate-400">
                {c.year}/{c.semester} · {c.nameTh}
              </span>
            </button>
          ))}
          {canManage && (
            <button
              onClick={() => {
                setOpen(false)
                router.push("/courses?new=1")
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 font-thai text-sm text-secondary hover:bg-slate-50"
            >
              <FaPlus className="h-3 w-3" /> เพิ่มรายวิชา
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Navbar({
  name,
  picture,
  roles,
  activeRole,
  courses,
  activeCourseSlug,
}: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [roleOpen, setRoleOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const showCourseSwitcher = isCourseScopedPath(pathname)

  function switchRole(role: Role) {
    setRoleOpen(false)
    if (role === activeRole) return
    setActiveRoleCookie(role)
    router.push(getLandingRoute(role))
    router.refresh()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-[60] flex h-[64px] items-center justify-between bg-primary px-6 shadow-sm">
      <Logo />

      <div className="flex items-center gap-3">
        {showCourseSwitcher && (
          <CourseSwitcher
            courses={courses}
            activeCourseSlug={activeCourseSlug}
            canManage={canManageCourses(roles)}
          />
        )}
        {roles.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setRoleOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-thai text-sm text-white hover:bg-white/20"
            >
              <HiArrowsRightLeft className="h-4 w-4" />
              {activeRole}
              <FaChevronDown className="h-3 w-3" />
            </button>
            {roleOpen && (
              <div className="content-enter absolute left-1/2 mt-2 w-48 -translate-x-1/2 rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => switchRole(role)}
                    className={`flex w-full items-center px-4 py-2 font-thai text-sm hover:bg-slate-50 ${
                      role === activeRole ? "font-semibold text-secondary" : "text-slate-600"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full transition-all hover:ring-2 hover:ring-white/50"
        >
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picture}
              alt={name}
              className="h-10 w-10 rounded-full border-2 border-white/20 object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-white">
              <FaUser />
            </span>
          )}
          <span className="hidden font-thai text-sm text-white sm:inline">{name}</span>
          <FaChevronDown className="h-3 w-3 text-white/70" />
        </button>
        {profileOpen && (
          <div className="content-enter absolute right-0 mt-2 w-56 rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate font-thai text-sm font-medium text-slate-800">{name}</p>
              <p className="font-thai text-xs text-slate-400">{activeRole}</p>
            </div>
            <button
              onClick={() => { setProfileOpen(false); router.push("/profile") }}
              className="flex w-full items-center gap-3 px-4 py-2 font-thai text-sm text-slate-600 hover:bg-slate-50"
            >
              <FaCog /> โปรไฟล์
            </button>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-2 font-thai text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600"
            >
              <FaSignOutAlt /> ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
