# TagYourTurn

Whose turn is it tonight? One shared link for two people, no login. Live at tagyourturn.com. See `SPEC.md` (v3).

**Status: M3, MVP complete.** Create a tracker, share the secret link, and each night tap Done (flips the starter), Skip (keeps it), Swap, or Undo. History shows the last 7 days with a fairness split; past nights can be corrected or added. Anything older than 7 days is deleted.

## Run it

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # yourturn_app pooled + direct URLs, CRON_SECRET
npm run dev
npm test                    # vitest: turn rules, schemas, shared helpers
```

Production runs on Vercel (region `cle1`, next to Neon `aws-us-east-2`). `DATABASE_URL`, `DIRECT_URL` and `CRON_SECRET` are set as Sensitive env vars in Vercel, Production only.

Built on [tool-template](https://github.com/An-Be/tool-template): Next.js 16, Prisma 7, hand-rolled monochrome UI. Agent and code rules are in `AGENTS.md`.

## Security

- **No secrets on the client.** Database and cron secrets are read on the server only, never use `NEXT_PUBLIC_`, and every module that touches them lives in `src/lib/server/` and imports `server-only`.
- **Least-privilege database role.** The app connects as `yourturn_app`, created with SQL so it is not in `neon_superuser`, with row access on app tables only (`prisma/sql/app-role.sql`). Migrations are applied by the owner role.
- **Drift check on every build.** `scripts/db-check.mjs` compares the live database to `schema.prisma` and fails the Vercel build if they differ.
- **The link is the credential.** Tokens are 128-bit random (base62). `Referrer-Policy: no-referrer`; `/t/*` and `/api/*` are `no-store` and `noindex`; page titles never include names; secret segments are redacted from CSP logs.
- **Headers.** Per-request nonce CSP (`src/proxy.ts`, violations reported to `/api/csp-report`), HSTS, `X-Frame-Options: DENY`, `nosniff`, restrictive `Permissions-Policy`, COOP, `X-Powered-By` removed.
- **Rate limits.** Postgres-backed: tracker creation 20/hour/IP, tracker writes 120/10 min/IP.
- **Retention.** Nights and activity older than 7 days are deleted on every write for that tracker and by a daily cron that requires `CRON_SECRET`.
- **Concurrency.** Every mutation locks the household row inside a transaction; one record per night is enforced by a unique index.
- **CSRF and input.** Mutations check `Sec-Fetch-Site`/`Origin` and require JSON; bodies are capped at 2 KB and validated with Zod; tokens are format-checked before any query.

## What's here

```
prisma/schema.prisma              Household, Night, Event, RateLimitHit
src/app/page.tsx                  landing
src/app/t/[token]/page.tsx        tracker page (server), renders components/tracker
src/app/api/households/           create, read, nights (tonight/backfill/correct/undo), swap, rotate
src/app/api/cron/purge/           daily 7-day retention job
src/components/tracker/           create form, tracker view, history, device prompt
src/components/ui/                shared primitives from tool-template
src/lib/rules.ts                  pure turn + window rules
src/lib/tracker-schema.ts         request schemas
src/lib/server/tracker.ts         transactions: lock, purge, write, log
```

## Design notes

- tool-template system: monochrome, Space Grotesk + Geist Mono, zero radius, 1px borders, numbered section labels.
- Fonts are bundled locally, so builds don't depend on Google Fonts.
- `src/components/site/mark.tsx` is the mark (two bars trading sides).
- The tracker page title is always "TagYourTurn", so link previews never show player names.
