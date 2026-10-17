// Navigation guard (#104) — the one rule for "does this click leave the page
// inside the app?". Pure, so it's tested without a DOM; NavigationGuard.tsx
// feeds it real clicks while a page has unsaved changes.

/** The parts of a click that decide whether it navigates in this tab. */
export interface GuardClick {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** The clicked link — `href` already resolved to an absolute URL. */
export interface GuardAnchor {
  href: string
  target: string
  download: boolean
}

/**
 * The in-app path a click would navigate to in this tab, or null when it
 * doesn't leave the page (or leaves the app — the browser's own unload
 * warning covers that).
 */
export function guardedHref(click: GuardClick, anchor: GuardAnchor | null, current: string): string | null {
  if (!anchor || click.button !== 0) return null
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null
  if ((anchor.target && anchor.target !== "_self") || anchor.download) return null
  const here = new URL(current)
  const to = new URL(anchor.href, here)
  if (to.origin !== here.origin) return null
  if (to.pathname === here.pathname && to.search === here.search) return null
  return to.pathname + to.search + to.hash
}
