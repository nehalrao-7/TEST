# 🪔 Diwali Party — self-running

A party game for phones. Create a room (you become the host and play too), friends join with
the code, everyone taps Ready, the host starts. After a 30-second profile (age, interests,
genres, a few fun answers) the games run themselves: questions open and close on timers or
as soon as everyone has answered, standings show between games, then awards and a podium.

- **Phones** play everything. **TV** is optional: tap "Open on TV" and open the link on a big screen.
- **Host controls:** choose and order games, add practice bots, start, pause, skip, remove a player.
- **Games:** Guess the Movie, Desi Kahoot, Desi Jeopardy (pick on phones, answer multiple choice),
  KBC, Hook Step (song plays, dancers tap "I'm dancing", everyone else rates 1–5 diyas).
- **Questions** come from a tagged bank (`server/bank.js`) picked to suit the room's ages and interests,
  plus a few about the guests themselves from their profile answers.
- **Rejoin:** name + email to join; a 4-digit rejoin code is shown on screen and emailed (when email is configured).

## Run locally
```bash
npm install
npm start                 # http://localhost:3000
GAME_SPEED=8 npm start    # every clock 8× faster, for testing
```

## Settings (environment)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (file storage in `data/` when unset) |
| `DB_PREFIX` | Table prefix, e.g. `dgo` (default `dgn`) so it can share a database |
| `PHONE_PEPPER` | Secret mixed into email fingerprints |
| `SUPABASE_URL`, `SUPABASE_KEY` | Optional live "refresh" nudges |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional: email rejoin codes via Resend |
| `GAME_SPEED` | Test only. Never set in production |

## Files
`server/core.js` requests, rooms, actions, views · `server/director.js` the automatic flow ·
`server/games.js` game engines · `server/bank.js` question bank · `public/js/play.js` the phone app ·
`public/js/tv.js` the optional TV.
