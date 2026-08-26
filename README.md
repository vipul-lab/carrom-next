# Carrom Arena — Tournament Management System

A production-shaped admin dashboard for running a carrom league: teams, members,
1 vs 1 and 2 vs 2 games, win/loss result tracking, live rankings and reports.

Built with **Next.js 15** (App Router), **React 19**, **Tailwind CSS v4**,
**Mongoose** and **MongoDB**. Deploys to Vercel with no server to manage.

This is a rewrite of the original Laravel 12 / Blade / MySQL application. Every
screen, business rule and validation message is carried across; the notes below
call out the three places where the platform forced a different mechanism.

---

## 1. Architecture

### Layers

```
src/middleware.ts        route guard — every path except /login needs a session
  └── src/app/**         Server Components: fetch, render, no business logic
        └── src/actions/**   Server Actions: validation (Zod) + writes
              └── src/lib/services/**   scoring, rankings, dashboard, reports
                    └── src/lib/models/**   Mongoose schemas
```

| Service | Responsibility |
|---|---|
| `services/game-score.ts` | Creating games, syncing line-ups, recording win/loss marks, deriving the team result and winner, deleting games. |
| `services/stats.ts` | Player and team ladders as aggregation pipelines, sorting, filtering, paging, "what rank is X". |
| `services/games.ts` | Reading fixtures with both teams and the line-up resolved in one query. |
| `services/dashboard.ts` | Headline stat cards, leaderboards, recent games, chart payloads. |
| `services/reports.ts` | Period summaries, highlights, CSV export rows. |
| `services/notifications.ts` | Derives the header's "needs attention" list from live data. |
| `services/deletion.ts` | The guards that stop a played team or member being deleted. |
| `lib/blob.ts` | Image uploads to Vercel Blob with generated filenames. |

### The one rule that shapes everything

> **Statistics are never stored — they are derived from game data.**

There is no `totalPoints` field on a player or a `wins` field on a team. What
were correlated SQL sub-selects in the Laravel version are aggregation
`$lookup` sub-pipelines here, which preserves the important property: filtering,
sorting and paging all happen **inside the database**.

```ts
const players = await paginatePlayers(period, filters, page, 25)
```

Because of that, deleting or re-scoring a game automatically corrects every
ranking, profile and report — there is no denormalised value that can drift.

### Scoring flow

There are no point totals to type in. A game is recorded as a **win or a loss**:

1. Admin creates a game and picks the line-ups → `lineup` entries at 0 points.
2. On the result screen each side is marked **WIN (1)** or **LOSS (0)**.
   Selecting either propagates across both sides, so partners always match and
   the opposition flips automatically.
3. `recordScores()` stores the marks, then `recalculate()`:
   - `teamAScore` / `teamBScore` = **1 if that side won, 0 if it lost**
   - the side scoring 1 becomes `winnerTeamId`
4. Rankings recompute themselves on the next page load.

A team's score is **1 for a win regardless of format**, so a 1 vs 1 win counts
exactly as much as a 2 vs 2 win and playing doubles cannot inflate a ranking.

**There are no draws** — every completed game has exactly one winner.
`recordScoreAction` rejects a submission where both sides are marked the same, or
where partners disagree. The browser's live preview is **display only**; the
server re-derives the result from the stored marks and never trusts the client.

Because a player's points are 1 per win, **total points and wins are the same
number** — the UI therefore surfaces *Wins* and *Win %* rather than a redundant
Points column.

### Data model

```
users                (the admin account)

teams  1 ──< players                  players.teamId       set to null on delete
teams  1 ──< games (teamAId)          delete blocked while games exist
teams  1 ──< games (teamBId)          delete blocked while games exist
teams  1 ──< games (winnerTeamId)

games.lineup[]       { playerId, teamId, points }   embedded, not a join table
```

The `game_players` join table became an **embedded array on the game document**.
That is the one structural change from the SQL schema, and it earns its keep:

- A fixture's line-up and its result are written in **a single document update**,
  so a game can never be left half-scored. This is what the Laravel service
  needed `DB::transaction` for on every write.
- "A player cannot appear twice in the same game" is enforced when the line-up
  is built, replacing the `unique (game_id, player_id)` index.
- Player statistics still read straight from game data — `$lookup` +
  `$filter` over `lineup` is the aggregation equivalent of the old sub-select.

