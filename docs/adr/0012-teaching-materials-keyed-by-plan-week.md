# 12. Teaching Materials are keyed by Teaching Plan week number, not by Week or plan entry

Date: 2026-10-18

## Status

Accepted

## Context

Instructors want a page of Teaching Materials (Slides, Handout, Lab Sheet) for each
session of the course. They want its headings to come from the Syllabus's Teaching Plan
so they never type a topic twice. CE-Grader already has two "week" ideas. The **Week**
groups Problems and has its own release flag. The **Teaching Plan** is part of the
Syllabus and is deliberately independent of Week (exam weeks, several entries per week,
counts may differ). A Teaching Plan entry has no stable identity: saving the Syllabus
replaces the whole plan (delete + insert), and entries can be added, removed or reordered.

## Decision

1. **A Teaching Material is identified by (Course offering, Teaching Plan week number,
   Material Kind).** It is not tied to a Week or to one Teaching Plan entry. A week
   holds at most one Material of each Kind.
2. **The heading is derived, never stored.** It is that week's Teaching Plan topics,
   read live, so editing the Syllabus renames the Materials at once.
3. **A week number that drops out of the Teaching Plan makes its Materials Unplanned
   instead of deleting them.** Staff still see them, Students never do, and staff move
   or delete them by hand. Saving the Syllabus never touches Teaching Materials and is
   never blocked by them.
4. **Each Material has its own publish switch** (manual, default off). It is unrelated
   to Released Week.

## Considered Options

- **Key by Week (`weeks.id` / `week_no`) and reuse Released Week.** Rejected. Week is
  the unit of Problems, not of teaching. Exam weeks have no Week, and releasing a Week
  for its Problems would also release its Lab Sheet.
- **Key by Teaching Plan entry.** Rejected. Entries have no stable id because the
  Syllabus is saved as a whole replacement. Giving them one would mean rewriting the
  Syllabus save as a row diff, and a week with two entries would need two sets of
  Materials, which is not how a session is taught.
- **Block Syllabus saves that remove a week holding Materials / cascade-delete them.**
  Rejected. The first couples two editors and still misses renumbering. The second loses
  work to a typo.

## Consequences

- Inserting a week into the Teaching Plan (e.g. a midterm in week 8) does not shift the
  Materials. They stay at their numbers under the new topics until staff move them. This
  is the price of a stable key, and the "move to week…" action exists for it.
- Course Duplication copies Materials by week number and Kind (Unplanned included), all
  unpublished.
