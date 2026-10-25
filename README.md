# MU Hackathon

Registration, submissions, and jury scoring for the Millat Umidi University hackathon. The interface is in Uzbek, Russian, and English. Deadlines are stored in UTC and shown in Asia/Tashkent.

## Local setup

1. Copy the environment file and set real secrets:

```bash
cp .env.example .env
openssl rand -base64 32   # use this as AUTH_SECRET and again for CRON_SECRET
```

`DATABASE_URL` must use the same user, password, and database name as `POSTGRES_*`.

2. Start Postgres, apply migrations, and load demo data:

```bash
docker compose up -d db
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Open http://localhost:3000. The site redirects to `/uz`.

Demo accounts from the seed (change them before a public server):

| Role | ID | Password |
| --- | --- | --- |
| Admin | `MU-ADMIN` | `Admin-pass-1` |
| Judge | `MU-JUDGE-1` | `Judge-pass-1` |
| Judge | `MU-JUDGE-2` | `Judge-pass-1` |
| Judge | `MU-JUDGE-3` | `Judge-pass-1` |
| Participant | `MU-24001` | `Team-pass-1` |
| Participant with a submitted application | `MU-24002` | `Team-pass-1` |

## Run a stage

1. Admin → Stages. Times are Asia/Tashkent. Move Stage 1 to **Open**.
2. Students register and submit. Drafts are unlimited. After submit, one update is allowed until the update deadline. One second after either deadline, the server rejects the write.
3. When the deadline has passed, set the stage to **Evaluating**.
4. Assign judges (auto-assign balances the load and skips declared conflicts).
5. Judges score every criterion as an integer and finalize. They cannot see another judge's scores until you publish.
6. Ranking → **Compute ranking**. If two scores differ by more than the threshold, the row asks for a third judge. A tie on the cutoff must be chosen by hand; the software will not break it.
7. **Select advancing teams**, then **Publish results**. Publishing is a separate step. Teams then see averaged scores and public comments. Internal notes stay hidden.
8. Open Stage 2 only for teams marked advanced. Repeat the same scoring flow and select 12 finalists.

There is no final-round screen. The final rubric is stored so it can be added later.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` changes demo Stage 1 data, then reseeds.

## Untested

- Docker image on a VPS (CLI was not available here)
- ClamAV, SMTP, Telegram, and S3 against live services
- Final-round screens (rubric only)
- Judge score sliders (numeric inputs only)
- Shared-IP login lock under campus NAT

## Deploy on a VPS with Docker

The server needs Docker Engine and the Docker Compose plugin. Nothing else has to be installed on the host.

1. Point a domain at the VPS and open ports 80 and 443. SSH in as a user that can run Docker.
2. Clone the repository to `/opt/mu-hackathon` and create the env file there:

```bash
cd /opt/mu-hackathon
cp .env.example .env
```

Set at least:

- `POSTGRES_PASSWORD` to a long random value, and put the same value in `DATABASE_URL` only if you connect from the host. Inside Compose, the app overrides `DATABASE_URL` to reach the `db` service.
- `AUTH_SECRET` from `openssl rand -base64 32`
- `AUTH_URL` to `https://your.domain` exactly. Login sends the browser to this origin. If it still says `http://localhost:3000`, people will leave the real site after they sign in.
- `CRON_SECRET` to another long random string

Do not leave the sample database password in place.

3. Build and start:

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed   # demo data only; skip on a real event
```

The app listens on port 3000 inside the server. Put Caddy or Nginx in front for HTTPS. A minimal Caddyfile:

```
your.domain {
  reverse_proxy localhost:3000
}
```

Uploaded files stay on the `uploads` volume (`/data/storage` in the container). The image creates that directory owned by the app user, so the first start can write to it. Files are not in `public/` and are not reachable without a signed link and a logged-in user who is allowed to see that submission. For more than one app server, set `STORAGE_DRIVER=s3` and the `S3_*` variables (Cloudflare R2 or MinIO). The app still checks permission before it reads the object.

4. Nightly backup, as a cron job on the VPS:

```bash
0 3 * * * cd /opt/mu-hackathon && sh scripts/backup.sh
15 9 * * * cd /opt/mu-hackathon && docker compose exec -T app npm run reminders
```

`scripts/backup.sh` writes `backups/muhack-YYYYMMDD-HHMMSS.dump`. Copy those files off the VPS. Restore with:

```bash
docker compose exec -T db pg_restore -U muhack -d muhack --clean --if-exists < backups/muhack-YYYYMMDD-HHMMSS.dump
```

5. Health check: `https://your.domain/api/health` returns `{ "ok": true }` when Postgres answers.

## Accounts and email

Students log in with student ID and password. There is no email confirmation. An admin can reset a password from Users; the temporary password is shown once and is not written to the audit log. The person must replace it on the next login.

Password recovery for students is the admin reset. If an admin turns on email reset and `SMTP_HOST` is set, a person with an email on the account can request a 30-minute link from the login page. The link is single use. Without SMTP, the form says mail is not configured and does not reveal whether the ID exists. In-app notifications are copied to email only when `SMTP_HOST` is set. Telegram notifications need `TELEGRAM_BOT_TOKEN` and a stored chat id.

## Virus scanning

If `CLAMAV_HOST` is empty, uploads are accepted after the type and size checks and the scan result is marked `stub`. Point `CLAMAV_HOST` at a clamd instance to reject infected files. The hook lives in `src/lib/virus-scan.ts`.

## Rate limits

Failed login attempts and registration submits are limited to 10 per minute per IP in this process. A successful login does not use up that budget. A second app container, or a restart, does not share the counter. A campus network that shares one public IP can still lock the form for everyone after 10 failures.
