import { submissionWindow } from "@/lib/problems/submission-window"

export type AssignmentStatus = "reviewed" | "pending" | "not-submitted" | "closed"

export function deriveAssignmentStatus(
  item: { dueAt: string | null; closeAt: string | null; submission: { reviewedAt: string | null } | null },
  now: Date
): AssignmentStatus {
  if (item.submission) {
    return item.submission.reviewedAt ? "reviewed" : "pending"
  }
  // Same Submission Window as the grade route and the problem page (#87).
  return submissionWindow(item, now) === "closed" ? "closed" : "not-submitted"
}
