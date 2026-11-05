# Handoff guide — Diwali Game Night

Read this first, then `README.md` (feature tour). This file covers what a developer or AI coding assistant needs to keep building safely.

## 1. What it is

A live party-game web app for 12–16 guests, with three screens:

| Screen | URL | Role |
|---|---|---|
| TV | `/tv` | **Source of truth.** Questions, Jeopardy board, reveals, standings, awards. |
| Phone | `/play` | **Controller only.** One "moment" at a time: shape buttons, buzzer, Sahi/Galat, "eyes on TV". |
| Host | `/host` | **Control room** (dark theme). Run-of-show plus a single "Next cue" button (Space). Questions editor, players, scores. |

- **Live site:** https://diwali-game-night.vercel.app
- **Code:** GitHub `nehalrao-7/TEST`, branch `diwali-game-night`, folder `diwali-games/`

## 2. Stack (deliberately simple)

- **Front end:** plain JS, HTML and CSS. No framework and no build step. Files are in `public/`.
- **Back end:** Node 18+ (CommonJS). A single serverless function, `api/main.js`, handles every `/api/*` route (rewrite in `vercel.json`). Locally, `server/index.js` (Express) serves the same routes.
- **State:** one JSON document. In production it's a single Supabase Postgres row (`dgn_state`) with a version number. Locally it's `data/state.json`.
- **Realtime:** after every save, Supabase Realtime broadcasts `{v: version}` on channel `dgn`, and clients refetch their own view. If realtime fails, clients poll.
- **Only npm dependencies:** `express` (local dev only) and `qrcode`. The browser loads `@supabase/supabase-js@2.45.4` from jsDelivr and the YouTube IFrame API.

## 3. Run it locally

```bash
cd diwali-games
npm install
OPEN_ACCESS=true npm start   # http://localhost:3000 — /tv, /host, /play (no PIN, no phone codes)
```

Practice run: Host → 🎮 Live → **🤖 Start demo** adds bots that play every game. **End demo & reset** removes them.

## 4. File map

```
api/main.js           Vercel entry → server/core.handle()
server/core.js        Request pipeline, auth, host actions (hostAction), player actions (playerAction),
                      per-role views (tv / player / host), awards, TV media (YouTube), practice mode
server/games.js       Game engines: quiz, jeopardy, kbc, hookstep, custom + tick() + nextDeadline()
server/state.js       State shape, migrations in setState(), players/teams, points ledger, power-ups, stats
server/personalize.js "About me" questionnaire prompts → personalised questions (~20% of each game)
server/practice.js    Super-easy stand-in questions used in practice/demo mode
server/bots.js        Demo bots: planned, timed actions per game phase
server/content.js     Default questions, clues and songs
server/stores.js      Supabase store (prod) / file store (local)
server/sms.js         Optional Twilio SMS for phone codes
server/youtube.js     YouTube link + timestamp parser (also copied to public/js/youtube.js)
public/js/common.js   App.connect (HTTP + realtime), App.patch, fireworks, sounds, diya SVG, reactions
public/js/tv.js       TV scenes        public/css/tv.css
public/js/play.js     Phone controller public/css/play.css
public/js/host.js     Host console     public/css/host.css
public/js/editor.js   Host "Questions" tab (all game content as forms)
public/css/app.css    Design tokens + shared components (colours, buttons, cards, answer shapes)
supabase/schema.sql   Database tables + RPC functions (dgn_load / dgn_save / dgn_seen)
```

## 5. How a request works (important)

`server/core.js → run(store, mutate)`:

