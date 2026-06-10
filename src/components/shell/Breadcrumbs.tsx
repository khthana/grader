"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FaHome, FaChevronRight } from "react-icons/fa"
import { deriveBreadcrumbs } from "@/lib/breadcrumbs"

export function Breadcrumbs() {
  const pathname = usePathname()
  const crumbs = deriveBreadcrumbs(pathname)

  return (
    <nav
      aria-label="Breadcrumb"
      className="sticky top-[64px] z-40 border-b border-slate-100 bg-white/50 px-4 py-3 backdrop-blur-sm lg:px-8"
    >
      <ol className="flex items-center gap-1 font-thai text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <FaChevronRight className="mx-1 h-3 w-3 text-slate-300" />}
            <Link
              href={crumb.href}
              className={
                i === 0
                  ? "flex items-center gap-1 font-semibold text-secondary hover:text-secondary-hover"
                  : "text-slate-600 hover:text-secondary"
              }
            >
              {i === 0 && <FaHome className="h-4 w-4" />}
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
