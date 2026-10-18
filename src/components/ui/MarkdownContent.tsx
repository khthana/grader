import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MarkdownLink } from "./MarkdownLink"

// `node` (the parsed tree) stays here — only plain props cross into the client link.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const components: Components = { a: ({ node, ...props }) => <MarkdownLink {...props} /> }

// An image as a link to its file, labelled by its alt text (#119) — the URL is
// already through `urlTransform`, so an `attachment:` name is its download.
const imageLinkComponents: Components = {
  ...components,
  img: ({ src, alt }) => <MarkdownLink href={typeof src === "string" ? src : ""}>{alt}</MarkdownLink>,
}

// The file a URL names: its last `/` or `:` segment, decoded, without query or hash.
function fileName(url: string): string {
  const last = url.replace(/[?#].*$/, "").split(/[/:]/).pop() || url
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

interface MdNode {
  type: string
  url?: string
  alt?: string | null
  children?: MdNode[]
}

// Before the URLs are transformed: an image without alt text takes its file
// name, so as a link it still says what it downloads.
function remarkImageLabels() {
  const label = (node: MdNode) => {
    if (node.type === "image" && !node.alt && node.url) node.alt = fileName(node.url)
    node.children?.forEach(label)
  }
  return label
}

export type UrlTransform = (url: string) => string

/**
 * How a page's Markdown renders, beyond the defaults — only Teaching Materials
 * pass any: `urlTransform` replaces react-markdown's URL sanitising to resolve
 * `attachment:` references (#116), and `imagesAsLinks` shows no image, each
 * is a link instead (#119).
 */
export interface MarkdownOptions {
  urlTransform?: UrlTransform
  imagesAsLinks?: boolean
}

/** The one Markdown renderer. */
export function MarkdownContent({ content, urlTransform, imagesAsLinks = false }: { content: string } & MarkdownOptions) {
  return (
    <div className="prose prose-slate max-w-none prose-table:text-sm prose-pre:bg-slate-50 prose-pre:text-slate-700">
      <ReactMarkdown
        remarkPlugins={imagesAsLinks ? [remarkGfm, remarkImageLabels] : [remarkGfm]}
        components={imagesAsLinks ? imageLinkComponents : components}
        urlTransform={urlTransform}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
