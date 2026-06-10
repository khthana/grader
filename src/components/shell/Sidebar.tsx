"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FaChevronLeft } from "react-icons/fa"
import type { MenuItem } from "@/lib/roles"
import { MenuIcon } from "./icons"

interface SidebarProps {
  menu: MenuItem[]
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ menu, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="relative shrink-0 border-r border-slate-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 80 : 320 }}
    >
      {/* Floating collapse toggle */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        className="absolute -right-4 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <FaChevronLeft
          className="h-3 w-3 text-slate-500 transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
        />
      </button>

      <nav className="flex flex-col gap-1 px-3 py-6">
        {menu.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 font-thai text-[15px] transition-colors ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-blue-50 hover:text-primary"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <MenuIcon name={item.icon} className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
