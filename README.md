# Product Design Coach

A local-first web app that acts as a personal AI mentor for UX/UI and product designers. It generates realistic project briefs, guides you through an eight-stage product design workflow, reviews the work you actually submit (text, images, PDFs, Figma links) against explicit rubrics, assigns revisions, tracks progress, and helps you turn finished work into an honest case study.

**Core principle:** the app coaches the designer — it does not do the work for them, and it never invents research, test results, metrics or outcomes.

- English and Arabic, with full right-to-left layout
- Works offline in a clearly labelled **demo mode** (no API key needed)
- Uses **Anthropic Claude** when you add an API key; the provider layer can take other providers
- All data stays on your computer (SQLite + local files)
- Clean dashboard UI built on IBM Carbon colour tokens, with Plus Jakarta Sans (Latin) and Tajawal (Arabic), light/dark/system themes

---

## Quick start

Requirements: **Node.js 20.11+** (22 recommended) and npm.

```bash
npm install          # also downloads the Prisma engines
npm run setup        # generates the Prisma client and creates/migrates the database
npm run dev          # http://127.0.0.1:3000
```

For a production build:

```bash
npm run build
npm start            # applies pending migrations, then serves on http://127.0.0.1:3000
```

Both `dev` and `start` bind to `127.0.0.1` so the app is not exposed to your network. Use `npx next start -H 0.0.0.0` only if you understand that the app has no login.

Open the app and either:

- **Generate a project** (Generate Project → Random or Custom), or
- **Load sample projects** from My Projects, the dashboard or Settings → Your data. This adds three clearly labelled samples: one complete, one halfway (with a stage waiting on revisions) and one not started. Their reviews always come from the offline demo reviewer, even when an API key is set, so loading them costs nothing.

Without an API key everything works, but generation uses a curated set of fictional sample ideas and reviews come from an offline heuristic reviewer. Both are labelled "Sample"/"Demo" everywhere and are never presented as AI evaluations.

## Configuration

