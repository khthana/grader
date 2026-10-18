import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MarkdownLink } from "./MarkdownLink"

// `node` (the parsed tree) stays here — only plain props cross into the client link.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const components: Components = { a: ({ node, ...props }) => <MarkdownLink {...props} /> }

export type UrlTransform = (url: string) => string

/**
 * The one Markdown renderer. `urlTransform` replaces react-markdown's URL
 * sanitising — only Teaching Materials pass one, to resolve `attachment:`
 * references (#116); everywhere else keeps the default.
 */
export function MarkdownContent({ content, urlTransform }: { content: string; urlTransform?: UrlTransform }) {
  return (
    <div className="prose prose-slate max-w-none prose-table:text-sm prose-pre:bg-slate-50 prose-pre:text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