A game record is deliberately minimal: **a number, format, the two teams, the
two results, the derived winner, a date, a status and the line-up.** There is no
time, venue or notes field — a fixture is defined by who played, when, and who
won.

Deletes are deliberately asymmetric: a game can be deleted (its result goes with
it), but a **team or member that appears in a recorded game cannot** — that
would rewrite match history. The UI offers "set to inactive" instead.

**Game numbers.** MongoDB has no auto-increment, but the UI refers to fixtures as
`#GM-0042` everywhere. A `counters` collection hands out sequential numbers via
an atomic `findOneAndUpdate`, so two concurrent creates can never collide.

### Business rules enforced

| Rule | Enforced by |
|---|---|
| Team A ≠ Team B | `validateGameForm` |
| 1v1 → exactly 1 player a side; 2v2 → exactly 2 | `validateGameForm` (from `playersPerTeam`) |
| A player cannot be picked twice | `validateGameForm` + `buildLineup` |
| Players must belong to the team they are fielded for | `validateGameForm` |
| Only active players may play | `validateGameForm` |
| A team needs enough active members to participate | `validateGameForm` |
| Team score = 1 for a win, 0 for a loss | `recalculate()` |
| Exactly one team wins; no draws | `recordScoreAction` |
| Partners share the same result | `recordScoreAction` |
| Every player marked, value is 0 or 1 | `recordScoreAction` |
| Score updates are atomic | single-document write in `recordScores()` |
| A played team or member cannot be deleted | `services/deletion.ts` |

---

## 2. What changed from the Laravel version, and why

Three mechanisms had to change because Vercel is serverless. Everything else —
routes, screens, rules, wording — is a direct port.

| Concern | Laravel | Here | Why |
|---|---|---|---|
| **Sessions** | `sessions` database table | Signed JWT in an httpOnly cookie | No per-request DB round-trip; nothing to clean up. `SameSite=Lax`, `Secure` in production. |
| **Uploads** | `storage/app/public` + `storage:link` | Vercel Blob | The Vercel filesystem is read-only at runtime. |
| **PDF export** | dompdf, server-rendered | `/reports/print` + the browser's print dialog | A headless PDF renderer is a heavy cold-start cost for one page. "Save as PDF" produces the same A4 document with selectable text. |
| **Flash messages** | Session flash bag | `?ok=` / `?err=` query parameter, stripped after display | Stateless; survives a redirect without server-side storage. |

**Two caveats worth knowing.**

Signing out clears the cookie, but the JWT it held stays cryptographically valid
until it expires (2 hours, or 30 days with "Remember me"). That is inherent to
stateless sessions: a token already copied out of the browser keeps working. For
a single-admin league that is a fair trade for having no session store; if you
later add more accounts and need sign-out to be immediate, keep a
`sessionVersion` on the user, put it in the token, and compare the two in
`getSession()`.

Login throttling (6 attempts per email+IP per
minute) keeps its counters **in memory**, so on Vercel it is per-instance rather
than global — an attacker spread across many cold lambdas gets more than six
tries. It raises the cost of naive credential stuffing without being a complete
defence. To make it global, back `throttleStatus`/`recordAttempt` in
`src/lib/auth.ts` with Upstash Redis (`@upstash/ratelimit`); the two functions
are the only thing that needs to change.

---

## 3. Requirements