1. Load state (`store.load()` returns `{version, data, online}`), then call `S.setState(data)`. This also runs migrations.
2. `tick(state)` applies passed deadlines (timers don't exist on serverless). `Bots.tick()` runs any bot actions that are due.
3. Run the mutation (a host or player action).
4. If the JSON changed, call `store.save(version, state)`. This is a compare-and-swap; on conflict it reloads and retries up to 30 times.
5. Return the caller's view (`viewFor(role, token)`).

Requests inside one instance are serialised (the `serial()` queue) because engines mutate the module-level `S.state`.

**Rules when adding features:**
- **All game state lives in `state`** (JSON-serialisable). No in-memory timers. Express deadlines as timestamps, handle them in `tick()`, and add them to `nextDeadline()` so clients call `/api/tick` on time.
- **Never send secrets to the wrong role.** Answer keys only go to the host view (`viewer.host`), and phones never see `answer`. The TV view gets public data only.
- **Engines read content through `playGame(game)`** (core), which swaps in `live.content`, the personalised or practice set chosen at game start.
- **Points always go through `S.award()` / `S.awardEntity()`.** That's the ledger: undo, Double Dhamaka, stats and awards depend on it.
- **Add migrations in `setState()`** (state.js) for new fields, because the live database already has saved state.

## 6. Front-end conventions

- **`App.patch(el, html, force)`** only replaces innerHTML when the HTML string changed, and never while the user is typing (unless `force`).
- **TV and phone use keyed scenes/moments.** Each renderer returns `[html, key]` (the phone returns `[key, html, dockMode]`). When the key changes, the container plays its entry animation and `onSceneChange` / `onMoment` fire sounds, fireworks and vibration.
- **Timers:** `data-count=<serverMs>` shows seconds left, and `.timer[data-start][data-end]` is the burning bar. `App.now()` is server-synced time.
- **Answer shapes:** `App.shapes[i]` (diya, lotus, star, moon) with colour classes `o0`–`o3`.
- **Design tokens** live in `app.css` `:root` (kohl, marigold, haldi, sindoor, rani, peacock, leaf, brass, cream). The host overrides them for its dark theme in `host.css`.
- **Phone layout:** the phone shows one moment only, with no question text. The TV is the source of truth, so keep it that way.

## 7. Game rules (current)

- **Quiz** (Guess the Movie, Kahoot): answers score 100–200 by speed. A streak of 3+ earns +50. The last question is a **✨ Double Diya** (×2). Team mode awards everyone the team's average.
- **Jeopardy:**
  - The host picks a clue. Buzzers stay armed until the host presses **Open buzzers**; buzzing early gives that team a 600ms lockout.
  - A correct answer gives control (the team in control picks next).
  - Two hidden **Daily Doubles**: the host enters the wager, and only the team in control answers.
- **KBC:** Fastest Finger First, then the hot seat with an 8-level ladder and safe levels. Lifelines are 50:50, Poll (other phones vote) and Phone-a-friend. The audience predicts **Sahi/Galat** (+25 if right).
- **Hook Step (no phones):**
  1. The host calls a team and spins a song on the TV.
  2. The host taps each dancer (each gets a +100 **Himmat bonus**) and rates 1–5 diyas (×100 to the team).
  3. The optional TV-microphone **Applause-o-meter** adds up to +200.
- **Awards:** frozen when the ceremony starts. Each award gives winners +200 points.
- **Power-ups:** Double Dhamaka (next score, once, extra capped at 400), Chor Bazaar (steal), Raksha Kavach (shield), Lucky Laddoo, Ulta Pulta (swap) and Phuljhari Hint. Guests use them from the phone's 🎁 drawer between games. They stay closed during the awards ceremony and the podium. TV announcements are either a `bumper` (the picture) or a `lower` third (the picture stays up). Question clocks wait until a bumper has finished.

## 8. Deploying

- **Vercel project** `diwali-game-night` (team "nehalrao97-gmailcoms-projects"). Root directory is `diwali-games`, output directory is `public`, and the region is `iad1`.
- **Production builds came from branch `diwali-game-night`.** To ship a change:
  - push to that branch, then redeploy production in the Vercel dashboard (Deployments → ⋯ → Promote / Redeploy), **or**
  - merge the branch into `main` so pushes to `main` deploy production automatically.
- **Vercel environment variables:**

  | Variable | Purpose | Secret? |
  |---|---|---|
  | `SUPABASE_URL` | Database address | Public |
  | `SUPABASE_KEY` | Publishable key | Public |
  | `DGN_SECRET` | Server secret; must match row 1 of the `dgn_secret` table | **Secret** — not in the repo |
  | `HOST_PIN` | Host console PIN | **Secret** — not in the repo |
  | `OPEN_ACCESS` | Currently `true`; remove it to bring back the host PIN and phone codes | Setting |
  | `TWILIO_*` | Optional SMS | **Secret** |

- **Database:** Supabase project `diwali-game-night`. The schema is in `supabase/schema.sql`.

## 9. Testing tips

- **Syntax check:** `node --check public/js/*.js server/*.js`
- **Server only:** drive the API with `fetch`. `POST /api/host/login {pin}`, then `POST /api/act {role:'host', token, action:{type:'game', action:{...}}}`. Players join with `POST /api/otp/request {name, deviceId}` when `OPEN_ACCESS=true`.
- **Bots:** they only act when something requests `/api/tick` or `/api/view`. A TV tab does this automatically; in scripts, loop `POST /api/tick {role:'tv'}`.
- **Visual check:** Playwright with three pages (`/tv` at 1600×900, `/host`, `/play` at a mobile viewport).

## 10. Before the party

- Remove `OPEN_ACCESS` on Vercel and redeploy, so the host PIN and phone codes return.
- Check the trivia answers in Host → ✏️ Questions, and add YouTube links for the songs.
- Do one rehearsal on the real TV: enable sound, allow the microphone, and press **End demo & reset**.
