import { PageTitle } from "@/components/shell/ComingSoon"
import { LogsView } from "@/components/logs/LogsView"

// Admin activity-log view (#6).
export default function LogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon="logs">บันทึกกิจกรรม</PageTitle>
      <LogsView />
    </div>
  )
}
