export type AssignmentStatus = "reviewed" | "pending" | "not-submitted" | "closed"

export function deriveAssignmentStatus(
  item: { closeAt: string | null; submission: { reviewedAt: string | null } | null },
  now: Date
): AssignmentStatus {
  if (item.submission) {
    return item.submission.reviewedAt ? "reviewed" : "pending"
  }
  const isClosed = item.closeAt != null && new Date(item.closeAt) <= now
  return isClosed ? "closed" : "not-submitted"
}
