"use client"

import { useSyncExternalStore, type ComponentProps } from "react"
import { isExternalLink } from "./markdown-links"

const noSubscribe = () => () => {}

/**
 * A Markdown link: one leading outside CE-CodeClass opens in a new tab (#106).
 * The server doesn't know the app's origin, so it renders with none and the
 * browser settles same-origin absolute links after hydration — no mismatch.
 */
export function MarkdownLink({ href, ...props }: ComponentProps<"a">) {
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null
  )
  const external = isExternalLink(href, origin)
  return <a href={href} {...props} {...(external && { target: "_blank", rel: "noopener noreferrer" })} />
}
