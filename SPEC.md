# Your Turn (working title): MVP Build Spec

v2. Changes from v1 are marked **[v2]**.

## 1. Product overview
Mobile-first web app (not native). A shared page for two people who alternate something nightly: it shows whose turn it is tonight, one tap confirms when the games are done, and it flips for tomorrow. A history log settles every "wait, who went last time?" dispute. **No login, no AI, no money.** Server state is required (two phones share one truth), but identity is just a secret link. The link is the entire credential, Google-Doc-anyone-with-the-link model.

Visual language matches Tab Math (see section 12). Family footer: "Tiny tools for keeping things fair."

## 2. Core flow
1. One person creates a tracker: enters two names (e.g., "Andrea" and "Marta"), picks who starts tonight, gets a secret link, shares it with the other person. Both bookmark it.
2. On first visit, each device is asked "Which player is this device?" (the two names, plus Skip). Stored in localStorage, re-pickable anytime. This gives lightweight attribution with no account.
3. Each night, the page shows "Tonight: Andrea starts."
4. When the games are done, either person taps **Done for tonight**: the night is recorded (with which device recorded it), starter flips to the other person for tomorrow.
5. Skipped a night (vacation, too tired)? **Skip tonight** records the night as skipped *without* flipping, so the same person still starts next time you play.
6. Mis-tapped? **Undo** removes tonight's record and reverses its flip. **[v2]**
7. Forgot to log a past night? **Add a past night** backfills it. Backfills never flip the current starter. **[v2]**
8. Wrong starter or status on an old night? Tap it in history to correct it. **Swap** flips tonight's starter without recording a night.

## 3. MVP features
- Tracker creation: two names + tonight's starter in, secret link out (`/t/[token]`)
- Device nickname prompt on first visit (names + Skip), stored in localStorage keyed by household id (survives link rotation), re-pickable
- Tonight view: big, glanceable "Tonight: [Name] starts"
- Done / Skip / Swap / Undo with immediate UI update; each action records which device performed it
- History log: date, who started, done vs. skipped, "recorded by [device]"; swaps and undos appear as activity lines **[v2]**
- Fairness counter: DONE split over the last 30 days (e.g., "15 / 13")
- Correction: tap any history entry to change its starter **or status** **[v2]**
- Backfill: add a night for a past date **[v2]**
- Rotate link: regenerate the token, then a share sheet prompts sending the new link to the other player **[v2]**

## 4. Out of scope
Per-game rotation, accounts and passwords, notifications/reminders, streaks/gamification, more than 2 players, native apps.

## 5. Tech stack
Next.js 15 App Router, TypeScript, Tailwind v4 + shadcn/ui-style primitives. Postgres (Neon) + Prisma. Vercel. No AI calls, running cost effectively $0. Manual provisioning.

## 6. Data model

```
Household { id, token (unique), playerAName, playerBName, currentStarter (A|B), createdAt }
Night     { id, householdId, date (yyyy-mm-dd), starter (A|B), status (DONE|SKIPPED),
            appliedFlip (bool), recordedBy (A|B|null), recordedAt, updatedAt }
Event     { id, householdId, type (DONE|SKIP|SWAP|UNDO|CORRECT|BACKFILL|ROTATE),
            date (yyyy-mm-dd|null), by (A|B|null), at }                          [v2]
```

- Unique (householdId, date): one record per night, so double-tapping Done can't double-flip.
- `appliedFlip` records whether this night's write flipped `currentStarter`, so Undo knows exactly what to reverse. **[v2]**
- `Event` is an append-only activity log. It gives Swap/Undo/Rotate attribution a home. History renders Nights; Events add the activity lines. **[v2]**
- Token: 16 random bytes (128 bits) from `crypto.randomBytes`, base62-encoded (~22 chars). **[v2]**

## 7. Routes
- `/` landing ("whose turn is it tonight?") + create-a-tracker
- `/t/[token]` the tracker: tonight, actions, history, 30-day split, device setting, link share/rotate

## 8. API routes
All mutations accept optional `recordedBy` and log an Event.

- `POST /api/households`: create; body `{ playerAName, playerBName, starter }`; returns `{ token, url }`
- `GET /api/households/[token]?today=yyyy-mm-dd`: tonight's starter, tonight's record (if any), history, 30-day split
- `POST /api/households/[token]/nights`: body `{ date, today, status }`.
  - `date === today`: DONE flips (appliedFlip=true), SKIPPED doesn't.
  - `date < today`: backfill, never flips. **[v2]**
  - `date > today`: 400.
  - Record already exists for `date`: **409** with the existing record in the body, so the UI can say "Already logged as Done by Marta. Undo?" No write. **[v2]**
- `DELETE /api/households/[token]/nights/[date]`: undo. Deletes the record; if `appliedFlip`, flips `currentStarter` back. Allowed only for `today`; past nights are corrected, not deleted. **[v2]**
- `PATCH /api/households/[token]/nights/[date]`: correct `starter` and/or `status`. Never touches `currentStarter`.
- `POST /api/households/[token]/swap`: flip `currentStarter` without recording a night
- `POST /api/households/[token]/rotate`: new token; returns `{ token, url }`; old token 404s

Unknown token on any route: 404 (never 403, so a bad link reveals nothing).

## 9. Key logic notes
- "Tonight" = client-local calendar date sent with each request. Two phones in different timezones may disagree near midnight. Accepted for MVP.
- Corrections change the record only. They don't recompute the flip chain. Swap exists for fixing the current starter.
- Undo after a Swap: Undo reverses only its own flip (via `appliedFlip`), so the Swap stays applied. Accepted, and visible in the activity log. **[v2]**
- 30-day split counts DONE nights only, derived on every read. Never stored.
- The device nickname is client-asserted, not verified. Attribution for two people who trust each other, not access control.
- localStorage reads/writes are wrapped in try/catch; a blocked store just means re-prompting.

## 10. Acceptance criteria
1. Create tracker with two names → secret link works on both phones, no login.
2. Tap Done → tonight recorded, tomorrow shows the other name. Tap Done again → 409, UI explains, no double-flip.
3. Skip a night → same starter tomorrow.
4. Done then Undo → record gone, starter back to tonight's person. **[v2]**
5. Backfill last Tuesday as Done → appears in history and split, current starter untouched. **[v2]**
6. Correct last Tuesday from Done to Skipped → history and split update, current starter untouched.
7. Swap → tonight's starter flips; activity log shows who swapped. **[v2]**
8. 30-day split correct after a mix of done/skipped/corrected/backfilled nights.
9. First visit prompts for device owner; actions show attribution; a new browser re-prompts; rotating the link does not re-prompt.
10. Rotate link → old link 404s, share sheet offers the new link, all state intact.

## 11. Milestones
- **M1:** household create + secret-link page + tonight view + device nickname prompt + full schema (all three models, so no later migration churn)
- **M2:** Done/Skip/Swap/Undo + 409 handling + flip logic + Event logging + rotate link with share sheet
- **M3:** history log + activity lines + corrections + backfill + 30-day split + landing polish

## 12. Visual language (shared with Tab Math)
- Strictly black / white / gray. No accent color, including destructive actions (icon + weight, not red).
- Two voices: Space Grotesk for headings, large and tight-tracked; Geist Mono for everything else, usually uppercase with wide tracking. Numbers always tabular.
- Near-zero radius on cards, buttons, inputs, dialogs.
- Numbered section labels ("01 — Tonight", "02 — Link") instead of plain headings.
- 1px borders as the structure. No shadows. Generous whitespace, nothing decorative.