Copy `.env.example` to `.env` (optional — everything can also be set from **Settings**).

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_DATA_DIR` | Where the database, uploads, backups and the local secrets file live. Use an absolute path. | `~/.product-design-coach` |
| `AI_PROVIDER` | Force `anthropic` or `mock`. When unset, Settings decides ("Automatic" = Anthropic when a key exists). | unset |
| `ANTHROPIC_API_KEY` | Anthropic API key. Takes precedence over a key saved in Settings. | unset |
| `AI_MODEL` | Model used when none is set in Settings. | `claude-opus-5-5` |
| `FIGMA_ACCESS_TOKEN` | Optional read-only Figma token so links can be read (file/frame names, frame renders). | unset |

### Setting up Claude

1. Create an API key at console.anthropic.com.
2. Either set `ANTHROPIC_API_KEY` before starting the app, or paste the key into **Settings → AI provider**.
3. Click **Test connection**. Choose the model (default `claude-opus-5-5`) and effort level (default *High*).

Keys entered in Settings are written to `APP_DATA_DIR/secrets.json` with `0600` permissions. They are never stored in the database, never sent to the browser (only a masked form like `sk-ant-…a1B2` is shown) and are excluded from backups. Environment variables always win.

The Anthropic adapter uses structured outputs (JSON schema), streaming, adaptive thinking with a configurable effort, prompt caching for system prompts and the server-side refusal fallback (`fallbacks: "default"`). Usage and an estimated cost are stored with each review; a pre-flight estimate is shown before every review.

## Where your data lives

```
APP_DATA_DIR/
├── coach.db        SQLite database (projects, stages, tasks, submissions, reviews, settings, jobs)
├── uploads/        Uploaded files, thumbnails and downscaled copies for AI review
│   └── <projectId>/<submissionId>/<uuid>.<ext>
├── backups/        Zip backups created from Settings
├── tmp/
└── secrets.json    API keys entered in Settings (0600)
```

Uploaded files are stored outside the web root with random names, and are only served through `/api/assets/:id` with `nosniff` and a sandboxing CSP.

**Local data is not backed up or synced automatically.**

### Backup and restore

- **Back up:** Settings → Your data → *Create backup*. This writes `backups/coach-backup-<timestamp>.zip` containing every record and uploaded file (no API keys). Download it from the list.
- **Restore:** Settings → *Restore*, choose a backup zip and type `RESTORE`. The archive is validated first, a safety backup of the current state is created automatically (`coach-backup-pre-restore-…zip`), then all data is replaced in one transaction.
- **Export one project:** project → Overview → *Export* (JSON, without file bytes).
- **Export a case study:** Case study → *Export Markdown*.
- **Moving to another computer:** copy the whole `APP_DATA_DIR`, or create a backup and restore it on the new machine.

Database migrations are versioned in `prisma/migrations` and applied with `npm run db:migrate` (run automatically by `dev` and `start`). Migrations never drop your data.

## Using the app

1. **Generate a project.** Random or custom (industry, audience, market, platform, level, difficulty, duration, 2–4 focus features, language, constraints, portfolio focus). Review the brief, then accept, edit, regenerate or save as a draft.
2. **Work through eight stages**: Discovery & problem framing → Research & synthesis → IA & user flows → Wireframes & interaction → Visual design & design system → Prototype → Usability testing & iteration → Handoff & case study. Each stage shows its objective, why it matters, required deliverables, checklist, weighted acceptance criteria, methods, templates and expected depth for your difficulty.
3. **Submit work** — Markdown text, PNG/JPEG/WebP images, PDFs and Figma links in one submission. Drafts autosave (with a local browser backup if a save fails).
4. **Get a formal review** — score out of 100, decision (*pass*, *revise*, *needs more evidence*) with the reasons, criterion scores with evidence references, issues by severity (observed → why it matters → how to improve), missing deliverables, assumptions to validate, questions, limitations and confidence.
5. **Revise** — mark revision tasks done or dismiss them with a reason, ask the mentor follow-up questions (never changes the score), start a new version from the previous one, resubmit. The new review shows what was resolved, what remains and what is new. Old reviews are immutable.
6. **Complete the stage** once the latest version passes, mandatory deliverables are present, no critical tasks are open and the required checklist is done. The next stage unlocks.
7. **Set up your profile** (Settings → Profile, or click your name in the sidebar): name, role, a short bio and an avatar. Pick one of the two animated defaults, one of 45 3D avatars, or upload your own photo (PNG, JPEG or WebP, cropped to a square and stored in `APP_DATA_DIR/uploads/_profile`).
8. **Track progress** (stages, scores, skill areas, recurring feedback themes) and **draft a case study** from your actual evidence after four completed stages.

**Practice mode** (per project) lets you open any stage without completing earlier ones. It never marks a stage as passed — only a passing formal review can.

**Editing the brief** creates a new brief version. The app lists which stages with existing work rely on the changed fields and lets you mark them for revalidation; nothing is deleted.

## How reviews are scored

The evaluator is a dedicated service, not a chat prompt:

- Each stage has fixed criteria with integer weights summing to 100, mandatory flags and minimum scores (`src/domain/stages/definitions.ts`, rubric version stored on every review).
- The model returns per-criterion scores, statuses and evidence references in a validated JSON schema whose criterion/deliverable ids are restricted to the stage rubric. Malformed or incomplete output triggers a corrective retry.
- **Deterministic code** (`src/domain/scoring.ts`) then:
  - caps scores by status (e.g. a *missing* artifact can score at most 20, so a mention cannot earn credit);
  - refuses to mark visual criteria as met when the reviewer could not see any visual evidence;
  - drops evidence references to files that don't exist, pages that are out of range and "quotes" that don't appear in the submission;
  - computes the weighted score using rubric weights only, excluding criteria that could not be evaluated;
  - caps confidence for unreadable files, inaccessible links and truncation;
  - decides: **needs more evidence** if a mandatory item cannot be evaluated or confidence is too low; otherwise **revise** if the score is below the pass mark (80 by default, 85 in *demanding* mode), a mandatory deliverable is missing, a mandatory criterion is below its minimum or a critical issue exists; otherwise **pass**.
- Every critical/major issue and missing mandatory deliverable gets a revision task.
- Prompts are versioned server-side templates (`src/server/ai/prompts`); the prompt and rubric versions are stored on each review. Uploaded content is wrapped as untrusted data and cannot override the rubric.

## Supported uploads and limits

| Type | Handling |
| --- | --- |
| PNG, JPEG, WebP | Type verified from file bytes; decoded to validate; thumbnail and a ≤1568 px copy for vision models. |
| PDF | Text extracted per page with `[Page N]` markers (for citations). PDFs up to 20 pages are also sent as documents to Claude so visuals are reviewed. Image-only (scanned) PDFs are flagged; **OCR is not implemented**, so they are only readable by a PDF-capable provider. Encrypted or corrupted PDFs fail with an actionable message and can be retried or removed. |
| Figma links | `file`, `design`, `proto`, `board` links are validated and normalised. With a `FIGMA_ACCESS_TOKEN` the app reads file/frame names and renders up to four frames for the reviewer, respecting Figma permissions. Without access the link is kept but the reviewer is told it cannot see it — attach screenshots or a PDF export. A link alone is never treated as proof that a prototype works. |

Default limits (see `src/server/config.ts`): 15 MB per file (configurable up to 50 MB in Settings), 80 MB per submission, 12 files and 5 Figma links per submission, 60 PDF pages, 60,000 characters of written text, 8 images per review, ~120k characters of evidence per review (truncation is reported as a limitation).

## Development

```bash
npm run dev          # dev server (127.0.0.1:3000)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (strict)
npm test             # Vitest: unit, component and integration tests (mock provider, temp SQLite)
npm run test:e2e     # Playwright end-to-end journey (builds, starts an isolated server in mock mode)
npm run verify       # lint + typecheck + tests + production build
npm run db:studio    # Prisma Studio against your data directory
```

Tests never need an API key or network access: they run against the deterministic mock provider and a throwaway database. E2E tests use `.e2e-data/`; set `PLAYWRIGHT_CHROMIUM_PATH` to use a pre-installed Chromium, or run `npx playwright install chromium` once.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the structure and design decisions.

## Known limitations

- Single user, no authentication: run it locally only.
- No OCR for scanned PDFs (flagged clearly; use a PDF-capable provider or upload text/images).
- Figma content is only read with your own token and only what Figma permits; frame renders are limited to four per link.
- The offline demo reviewer checks presence and length of deliverables only; it cannot judge quality or see images, so in demo mode the visual stages (4–6) return *needs more evidence*. The sample projects are the exception: they are built with a sample reviewer that treats the attached placeholder wireframes as present, and their reviews still say the images were not inspected.
- AI jobs run in-process. If the app is stopped mid-review, the review is marked as interrupted and can be retried; the submission is never lost.
- Cost estimates use a static price table and rough token heuristics.
- The UI is desktop-first; tablet and phone layouts are supported but long review pages are best on larger screens.

## Credits

The profile avatars in `public/avatars` come from the [Free 3D Memoji Avatars Pack](https://www.figma.com/design/vwEAU9Knv5JrJ0ccBJZ8uc/Free-3D-Memoji-Avatars-Pack--Community-) Figma Community file. Check that file's licence before redistributing them.
