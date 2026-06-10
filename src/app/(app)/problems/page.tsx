import Link from "next/link"
import { PageTitle } from "@/components/shell/ComingSoon"

// Problem list stub. The editor at /problems/[id] moves under the shell in issue #8.
export default function ProblemsPage() {
  return (
    <div className="font-thai">
      <PageTitle icon="problems">โจทย์ปัญหา</PageTitle>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <p className="text-lg font-medium text-slate-500">อยู่ระหว่างการพัฒนา</p>
        <Link
          href="/problems/two-sum"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          ลองเปิดตัวอย่างโจทย์
        </Link>
      </div>
    </div>
  )
}
