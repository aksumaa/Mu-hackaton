# MU Hackathon Platform — Master Prompt for Cursor

> How to use: create a new empty repo, open it in Cursor, switch to Agent mode, paste everything below the line.
> Optional: save sections 2–4 as `.cursor/rules/project.mdc` so Cursor keeps them in context.

---

## 0. Role and working mode

You are a senior full-stack engineer building a production-grade web platform for **MU Hackathon** at **Millat Umidi University** (Tashkent, Uzbekistan). Expected load: 50–100 teams, ~10 judges, ~5 admins. Correctness, fairness of scoring, and a frictionless registration flow matter more than feature count.

Working rules:
1. **Before writing code**, output a short plan: folder structure, DB schema, route map. Then wait for no confirmation. Just proceed phase by phase (see section 12).
2. After each phase: run `typecheck`, `lint`, and the tests for that phase. Fix failures before moving on. Summarize what was done in 5 lines max.
3. Do not invent libraries or APIs. If unsure about an API of a library, read its docs in `node_modules` or check types.
4. Keep code simple. No premature abstraction. No unused dependencies.
5. Every user-facing string must go through i18n (uz / ru / en). Never hardcode text in components.

---

## 1. Product summary

A website where:
- **Students** register a team, submit a Stage 1 application (idea), and if selected, a Stage 2 submission (working MVP materials). They see their status, deadlines, **scores per criterion (out of 100 total)** and **jury feedback** in a personal cabinet.
- **Judges** have a separate dashboard where they see **all projects of the current stage**, open each one, score every criterion, and write structured feedback.
- **Admins** run the whole process: stages, deadlines, judge accounts, assignments, ranking, selecting the top 20, publishing results.

Hackathon structure (from the official regulation):
- Participants: only current MU students, any faculty/course. Team size 1–4 (solo allowed).
- Stage 1: online application, 7 days → 20 teams selected.
- Stage 2: 14 days, working MVP + materials → 12 finalists selected.
- Stage 3 (offline final) is **out of scope for v1**, but the data model must not block adding it later (rubric tables are data-driven).
- All deadlines are in **Asia/Tashkent (UTC+5)**. Late submissions are **never** accepted. Exactly **one update** of materials is allowed before a separate update deadline; after that, editing is locked.

---

## 2. Tech stack (fixed)

- **Next.js 15** (App Router, Server Components, Server Actions where sensible), **TypeScript strict**
- **PostgreSQL** + **Prisma** ORM
- **Auth**: Auth.js (NextAuth v5) Credentials provider with DB-backed users, **argon2** (or bcrypt) password hashing, role-based access (`PARTICIPANT`, `JUDGE`, `ADMIN`)
- **UI**: Tailwind CSS + shadcn/ui + lucide-react icons
- **Forms/validation**: react-hook-form + zod (same zod schemas on client and server)
- **i18n**: `next-intl`, locales `uz` (default), `ru`, `en`, URL prefix `/uz`, `/ru`, `/en`, language switcher in header, locale persisted in cookie
- **File storage**: abstraction `StorageProvider` with two implementations: local disk (dev) and S3-compatible (Cloudflare R2 / MinIO, prod). Files are **private**, served via short-lived signed URLs after permission check.
- **Dates**: `date-fns` + `date-fns-tz`, store UTC, display in Asia/Tashkent
- **Testing**: Vitest for scoring/deadline logic, Playwright for 3 critical flows (register → submit; judge scores; admin publishes)
- **Deployment**: `Dockerfile` + `docker-compose.yml` (app + postgres), `.env.example`, health endpoint `/api/health`, nightly `pg_dump` script documented in README

---

## 3. Roles and permissions (enforce on the SERVER, never only in UI)

| Role | Can do |
|---|---|
| Anonymous | See landing, rules, timeline, FAQ; register; log in |
| PARTICIPANT | Manage own team, submit/update own materials within deadlines, see own results and feedback after publication |
| JUDGE | See all submissions of the active stage (read-only), score/comment, see only **their own** scores until the admin reveals aggregates |
| ADMIN | Everything: users, stages, deadlines, assignments, rankings, publishing, exports, audit log |

Every route handler / server action must call a central `requireRole()` / `requireOwnership()` helper. Add tests proving a participant cannot read another team's data and a judge cannot read other judges' scores.

