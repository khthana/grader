// Which Markdown links open in a new tab (#106) — the one rule, asked by the
// Markdown renderer, so a Student following a reference never loses unsent work.

/**
 * An http(s) link that leads outside CE-CodeClass. Relative links, anchors and
 * non-http schemes (mailto:, tel:) never count. While `appOrigin` is unknown
 * (a server render), every absolute http(s) link counts as external.
 */
export function isExternalLink(href: string | undefined, appOrigin: string | null): boolean {
  if (!href) return false
  let url: URL
  try {
    // Without an origin a relative link doesn't parse (→ not external); a
    // protocol-relative one (`//host`) still names another host.
    url = appOrigin ? new URL(href, appOrigin) : new URL(href.startsWith("//") ? `https:${href}` : href)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  return appOrigin === null || url.origin !== new URL(appOrigin).origin
}
