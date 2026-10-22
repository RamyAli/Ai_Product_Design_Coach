# Architecture

## Layout

```
prisma/                     Schema and versioned migrations (SQLite)
messages/{en,ar}.json       UI translations (identical key sets, verified by tests)
scripts/                    db-migrate, e2e server, i18n key extraction
src/
  domain/                   Pure, framework-free logic (unit tested)
    enums.ts, localized.ts  Shared enums, bilingual text helpers
    stages/                 The eight canonical stages: tasks, deliverables, weighted criteria
    brief.ts                Brief + generator schemas and rules
    review.ts               Model output schema (built per stage) and stored review types
    scoring.ts              Deterministic scoring, evidence verification, decisions
    gates.ts                Stage completion gates
    comparison.ts           Review-to-review comparison
    briefImpact.ts          Which stages a brief edit affects
    caseStudy.ts            Case study outline and Markdown rendering
  server/                   Server-only code
    config.ts               Data directory and limits
    db.ts                   Prisma client (lazy) and JSON helpers
    settings.ts, secrets.ts App settings (DB) and API keys (0600 file / env)
    ai/                     Provider abstraction
      types.ts              AIProvider interface, content parts, task descriptors
      anthropic.ts          Claude adapter (structured outputs, streaming, error mapping)
      mock/                 Deterministic offline provider (ideas, briefs, heuristic reviewer)
      structured.ts         JSON extraction, schema validation, corrective retries
      prompts/              Versioned prompt templates (7) + shared safety rules
    ingestion/              Upload validation, storage, image/PDF processing, Figma
    jobs/                   Persisted AI job queue (in-process, concurrency-limited)
    services/               Use cases: projects, stages, submissions, evaluation, reviews,
                            generation, coach, case study, progress, backup, sample data
    action.ts, http.ts      Safe error mapping for server actions and route handlers
  app/                      Next.js App Router pages, server actions and API routes
  components/               UI primitives (ui/) and feature components
  i18n/request.ts           next-intl configuration (cookie-based locale)
tests/
  unit/                     Domain, parsing, validation, i18n and component tests
  integration/              Service tests against a real temporary SQLite database
  e2e/                      Playwright journey
```

## Decisions

**ADR-1 · Next.js App Router, one process.** Server components read through services directly; mutations go through validated server actions; uploads, file serving, job polling, exports and restore use route handlers. No separate API server or queue infrastructure.

**ADR-2 · SQLite + Prisma, files on disk.** Single-user and local, so SQLite in `APP_DATA_DIR` is enough. JSON payloads (brief, rubric snapshot, review) are stored as validated strings. File bytes live under `APP_DATA_DIR/uploads` with random names; the DB stores relative paths, hashes and extracted text. The data directory defaults to the user's home so it survives rebuilds and `git clean`.

**ADR-3 · Rubrics are code, snapshotted per stage.** Canonical criteria, weights (sum 100), mandatory flags and minimum scores live in `src/domain/stages/definitions.ts` with a `RUBRIC_VERSION`. Each project stage stores a snapshot so later rubric edits never change how old work was judged. AI tailoring adds guidance and up to three extra tasks per stage but cannot change weights or remove requirements.

**ADR-4 · The model scores criteria; code decides.** The evaluator returns criterion scores, statuses, deliverable statuses, issues and tasks against a schema whose ids are constrained to the stage rubric. `finalizeReview` applies status caps, visual-evidence guards, evidence verification, weighted scoring, confidence caps and the pass/revise/needs-more-evidence rules. A high average can never outweigh a missing mandatory deliverable or a critical issue.

**ADR-5 · Evidence manifest and verification.** Every piece of evidence gets a reference (`T1` text, `N1` notes, `A1` PDF, `I1` image, `F1` Figma). The reviewer must cite these refs. Code removes refs that don't exist, page locators out of range and quotes that don't occur in the source text, and records what was removed. Anything the reviewer couldn't see (failed file, no vision, inaccessible Figma, truncation) becomes an explicit limitation and lowers confidence.

**ADR-6 · Reviews are immutable.** Review rows are never updated. Revision tasks are separate rows the user can complete or dismiss (with a reason); comparisons are computed once at review time and stored. Resubmitting creates a new version and a new review.

**ADR-7 · Provider abstraction with a first-class mock.** `AIProvider` exposes `generateStructured`, `generateText`, `testConnection` and capability flags (vision, PDF, structured output, size limits). Requests carry a typed *task descriptor* so the mock can produce deterministic, schema-valid output for tests and demo mode. Everything produced by the mock is stored with `isMock`/`generationSource = mock` and labelled in the UI.

**ADR-8 · Persisted jobs, in-process runner.** Long AI operations create an `AiJob` row (queued → running → succeeded/failed/cancelled) and run in the server process with a concurrency limit. The UI polls `/api/jobs/:id`. Jobs orphaned by a restart are marked *interrupted* and can be retried. Failures never touch the user's submission.

**ADR-9 · Secrets outside the database.** API keys come from environment variables or a `0600` JSON file in the data directory. Only masked values reach the client. Backups exclude secrets.

**ADR-10 · Untrusted content handling.** User text and extracted file content are wrapped in tagged data blocks with escaping; system prompts state that such content cannot change instructions. Uploads are type-checked by magic bytes, stored outside the web root, served with `nosniff` and a sandboxing CSP, and Markdown is rendered without raw HTML. Mutating API routes reject cross-origin requests; the server binds to 127.0.0.1.

**ADR-11 · Localization.** next-intl with a cookie-selected locale (no URL prefix, so switching preserves the route). `<html lang dir>` follows the locale; layouts use logical CSS properties (`ms-`, `ps-`, `start-`, `border-s`) and directional icons are mirrored. Arabic uses Latin digits (`ar-u-nu-latn`) so scores read consistently. User and AI content keeps its own language; its direction is detected per block. Canonical stage content is bilingual in code.

**ADR-12 · Honest case studies.** The case study outline is assembled from saved data only (brief facts, latest submitted text per stage, review summaries). Sections without evidence are rendered as "Missing evidence" notes; the drafting prompt forbids inventing outcomes.

**ADR-13 · Visual design.** Colours come from the IBM Carbon palette (light: Gray 10 layering with Blue 60 interactive; dark: Gray 100) and are defined once as CSS tokens in `src/app/globals.css` (contrast-checked to WCAG AA). Spacing follows Carbon's 8 px rhythm and body type uses Carbon's 14/20 scale. The shell follows a dashboard layout: a gray app frame with a sectioned sidebar (workspace card, navigation with counts, user card with the language switch) and a white content panel with a breadcrumb top bar. Latin text uses Plus Jakarta Sans and Arabic uses Tajawal, both self-hosted through Fontsource so the app works offline.

## Adding an AI provider

1. Implement `AIProvider` in `src/server/ai/<provider>.ts` (map the provider's errors to `AIError`, honour `capabilities`, reuse `runStructuredWithRecovery`).
2. Add the provider id to `ProviderId` and the selection logic in `src/server/ai/index.ts` and the Settings form.
3. Add prices to `src/server/ai/pricing.ts` if you want cost estimates.

No prompt, scoring or UI code needs to change.