---

## 4. Registration (must be bulletproof, minimal friction)

Goal: a student on a phone with bad internet registers in under 2 minutes with zero blocking steps.

**No email verification, no OTP, no external dependency in the registration path.**

Team leader creates the account with:
- Full name
- **Student ID** (unique)
- **Faculty** (dropdown from admin-managed list)
- **Course** (1–6)
- **Group** (text, e.g. `IT-23-01`)
- Phone and/or Telegram username (at least one)
- Password (min 8 chars, show/hide toggle, strength hint)
- Email (optional, used only for notifications)
- Checkbox: accepts the regulation (link opens regulation page) and originality rules

Then, in the same flow or later in the cabinet, the leader adds **team members** (0–3 more): full name, student ID, faculty, course, group. Members do NOT need accounts.

Student verification (no friction for the student):
- Admin can **import a CSV roster** of MU students (student ID, full name, faculty, group).
- If the entered student ID + faculty + group matches the roster → status `VERIFIED` automatically.
- If there is no roster or no match → status `PENDING`; the student can still register and submit. Admin sees a "needs verification" queue with approve/reject. Rejected students get a clear localized message and can correct their data.
- A team is eligible for Stage 1 evaluation only if **all** its members are `VERIFIED` (admin can override). Show this clearly in the cabinet, never block saving a draft.

Reliability requirements:
- Unique constraints on student ID (across all teams: one student cannot be in two teams; show a friendly localized error naming which field conflicts).
- Login by **Student ID + password**.
- Rate-limit login and registration (e.g. 10/min/IP) with a friendly error.
- Password reset: admin can reset a password (generates a temporary one). If the user provided email, add optional email reset behind a feature flag. Document this.
- Server-side validation mirrors client-side. All errors localized. No generic "Something went wrong" without a retry action.
- Idempotent submit (double-click safe), optimistic UI, loading states.
- Mobile-first layout; every form usable at 360px width.

---

## 5. Data model (Prisma) — adapt names, keep the semantics

- `User` (id, studentId unique, fullName, role, passwordHash, phone, telegram, email?, locale, createdAt, isActive)
- `Faculty` (id, nameUz, nameRu, nameEn, isActive)
- `RosterEntry` (studentId unique, fullName, facultyId, group) — imported by admin
- `Team` (id, leaderId, name?, createdAt)
- `TeamMember` (id, teamId, fullName, studentId unique, facultyId, course, group, verificationStatus: PENDING|VERIFIED|REJECTED, isLeader)
- `Track` (id, slug, nameUz/Ru/En, descUz/Ru/En, isActive) — seeded with the 6 directions below, admin-editable
- `Stage` (id, key: STAGE1|STAGE2|FINAL, titleUz/Ru/En, opensAt, deadlineAt, updateDeadlineAt, resultsPublishedAt?, status: DRAFT|OPEN|CLOSED|EVALUATING|PUBLISHED)
- `Project` (id, teamId, trackId, title, createdAt) — one project per team
- `Submission` (id, projectId, stageKey, status: DRAFT|SUBMITTED|UPDATED|LOCKED, firstSubmittedAt, updatedAt, updateUsedAt?, payload JSON for stage-1 text fields)
- `SubmissionFile` (id, submissionId, kind: PRD_PDF|PITCH_DECK|VIDEO_FILE|OTHER, storageKey, originalName, size, mime, uploadedAt) — keep file history, mark current
- `SubmissionLink` (kind: PRODUCT|GITHUB|VIDEO|OTHER, url)
- `Criterion` (id, stageKey, order, key, titleUz/Ru/En, descUz/Ru/En, maxPoints)
- `JudgeAssignment` (id, judgeId, submissionId, assignedBy, status: PENDING|IN_PROGRESS|DONE, conflictDeclared bool, conflictNote?)
- `Evaluation` (id, assignmentId, finalizedAt?, strengths[], improvements[], nextSteps, publicComment, internalNote) — strengths ≤ 3, improvements ≤ 3
- `EvaluationScore` (evaluationId, criterionId, points int) — 0..maxPoints, unique per (evaluation, criterion)
- `StageResult` (submissionId, stageKey, avgTotal, rank, advanced bool, needsThirdJudge bool, tieBreakNote?) — computed and snapshotted when admin runs "compute ranking"
- `Notification` (id, userId, type, titleKey, payload JSON, readAt?, createdAt)
- `Announcement` (id, titleUz/Ru/En, bodyUz/Ru/En, publishedAt)
- `AuditLog` (id, actorId, action, entity, entityId, meta JSON, createdAt)
- `AppSetting` (key, value) — max file sizes, allowed MIME types, discrepancy threshold (default 20), judges-per-submission (default 2), feature flags

