"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "./ConfirmDialog"
import { guardedHref } from "./navigation-guard"

interface NavigationGuardValue {
  /** Marks the page as having unsaved changes; returns the release. */
  block: () => () => void
  /** Runs `leave` now, or after the user confirms while the page is blocked. */
  confirmLeave: (leave: () => void) => void
  /** The user already confirmed leaving — the browser needn't ask again. */
  isLeaving: () => boolean
}

const NavigationGuardContext = createContext<NavigationGuardValue | null>(null)

function useNavigationGuardContext(): NavigationGuardValue {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) throw new Error("useUnsavedChangesGuard / useConfirmLeave must be used within NavigationGuardProvider")
  return ctx
}

/**
 * Asks before an in-app navigation drops unsaved changes (#104): a link click
 * anywhere on the page (Sidebar, Breadcrumbs, …) and the navbar switchers,
 * logout and the impersonation exit, which go through `useConfirmLeave`.
 * Leaving the app or reloading is the browser's own warning
 * (`useUnsavedChangesGuard` keeps `beforeunload`). Browser back/forward is
 * not intercepted — the App Router has no hook to cancel it.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const blockers = useRef(0)
  const leaving = useRef(false)
  const [pending, setPending] = useState<(() => void) | null>(null)

  const block = useCallback(() => {
    blockers.current += 1
    leaving.current = false
    let released = false
    return () => {
      if (released) return
      released = true
      blockers.current -= 1
    }
  }, [])

  const confirmLeave = useCallback((leave: () => void) => {
    if (blockers.current > 0) setPending(() => leave)
    else leave()
  }, [])

  const isLeaving = useCallback(() => leaving.current, [])

  useEffect(() => {
    // Capture phase on the document runs before React's own listeners on the
    // root, so stopping it here keeps next/link from navigating.
    function onClick(e: MouseEvent) {
      if (blockers.current === 0) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      const href = guardedHref(
        e,
        a && { href: a.href, target: a.target, download: a.hasAttribute("download") },
        window.location.href
      )
      if (!href) return
      e.preventDefault()
      e.stopPropagation()
      // A plain push: no current Link sets `replace` or `scroll={false}`.
      setPending(() => () => router.push(href))
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [router])

  const value = useMemo(() => ({ block, confirmLeave, isLeaving }), [block, confirmLeave, isLeaving])

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmDialog
          title="ออกจากหน้านี้"
          message="มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่"
          confirmLabel="ออกจากหน้านี้"
          onConfirm={() => {
            setPending(null)
            leaving.current = true
            pending()
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </NavigationGuardContext.Provider>
  )
}

/** While `dirty`, in-app navigation asks first and the browser warns on unload. */
export function useUnsavedChangesGuard(dirty: boolean) {
  const { block, isLeaving } = useNavigationGuardContext()
  useEffect(() => {
    if (!dirty) return
    const release = block()
    const warn = (e: BeforeUnloadEvent) => {
      if (!isLeaving()) e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => {
      release()
      window.removeEventListener("beforeunload", warn)
    }
  }, [dirty, block, isLeaving])
}

/** For navigation that isn't a link (router.push, logout): ask first if blocked. */
export function useConfirmLeave(): (leave: () => void) => void {
  return useNavigationGuardContext().confirmLeave
}
