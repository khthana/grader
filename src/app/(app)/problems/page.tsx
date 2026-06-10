import Link from "next/link"
import { FaChevronRight } from "react-icons/fa"
import { PageTitle } from "@/components/shell/ComingSoon"

// Minimal problem list. Backed by hardcoded problems for now (see the editor
// page + /api/grade); a real problem store arrives in a later iteration.
const PROBLEMS = [{ id: "hello-world", title: "Hello, World!" }]

export default function ProblemsPage() {
  return (
    <div className="flex flex-col gap-6 font-thai">
      <PageTitle icon="problems">โจทย์ปัญหา</PageTitle>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {PROBLEMS.map((p) => (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-b-0 hover:bg-slate-50"
          >
            <span className="text-slate-700">{p.title}</span>
            <FaChevronRight className="h-3 w-3 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  )
}
