"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { getSidebarMenu, type Role } from "@/lib/roles"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { ToastProvider } from "./ToastProvider"

interface AppShellProps {
  name: string
  picture: string | null
  roles: Role[]
  activeRole: Role
  children: ReactNode
}

export function AppShell({ name, picture, roles, activeRole, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const menu = getSidebarMenu(activeRole)

  return (
    <ToastProvider>
      <Navbar name={name} picture={picture} roles={roles} activeRole={activeRole} />
      <div className="flex min-h-screen bg-[#F8FAFC] pt-[64px]">
        <Sidebar menu={menu} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className="flex min-w-0 flex-1 flex-col">
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