Add proper indexes and DB-level constraints (CHECK for score ranges, uniqueness).

---

## 6. Scoring rubrics (seed exactly, stored as data)

### Stage 1 — 100 points
| key | Criterion | Max |
|---|---|---|
| problem_significance | Problem significance — how real, important, and clear the problem is | 25 |
| solution_quality | Solution quality — logic, link to the problem, expected benefit | 20 |
| audience_validation | Target audience and validation — user understanding, first evidence of need | 15 |
| originality | Originality and difference from existing solutions | 15 |
| feasibility | Feasibility with available resources | 10 |
| growth_value | Growth potential and measurable value | 10 |
| completeness | Completeness and clarity of the application | 5 |

### Stage 2 — 100 points
| key | Criterion | Max |
|---|---|---|
| problem_fit | Solution–problem fit | 15 |
| mvp_functionality | MVP functionality: works, key scenario complete, demo quality | 25 |
| prd_product | PRD and product approach | 15 |
| user_validation | User validation / feedback | 10 |
| differentiation | Differentiation from alternatives | 10 |
| business_model | Business model / sustainability | 10 |
| roadmap_12w | 12-week development plan | 10 |
| materials_quality | Quality and consistency of materials | 5 |

(FINAL rubric exists in the regulation too — seed it as `FINAL` rows, 20/20/15/15/10/10/10 — but no UI for it in v1.)

Translate titles and one-line descriptions into **uz (Latin), ru, en**. Use proper Uzbek Latin apostrophes (`o‘`, `g‘`).

Scoring logic (put in a pure, unit-tested module `lib/scoring.ts`):
- A judge enters an integer 0..max for every criterion; total is computed server-side, never trusted from the client.
- Show running total `xx / 100` live in the UI.
- Judge can save draft and later **finalize**; after finalizing they cannot edit unless admin reopens (audit logged).
- Submission score = **average of finalized evaluations** (default 2 judges).
- If the totals of two judges differ by **more than the threshold (default 20 / 100)** → `needsThirdJudge = true`, admin sees a warning and can assign a third judge; the average then uses all finalized evaluations (admin setting: average of all vs. median — default average).
- Ranking: by average descending. Ties: flag `tieBreakNote` required; admin must resolve manually before "advance" is enabled. Never silently break ties.
- A judge who declares a conflict of interest on a submission is excluded from it; admin sees it and reassigns.

---

## 7. Judge dashboard (`/[locale]/judge`)

- Header: stage name, deadline info, progress bar "scored 7 / 20".
- **List of ALL submissions of the active stage**: ID/title, track, submitted time, status (not started / draft / finalized), my score, filters (track, status), search, sort. Judges can open any project to read it.
- Judges are expected to score at least the ones assigned to them (admin assigns; highlight "assigned to me"). Judges may also score unassigned ones only if admin enables `judgesCanScoreAny` (setting, default off).
- **Project page**: all submitted content in a clean reading layout. For Stage 2: embedded video player (YouTube/Drive link or uploaded file), product link button, GitHub link, PRD PDF viewer (inline), pitch deck download, disclosure of AI/open-source/prior work, known limitations.
- **Scoring panel** (sticky on desktop, bottom sheet on mobile): each criterion with description, slider + numeric input, validation, live total. Below: strengths (up to 3), areas for improvement (up to 3), recommended next steps, public comment, private internal note. Autosave draft every few seconds. "Finalize" with a confirm dialog.
- "Declare conflict of interest" button with a note.
- Judges never see other judges' scores for the same submission until the admin sets the stage to `PUBLISHED` or explicitly reveals (prevents anchoring).

---

## 8. Participant cabinet (`/[locale]/cabinet`)

