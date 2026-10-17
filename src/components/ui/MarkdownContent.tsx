import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MarkdownLink } from "./MarkdownLink"

// `node` (the parsed tree) stays here — only plain props cross into the client link.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const components: Components = { a: ({ node, ...props }) => <MarkdownLink {...props} /> }

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none prose-table:text-sm prose-pre:bg-slate-50 prose-pre:text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
