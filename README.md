# TagYourTurn

Whose turn is it tonight? One shared link for two people, no login. Live at tagyourturn.com. See `SPEC.md` (v3).

**Status: M3, MVP complete.** Create a tracker, share the secret link, and each night tap Done (flips the starter), Skip (keeps it), Swap, or Undo. History shows the last 7 days with a fairness split; past nights can be corrected or added. Anything older than 7 days is deleted.

## Run it

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # paste the yourturn_app pooled + direct URLs
npm run dev
npm test                    # turn-rule unit tests
```

Production runs on Vercel (region `cle1`, next to Neon `aws-us-east-2`). `DATABASE_URL`, `DIRECT_URL` and `CRON_SECRET` are set as Sensitive env vars in Vercel, Production only.

## Security

- **No secrets on the client.** The only secrets are the two database URLs. They are read by Prisma on the server, never use `NEXT_PUBLIC_`, and every module that touches the database imports `server-only`, so importing it from a client component fails the build.
- **Least-privilege database role.** The app connects as `yourturn_app`, created with SQL so it is not in `neon_superuser`. It has `SELECT/INSERT/UPDATE/DELETE` on `Household`, `Night`, `Event` and nothing else: no DDL, no other tables, cannot create schemas.
- **Schema changes are applied by the owner, not the app.** New migrations go in `prisma/migrations/`, get applied with the Neon owner role (SQL editor or Neon tooling), and then grants are extended to `yourturn_app` for any new table.
- **Drift check on every build.** `npm run db:check` compares the live database to `schema.prisma` and fails the build if they differ.
- **The link is the credential.** Tokens are 128-bit random (base62). `Referrer-Policy: no-referrer` keeps the URL from leaking to other sites; `/t/*` and `/api/*` are `no-store` and `noindex`; page titles never include names.
- **Headers.** Nonce-based CSP (`src/middleware.ts`), HSTS, `X-Frame-Options: DENY`, `nosniff`, restrictive `Permissions-Policy`, `X-Powered-By` removed.
- **Retention.** Nights and activity older than 7 days are deleted on every write for that tracker and by a daily cron (`/api/cron/purge`, `vercel.json`). The cron route rejects any request without `Authorization: Bearer $CRON_SECRET` (constant-time compare).
- **Concurrency.** Every mutation locks the household row (`SELECT ... FOR UPDATE`) inside a transaction, so two phones tapping at once are applied one after the other. One record per night is also enforced by a unique index.
- **CSRF.** Mutations require `Content-Type: application/json` and a same-origin `Origin`; the undo `DELETE` checks `Sec-Fetch-Site`/`Origin`.
- **Input limits.** Names are trimmed, 1 to 24 chars; request bodies over 2 KB are rejected; tokens are format-checked before any query.
- **Secrets never committed.** `.gitignore` excludes every `.env*` except `.env.example`.

## What's here

```
prisma/schema.prisma            full schema for M1 to M3 (Household, Night, Event)
src/app/page.tsx                landing + create form
src/app/t/[token]/              tracker page, tonight view, history, device prompt
src/app/api/households/         create, read, nights (tonight/backfill/correct/undo), swap, rotate
src/app/api/cron/purge/         daily 7-day retention job
src/lib/rules.ts                pure turn + window rules (unit tested in rules.test.ts)
src/lib/tracker.ts              transactions: lock, purge, write, log
src/lib/token.ts                128-bit base62 tokens
src/components/                 Tab Math primitives: Button, Input, SectionLabel, Mark
```

## Design notes

- Same system as Tab Math: monochrome, Space Grotesk + Geist Mono, zero radius, 1px borders, numbered section labels.
- Fonts are bundled locally (Space Grotesk woff2 in `src/app/fonts`, Geist Mono via the `geist` package), so builds don't depend on Google Fonts.
- `src/components/mark.tsx` is a placeholder icon (two bars trading sides). No favicon yet.
- Device choice is stored in localStorage under the household id, so rotating the link won't re-prompt.
- The tracker page title is always "TagYourTurn", so link previews never show player names.