- Node.js **20+** and npm
- A MongoDB database — [MongoDB Atlas](https://www.mongodb.com/atlas) has a free
  tier that is more than enough for a league
- A Vercel Blob store, if you want logo/photo uploads

---

## 4. Local development

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```dotenv
MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/carrom_game?retryWrites=true&w=majority"
AUTH_SECRET="paste-a-long-random-string"          # openssl rand -base64 32
NEXT_PUBLIC_APP_NAME="Carrom Arena"

ADMIN_NAME="Tournament Admin"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="a-strong-password"

BLOB_READ_WRITE_TOKEN=""                          # optional, for uploads
```

The admin credentials are read from the environment on purpose, so a real
password never lands in a seeder file under source control. `.env.local` is
gitignored; `.env.example` ships placeholders only.

```bash
npm run seed     # schema indexes + demo league
npm run dev      # http://localhost:3000
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set.

To change the password later, use **Settings → Change password** in the app, or
update `ADMIN_PASSWORD` and re-run `npm run seed` — the seeder matches on email,
so it updates the existing account in place rather than creating a second one.

### No MongoDB to hand?

`scripts/dev-mongo.ts` boots a throwaway `mongod` on port 27099:

```bash
npx tsx --conditions=react-server scripts/dev-mongo.ts   # leave running
# then set MONGODB_URI="mongodb://127.0.0.1:27099/carrom_game"
npm run seed && npm run dev
```

The binary is downloaded on first use and cached in `~/.cache/mongodb-binaries`.
Nothing about this ships to production.

### Seeded data

4 teams · 24 members (2 deliberately inactive) · 36 games across 1v1 and 2v2,
spread over the last ~10 weeks, with 3 unplayed fixtures. The dashboard is fully
populated the moment seeding finishes. Re-running `npm run seed` rebuilds the
fixtures from scratch while leaving teams and members in place.

---

## 5. Deploying to Vercel

1. Push this directory to a Git repository and import it at
   [vercel.com/new](https://vercel.com/new). The framework is detected
   automatically — no build settings to change.
2. Add the environment variables under **Settings → Environment Variables**:
   `MONGODB_URI`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_NAME`, and the three `ADMIN_*`
   values.
3. Under **Storage**, create a **Blob** store and connect it to the project.
   Vercel injects `BLOB_READ_WRITE_TOKEN` for you. Skip this if you do not need
   logo and photo uploads — the app falls back to coloured initials.
4. In Atlas, under **Network Access**, allow `0.0.0.0/0` (Vercel's build and
   function IPs are not fixed), and create a database user for the app.
5. Deploy, then seed the production database once from your machine:

   ```bash
   MONGODB_URI="<the Atlas URI>" \
   ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-strong-password" \
   npm run seed
   ```

Every page is server-rendered on demand (`force-dynamic`) because the numbers
are derived live, so there is no build-time data step and no cache to bust.

---

## 6. Verification

`scripts/verify.ts` boots an ephemeral MongoDB, seeds the demo league through
the same services the UI uses, then asserts the derived statistics and every
business rule — 95 checks:

```bash
npx tsx --conditions=react-server scripts/verify.ts
```

Coverage: win/loss derivation, format-independent team scoring, the no-draw and
matching-partners rules, ranking recalculation after scoring / reopening /
deleting, aggregation totals cross-checked against a manual count of the raw
documents, search-term regex escaping, filtering, sorting, paging, period
windows, CSV shape, notification derivation, delete guards and gap-free game
numbering.

`npm run typecheck` and `npm run build` cover the rest.

---

## 7. Screens

| Route | What it does |
|---|---|
| `/dashboard` | Stat cards, top-10 player leaderboard (gold/silver/bronze), team ladder, 4 charts, recent games |
| `/teams` … `/teams/[id]` | Team CRUD, roster, results, ranking |
| `/players` … `/players/[id]` | Member CRUD with search/filter/sort, full profile + game history |
| `/games` | Game history — search, date range, team, player, format, winner and status filters |
| `/games/create` | Format-aware line-up picker (1 vs 1 or 2 vs 2) |
| `/games/[id]/score` | Win/loss result screen |
| `/rankings/players`, `/rankings/teams` | Ladders with all-time / month / week / year windows |
| `/reports` | Period summary, highlights, standings, CSV + printable PDF |
| `/settings` | Admin profile, password, system snapshot |
| `/search` | Global search across members, teams and games |
| `/api/reports/export/[dataset]` | CSV download for `players`, `teams` or `games` |

---

## 8. Extending the scoring system

The scoring model is intentionally minimal — points live on `game.lineup[]`.
To add rules (queen bonus, penalties, sets), the seams are:

- **Add fields to the `LineupSchema`** (e.g. `queenPoints`, `penaltyPoints`), or
  simply widen `points` back out from 0/1 to a real tally.
- **Change one function**: `recalculate()` in `services/game-score.ts` is the
  single place where a team result is produced. Everything else — rankings,
  dashboard, reports, exports — reads from `teamAScore` / `teamBScore` or
  `lineup[].points`, so it follows automatically.
- **Widen validation** in `recordScoreAction` (the `0 | 1` check and the
  decisive-result block are what currently enforce win/loss only).
- Formats beyond 1v1/2v2: add a case to `GAME_FORMATS` in `lib/enums.ts` with
  its `playersPerTeam()`. Validation, the line-up picker and the scoring screen
  all read from there.
# carrom-next
