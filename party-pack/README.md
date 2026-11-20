# 🎉 Party Pack — self-running party games

A party game for phones. Create a room (you become the host and play too), friends join with
the code, everyone taps Ready, the host starts. After a 30-second profile the games run
themselves: questions open and close on timers or as soon as everyone has answered, standings
show between games, then awards and a podium.

- **Phones** play everything. **TV** is optional: tap "TV" in the lobby and open the link on a big screen.
- **Host controls:** choose and order games, pick a theme, add practice bots, start, pause, skip, remove a player.
- **Rejoin:** name + email to join; a 4-digit rejoin code is shown on screen and emailed (when email is configured).

## Games

| Game | What happens | Needs the question packs? |
|---|---|---|
| 🎬 Guess the Movie | Name the film from emoji clues | yes |
| ⚡ Quick Quiz | Ten questions, faster answers score more | yes |
| 🧠 Category Clash | Take turns picking clues from a board | yes |
| 💰 Money Ladder | Prizes climb with every question | yes |
| 💃 Dance-Off | Dance to a mystery song, the room rates it | no |
| 👀 Spot It | Find the odd one out in a grid of look-alikes | no |
| 🐝 Hive Mind | "This or that" with no right answer — match the majority | no |
| 🚦 Green Light | Tap the instant the light turns green | no |
| 💡 Memory Flash | Memorise a row of pictures, then answer from memory | no |
| 🔢 Number Crunch | Speedy sums against the clock | no |

The last five are **mini games**: short, generated fresh every time (`server/minis.js`), and free of
language or local knowledge, so they work for any crowd. New rooms start with the first five; the
host adds mini games under "Add more" in the lobby.

Questions for the first four come from a tagged bank (`server/bank.js`, `server/packs/`) picked to
suit the room's ages and interests, plus a few about the guests themselves from their profile answers.

## Theme packs

A room has one look, shared by every phone and the TV. The host picks it in the lobby under **Theme**.

- **Auto** (the default) follows the season where the host is: Blossom (spring), Sunshine (summer),
  Harvest (autumn), Frost (winter). The host's time zone tells us the hemisphere.
- **Festival packs** are there to pick any time, and are listed first while they are in season:
  New Year, Lunar New Year, Spooky Night, Festival of Lights, Winter Holidays.
- **Midnight** is the all-year classic.

Each pack is a set of colours plus its own drifting weather (petals, leaves, snow, lanterns…) and
confetti colours. To add one: add an entry to `server/themes.js`, a `[data-pack="id"]` block of
tokens in `public/css/ui.css`, and a line in `AMBIENT` in `public/js/common.js`.

## Live dashboard

`/admin` shows who is playing right now (rooms, players connected, what game they're on) and past
parties (when, how many players, which games and theme, finished or left early), plus parties per
day, most-played games and themes. It auto-refreshes every few seconds.

- Switched on by setting `ADMIN_KEY` (10+ characters). Without it `/admin` says it is off and the API returns 404.
- Counts only: no names, emails or answers are stored or shown.
- History is one small row per party in `<prefix>_history`, written when a party reaches the podium, or when an
  unfinished room expires. The server creates the table itself if its database login allows;
  otherwise run `migrations/003_history.sql` once. History starts from the day it is switched on.

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
| `ADMIN_KEY` | Turns on the live dashboard at `/admin`. 10+ characters; leave unset to keep it off |
| `GAME_SPEED` | Test only. Never set in production |

## Files
`server/core.js` requests, rooms, actions, views · `server/director.js` the game list and automatic flow ·
`server/games.js` game engines · `server/minis.js` mini-game generators · `server/themes.js` theme packs ·
`server/bank.js` question bank · `public/css/ui.css` design tokens and packs · `public/js/play.js` the phone app ·
`public/js/tv.js` the optional TV.