- Dashboard: current stage card with big countdown to deadline (Asia/Tashkent), status badge, checklist of required items with completion state.
- **Team**: edit members until Stage 1 deadline; verification status per member.
- **Stage 1 form** (all required fields from the regulation): project title, short description, track, problem (who is affected, why it matters), target audience/users, proposed solution and key features, difference from alternatives, what has been validated (interviews/surveys/observations), team roles, consent to rules. Autosave draft; character counters with sensible limits.
- **Stage 2 submission** (visible only to the 20 selected teams): 
  - MVP video: link (YouTube unlisted / Google Drive) **or** file upload (admin-configurable max size); show required 2–4 min reminder
  - Product URL + test access instructions/credentials field
  - PRD PDF upload (follow the template; provide a downloadable template slot in admin)
  - Pitch deck PPT/PPTX upload
  - GitHub repository URL (required for software) **or** "equivalent proof" text/file option with an explanation field
  - Disclosure fields: prior work vs. work done during hackathon; AI tools used; open-source/libraries/templates/datasets/external services
  - Known limitations
  - Built-in **checklist from Appendix B** that must be fully ticked before "Submit" is enabled
- **Submit and update rules (server-enforced)**:
  - Before `deadlineAt`: Save draft (unlimited) → **Submit** (records `firstSubmittedAt`).
  - After first submit and until `updateDeadlineAt`: exactly **one** update allowed (record `updateUsedAt`); after use → locked.
  - After the relevant deadline: all writes rejected with a localized message. No exceptions, no admin-bypass button in the UI (admin override only via audit-logged DB action with a prominent warning).
  - Always show submission timestamps and the update state ("1 update remaining" / "update used").
- **Results & feedback tab** (only after admin publishes the stage): advance status (advanced / not advanced), **score per criterion with max** (e.g. `Problem significance 21 / 25`), total `/100`, strengths, areas to improve, next steps, jury comment — exactly the structure of the feedback template (Appendix A). Show **averaged** criterion scores across judges, **not** individual judge identities. Never show internal notes.
- Notifications center (in-app) + unread badge.

---

## 9. Admin panel (`/[locale]/admin`)

