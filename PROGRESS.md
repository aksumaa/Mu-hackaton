# Progress

## Phases

| Phase | Status |
| --- | --- |
| 1 Foundation | Done |
| 2 Public site, registration, cabinet | Done |
| 3 Stage 1 submit, update, lock, admin stages | Done |
| 4 Judge dashboard and scoring | Done |
| 5 Ranking, publishing, feedback | Done |
| 6 Stage 2 uploads and top 12 | Done |
| 7 Hardening, Docker, README, Playwright | Done |

## What works

- Auth with student ID and password, argon2, httpOnly JWT session, role redirects, and server-side role checks.
- Public pages in uz, ru, and en, plus registration, team editing, and the participant cabinet.
- Stage 1 draft autosave, submit, one update, and deadline rejection. Stage 2 checklist, links, and file upload for selected teams once that stage is not a draft.
- Judge list, own scores only until publish or reveal, conflict of interest, draft autosave, and finalize.
- Admin stages, roster CSV, users, assignments, ranking, tie notes, publish, content, settings, audit, CSV export, and submission ZIP.
- In-app notifications. Email and Telegram only when their env vars are set.
- Local signed file URLs, with an S3 driver behind `STORAGE_DRIVER=s3`.

## What is left / untested

- Docker Compose was not executed here (Docker CLI is not installed). Image and compose files are in the repo.
- ClamAV, SMTP, Telegram, and S3 were not exercised against live services.
- The final-stage rubric is seeded and has no participant or judge screens.
- Judge scoring uses numeric inputs only (no slider).
- Login rate limit is in-memory per process; campus NAT can lock the form after 10 failures.
- A logged-out visit to `/cabinet` redirects to `/login`. That is not a blank-page bug.

## Commands

```bash
docker compose up -d db
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Demo accounts

| Login | Password | Role |
| --- | --- | --- |
| MU-ADMIN | Admin-pass-1 | Admin |
| MU-JUDGE-1 | Judge-pass-1 | Judge |
| MU-JUDGE-2 | Judge-pass-1 | Judge |
| MU-JUDGE-3 | Judge-pass-1 | Judge |
| MU-24001 | Team-pass-1 | Participant |
| MU-24002 | Team-pass-1 | Participant with a submitted application |

## Decisions

1. Seed logins are `MU-ADMIN`, `MU-JUDGE-1..3`, `MU-24001`, and `MU-24002` (see the table above).
2. Email reset is off by default. With the flag on and no SMTP, the action returns `smtp_not_configured`.
3. Telegram sends only when a bot token and `telegramChatId` both exist. Registration collects a username.
4. The one Stage 1 or Stage 2 update is a single save. Pending uploads are promoted on that save. Autosave runs only while the submission is a draft.
5. Tied averages are compared at two decimal places. A tie that crosses the top-20 or top-12 cutoff blocks automatic selection until an admin writes a note. A tied group that fits entirely inside the cutoff is not a boundary tie.
6. A judge-pair gap above the threshold warns. Selecting the top requires an explicit acknowledgement. The gap alone does not block publish.
7. Participants can write only while the stage is Open and the clock is inside the window.
8. Judges can read non-draft submissions of the active stage. They can score only while the stage is Evaluating, they are assigned (unless the setting allows any judge), and they have not declared a conflict.
9. `revealScoresToJudges` lets judges see colleagues' scores before publish. Participants still see results only after publish.
10. `eligibilityOverride` lets an admin mark a team eligible. Ineligible teams stay in the ranking and are skipped when filling the top N.
11. `avgTotal` is rounded to two decimals. The published snapshot stores criterion averages and anonymized feedback, with no judge ids and no internal notes.
12. Prize amounts are not invented. The prizes page says the budget is not approved.
13. The faculty list is a starter set and can be edited by an admin.
14. Login and registration are rate-limited in memory at 10 attempts per minute per IP, which assumes one app node.
15. Local files use an HMAC URL that expires in five minutes. S3 uses a presigned URL when `STORAGE_DRIVER=s3`.
16. The virus-scan hook calls clamd when `CLAMAV_HOST` is set and otherwise returns clean.
17. Homebrew Postgres was used to apply migrations and seed data because Docker is not installed. Compose still publishes port 5432, so it conflicts with a local Postgres on that port.
18. The update deadline must be after open and at or before the final deadline.
19. The final rubric is seeded and has no participant or judge screens.
20. Blind review hides team and member names from judges. The project title stays visible.
21. The score aggregate setting is average or median. The default is average.
22. `judgesCanScoreAny` defaults to off. When it is on, the first score creates the assignment.
23. A submission has one current file and one current link per kind. The single update stores pending replacements until save.
24. People's Choice has no voting screen. It is an offline final award.
25. Deadline reminders are sent from the admin button or `POST /api/cron/reminders` with `CRON_SECRET`. There is no in-process scheduler.
26. Team members can be edited while Stage 1 is Draft or Open and the Stage 1 deadline has not passed.
27. A Stage 2 submission row is created when an advanced team opens the form and Stage 2 is not Draft.
28. Publishing with zero advanced teams requires an explicit confirmation.
29. Reopening a published stage is the Evaluating transition. Results stay hidden until the next publish. The change is audited.
30. Equivalent-proof uploads allow pdf, ppt, pptx, mp4, and zip. Other kinds stay on the stricter list.
31. Video uploads default to 50 MB.
32. The content security policy allows inline scripts and styles so Next.js can run.
33. Seeding again resets demo passwords and platform settings. Regulation and FAQ text are left as an admin edited them.
34. Selects are native elements. Shared form controls are project components rather than a generated component kit.
35. Long regulation, FAQ, and contact copy live in the database. Chrome labels live in the message files.
36. The contact email stays empty until an admin sets it. The page does not show a fake address.
37. A student ID that already belongs to any user cannot be added to a team.
38. Computing the ranking clears previous advance flags and tie notes.
39. Published feedback keeps at most three unique strengths and three improvements. Next steps and public comments are included. Internal notes are omitted.
40. The home page countdown uses translated unit labels.
41. `npm run test:e2e` changes demo submissions and then runs the seed again, which restores stage windows and passwords but not existing team rows.
