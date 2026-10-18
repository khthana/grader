# 13. Teaching Material Attachments: files on disk by content hash, referenced by name

Date: 2026-10-18

## Status

Accepted

## Context

Phase 2 of Teaching Materials (ADR 0012) lets staff upload files into a Teaching
Material: slide decks, PDFs, archives, and images to show inside its Markdown text. Three
things shape the design:

- **Size.** A slide deck is often 20–50 MB. Profile pictures are stored as base64 in
  Postgres today, but those are capped at 150 KB.
- **Text that travels.** A Material's Markdown body moves to another week (#111) and is
  copied verbatim to a new term by Course Duplication (#112). Any link written into the
  body goes with it.
- **One deployment shape.** CE-Grader runs as one Docker Compose stack (ADR 0008) for
  one department. There is no object store, and adding one is a new service to run.

## Decision

1. **Files live on disk, named by their SHA-256; Postgres holds everything else.** One
   row per Attachment records its Teaching Material, file name, size, content type and
   hash. The bytes are written once, under their hash, to a directory set by
   `ATTACHMENTS_DIR`: a named volume in Compose, `local/attachments` on a dev machine,
   and a temporary directory in tests. Only one module reads or writes that directory, so
   moving to an object store later means changing that module alone.
2. **The database is the only source of truth; the disk is swept.** Deleting an
   Attachment, its Material or its Course deletes rows only (FK cascade). A sweep removes
   every file that no row points to. It runs after each delete request and can also be
   run as a script. It never touches a file younger than one hour, so an upload that has
   written its file but not yet its row is safe.
3. **The body refers to an Attachment by file name, not by URL or id.** Markdown writes
   `![diagram](attachment:array-diagram.png)`. When a Teaching Material is rendered, each
   `attachment:` reference resolves to that Material's own Attachment of that name.
   File names are therefore unique within one Material, and uploading the same name
   again replaces the file (after the staff confirm).
4. **Course Duplication copies Attachment rows, not bytes.** Each copy points to the same
   hash, so a copied Material's images work at once, and the source and the copy can
   each replace or delete theirs independently.

## Considered Options

- **Store bytes in Postgres (`bytea`).** Rejected. One backup and one transaction would
  be convenient, but 50 MB files bloat the database, slow every dump, and are read
  whole into memory.
- **An object store (MinIO / S3).** Rejected for now. It means another service to run
  and secure for a single-department install. Decision 1 keeps the swap to one module.
- **Name files on disk by Attachment id.** Rejected. Duplication would then have to copy
  bytes, and the same file uploaded twice is stored twice.
- **Refcount and delete the file on the same request.** Rejected. Every delete path has
  to remember it, and a Course delete cascades past application code. The sweep is one
  rule that covers every path, and it fails safe: at worst a file lingers.
- **Reference by full download URL, or by `attachment:<id>`.** Rejected. A URL names the
  source term's course, so after duplication the new term's Students get a 404. Staff
  would not notice, because they can still open the old term. An id changes on every
  copy, so the body would need rewriting.

## Consequences

- **Backups are two things.** The database dump and the attachments volume must be
  backed up together. A database restored without the volume gives Attachments that
  404 when downloaded, without breaking anything else. A volume restored without the
  database is swept clean.
- **Rendering needs the Material's Attachments.** The Markdown renderer gets a URL
  resolver for `attachment:` in Teaching Materials only. A `react-markdown` URL is
  otherwise sanitised, and `attachment:` would be dropped. Other Markdown (Problems,
  Syllabus) is unchanged.
- **Renaming a file breaks its references.** A body that names a missing file shows a
  broken image or link, and the editor warns about it. This is the price of references
  that survive moves and copies.
- An Attachment is seen exactly when its Teaching Material is seen (`canSeeMaterial`).
  There is no per-file publish switch.
