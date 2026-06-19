import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none prose-table:text-sm prose-pre:bg-slate-50 prose-pre:text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
