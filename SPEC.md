# TagYourTurn: MVP Build Spec (v3)

Live at tagyourturn.com. Changes from Andrea's TagYourTurn spec are marked **[built]** where the build adds to or differs from it.

## 1. Product overview
Mobile-first web app (not native). A shared page for two people who alternate something nightly: it shows whose turn it is tonight, one tap confirms when the games are done, and it flips for tomorrow. A history log settles every "wait, who went last time?" dispute. **No login, no AI, no money.** Server state is required (two phones share one truth), but identity is just a secret link. The link is the entire credential, Google-Doc-anyone-with-the-link model.

## 2. Core flow
1. One person creates a tracker: enters two names, picks who starts tonight, gets a secret link, shares it with the other person. Both bookmark it.
2. On first visit, each device is asked "Which player is this device?" (the two names, plus Skip). Stored in localStorage, re-pickable anytime.
3. Each night, the page shows "Tonight: Andrea starts."
4. **Done for tonight** records the night (with which device recorded it) and flips the starter.
5. **Skip tonight** records the night as skipped without flipping.
6. **Undo** removes tonight's record and reverses only its own flip. **[built]**
7. Mis-tapped or forgot to log a past night? Either person can correct it or add it from history. **Swap** flips tonight's starter without recording a night.

## 3. MVP features
- Tracker creation: two names + tonight's starter in, secret link out (`/t/[token]`)
- Device prompt on first visit, stored in localStorage keyed by tracker (survives link rotation)
- Tonight view: big, glanceable "[Name] starts"
- Done / Skip / Swap / Undo, each attributed to the device that did it
- History: the last 7 days, one row per day. Date, who started, done vs. skipped, "logged by". Swaps, undos, corrections and rotations appear as small lines under their day. Dates only, never times. **[built]**
- Fairness split: DONE nights per starter over the last 7 days (e.g., 4 / 3)
- Correction: tap a past night to change who started and/or done vs. skipped **[built: status too]**
- Backfill: tap an unlogged past day to add it; never flips the current starter **[built]**
- Rotate link: new secret token, old one stops working; confirm step, then share sheet

## 4. Out of scope
Per-game rotation, accounts and passwords, native apps, and the anti-features in section 12: no notifications or reminders, no streaks, no all-time stats or leaderboards, no exporting or sharing the log.

## 5. Tech stack
Next.js 15 App Router, TypeScript, Tailwind v4. Postgres (Neon, `aws-us-east-2`) + Prisma 6. Vercel (`cle1`). No AI calls.

## 6. Data model
```
Household { id, token (unique), playerAName, playerBName, currentStarter (A|B), createdAt }
Night     { id, householdId, date (yyyy-mm-dd), starter, status (DONE|SKIPPED),
            appliedFlip, recordedBy (A|B|null), recordedAt, updatedAt }          [built: appliedFlip]
Event     { id, householdId, type (DONE|SKIP|SWAP|UNDO|CORRECT|BACKFILL|ROTATE),
            date, by (A|B|null), at }                                            [built]
```
- Unique (householdId, date): one record per night.
- `appliedFlip` lets Undo reverse exactly the flip that night made.
- `Event` exists so Swap, Undo, Correct and Rotate have attribution. It's deleted on the same 7-day schedule as nights.
- Token: 16 random bytes (128 bits), base62.

## 7. Routes
- `/` landing + create, with "How it works" and "What it won't do"
- `/t/[token]` tracker: tonight, actions, history + split, link, this device

## 8. API routes
- `POST /api/households` create
- `GET /api/households/[token]?today=` tonight, last-7-day history and activity, split
- `POST /api/households/[token]/nights` tonight (Done flips, Skip doesn't) or backfill a past day in the window (`starter` required, never flips). 409 if the day is already logged.
- `PATCH /api/households/[token]/nights/[date]` correct a past night's starter/status. Never touches the current starter.
- `DELETE /api/households/[token]/nights/[date]?today=` undo tonight only **[built]**
- `POST /api/households/[token]/swap`
- `POST /api/households/[token]/rotate`
- `GET /api/cron/purge` daily retention job, requires `Authorization: Bearer $CRON_SECRET` **[built]**

## 9. Key logic notes
- "Tonight" is the client's local calendar date. The server rejects anything more than one day from UTC.
- Corrections and backfills change records only. They never recompute the flip chain; Swap fixes the current starter.
- The split counts DONE nights only, computed on every read. Never stored.
- **Retention [built].** Nights and activity older than the window are deleted, not hidden. The cutoff keeps one extra day so a phone that's ahead of UTC never loses a night it can still see. Deletion runs on every write for that tracker and once a day for all trackers (Vercel cron, Hobby plan: daily, within the scheduled hour).
- The device prompt is client-asserted. Attribution for two people who trust each other, not access control.
- **Rotate trade-off [built, accepted].** Both players can rotate, but whoever rotates first keeps the tracker and the other loses access until they're sent the new link. There's no fix without accounts. The stakes are bounded: a tracker holds two first names and at most a week of turns.
- What's not deleted: the tracker itself (two names and who starts next). It holds no history.

## 10. Acceptance criteria
1. Create tracker → link works on both phones, no login.
2. Done → tonight recorded, other name next. Done again → 409, no double flip.
3. Skip → same starter next time.
4. Undo after Done → starter restored.
5. Correct last Tuesday → history and split update, current starter untouched.
6. Backfill a missed day → appears in history and split, current starter untouched.
7. Split shows correct DONE counts after a mix of done, skipped, corrected and backfilled nights.
8. Device prompt on first visit; attribution in history; a new browser re-prompts; rotating doesn't.
9. Rotate → old link 404s, new link works with state intact.
10. A night 8+ days old is gone from the database after the next write or daily purge.

## 11. Milestones
- **M1 (done):** create, secret-link page, tonight view, device prompt
- **M2 (done):** Done/Skip/Swap/Undo, one record per night, flip logic, attribution, rotate
- **M3 (done):** history, corrections, backfill, 7-day split, retention, landing, rename

## 12. Design values: built to resist weaponization
A shared ledger can become evidence, so TagYourTurn is designed against that from the start:
- **Mutual by construction.** The tracker only exists if both people hold the link.
- **Symmetric power.** Both players can do everything: Done, Skip, Swap, Undo, correct, rotate. No admin, no watcher and watched. (See the rotate trade-off in section 9.)
- **It forgets.** The window is 7 days and older nights are deleted from the database, not just hidden.
- **It never nags.** No notifications, no reminders, no "the other player hasn't logged" prompts.
- **Nothing leaves.** No exporting, no sharing the log. History shows dates, never times.

## 13. Visual language (shared with Tab Math)
Monochrome only. Space Grotesk headings, Geist Mono for everything else. Zero radius, 1px borders, numbered section labels. Footer: "Tiny tools for keeping a rhythm." then "Built by Andrea", linking to andreaberrocal.com.