- **Overview**: counts (registered, drafts, submitted, verified), timeline, alerts (pending verifications, discrepancies, unassigned submissions, approaching deadlines).
- **Stages**: edit open/deadline/update-deadline (Asia/Tashkent picker), status transitions with confirmation.
- **Users & teams**: search, view, verify/reject members, reset password, deactivate, create JUDGE and ADMIN accounts (generate temp password, force change on first login).
- **Roster import**: CSV upload with preview and error report.
- **Submissions**: table with filters, open any submission, download all files as ZIP, view submission timestamps/update state.
- **Assignments**: auto-assign (balanced, N judges per submission, respects conflicts) + manual override. Matrix view judge × submission.
- **Evaluations & ranking**: per-submission breakdown (each judge's scores visible to admin), discrepancy flags, tie warnings, "Compute ranking" button, select top N (default 20 for Stage 1, 12 for Stage 2) — **explicit confirm**, then "Publish results" which makes scores/feedback visible to teams and sends notifications. Publishing is a separate, deliberate step.
- **Content**: edit tracks, faculties, announcements, FAQ, regulation text (multi-language).
- **Exports**: CSV of scores per criterion, ranking, participants.
- **Audit log** viewer.
- **Settings**: file limits, allowed formats, discrepancy threshold, judges per submission, feature flags.

---

## 10. Public site and design

Pages: Landing, Regulation (full rules from the doc), Timeline, Tracks, Criteria (public: show both rubrics with points), Prizes, FAQ, Contacts, Login, Register.

Seed the 6 tracks: AI & Automation, EdTech, HealthTech, FinTech, BusinessTech & E-commerce, Smart City & GovTech. (Admin can edit; the final list is not yet approved.)

**Design direction** — warm, premium, university-meets-startup. Sand/gold, deep charcoal, and off-white, with large confident headings. Not a generic template and not a dull portal.
- Light theme is the default: warm off-white background (`#F7F4EF`), deep charcoal text (`#1C1A17`), cards a step lighter. Dark theme: warm near-black (`#14110E`), off-white text, and the same sand accent. The theme toggle stays in the header. Generous whitespace.
- The brand accent is the logo sand, sampled from the official mark as `#C3A58B` (`--brand`, near `#C4A484`). The full scale `--brand-50` … `--brand-900` lives in `src/app/globals.css` so it can be retuned in one file. Use sand for accents, buttons (always with dark text), borders, highlights, progress bars, and icons. Never use the sand for body copy or small text: on white it is far below WCAG AA. Readable text stays charcoal in light theme and off-white in dark theme. Control edges, focus rings, and progress fills use a deeper sand step when the logo color itself would miss the 3:1 non-text contrast.
- The Millat Umidi shield (`public/brand/logo.svg`, transparent) appears in the header, footer, login, register, and loading state. The favicon, apple touch icon, and 1200×630 share image are generated from that mark.
- Typography: a modern sans that supports **Latin, Cyrillic, and Uzbek Latin diacritics** (Inter). Large, tight headings.
- Landing hero: headline, subline, primary CTA "Register your team", live countdown to the nearest deadline, 3-step timeline graphic (Application → MVP → Final), stats strip (teams, tracks, prizes), tracks grid with icons, criteria section with animated point bars, FAQ accordion, footer with the MU shield.
- Dashboards: dense but calm; cards, tables with sticky headers, status badges with color + icon (not color alone), skeleton loaders, empty states with guidance, toasts for feedback.
- Subtle motion only (Framer Motion fade/slide, respect `prefers-reduced-motion`).
- Fully responsive, tested at 360px, 768px, 1280px. Accessible: labels, focus rings, keyboard navigation, WCAG AA contrast.
- Language switcher always visible; no layout break with longer Russian strings.

---

## 11. Security, privacy, quality

- Server-side authorization on everything (see section 3). Tests for it.
- Passwords hashed with argon2/bcrypt; secure, httpOnly, sameSite cookies; CSRF protection; security headers (CSP, X-Frame-Options, etc.).
- File upload hardening: verify MIME **and** magic bytes, extension allowlist (PDF, PPT, PPTX, optional MP4), size limits from settings, randomized storage keys, never serve from a public folder, signed URLs with short expiry. Virus scanning hook (stub) documented.
- Validate and sanitize all user text; render as plain text (no raw HTML). Validate URLs (http/https only).
- Personal data is only visible to admins and the owner. Judges see project content and team composition per setting `blindReview` (default **off**; when on, hide team names/members from judges).
- Do not log passwords or tokens. Audit-log all admin actions and all deadline-related rejections.
- Public pages never expose data of teams that did not advance.
- Timezone: all deadlines enforced on the server using UTC comparison; UI shows Asia/Tashkent. Write unit tests for boundary cases (one second before/after deadline, update after update deadline).

---

## 12. Delivery phases (do them in order, verify each)

1. **Foundation**: project setup, Prisma schema + migrations, seed script (admin, 3 judges, 6 tracks, faculties, Stage 1/2 rubrics, demo teams), i18n skeleton, layout, theme, auth + roles + guards.
2. **Public site + registration**: landing and info pages, register/login, team + members, roster import and verification logic, cabinet shell.
3. **Stage 1**: application form with autosave, submit/update/lock logic, deadline enforcement, stage management in admin.
4. **Judge dashboard + scoring**: list, project page, scoring panel, drafts/finalize, conflicts, assignments, scoring module with tests.
5. **Ranking + publishing + feedback**: compute ranking, discrepancy/tie handling, select top 20, publish, participant results tab, notifications.
6. **Stage 2**: gated submission for selected teams, uploads (storage abstraction), checklist, judge views for video/PDF/links, same scoring flow with the Stage 2 rubric, select top 12.
7. **Hardening**: security pass, a11y pass, Playwright tests, performance check, Dockerfile/compose, README (setup, env vars, deploy, backup, how to run a stage end-to-end), seed demo data.

Definition of done: a fresh clone runs with `docker compose up`, seeds demo data, and the full Stage 1 → publish → Stage 2 → publish flow works in all three languages.

---

## 13. Things you must NOT do

- Do not add features not listed here (no payments, no chat, no social login) without asking.
- Do not make registration depend on email, SMS, or third-party APIs.
- Do not allow any submission after a deadline for any reason in the normal UI.
- Do not reveal one judge's scores to another judge before publishing.
- Do not break ties silently.
- Do not hardcode user-visible strings or deadlines.

Start now with the plan (folder structure, schema, route map), then begin Phase 1.
