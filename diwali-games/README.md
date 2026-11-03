# 🪔 Diwali Game Night

A live, multiplayer party-game system for 12–16 guests: players use their phones, the host runs the show from a console, and the TV shows a big-screen display everyone watches.

| Screen | URL | Who |
| --- | --- | --- |
| Player app | `/play` | Every guest, on their phone (scan the QR on the TV) |
| Host console | `/host` | You, on a laptop, tablet or phone (PIN protected) |
| TV display | `/tv` | The big screen (cast or HDMI a browser tab) |

## Games included

| Game | Type | Default mode | How it plays |
| --- | --- | --- | --- |
| 🎬 Guess the Movie | Quiz | Teams | Emoji clues on the TV, answer on phones. Teams earn their members' average. |
| 💃 Hook Step Challenge | Hook step | Solo | Spin a random Bollywood song, perform the hook step, and the crowd rates you 1–5 diyas on their phones. The host can add a judges' bonus. |
| 🧠 Desi Jeopardy | Jeopardy | Teams | 5×5 board on the TV, buzzers on phones (they show the order and reaction times), and the host marks answers ✓/✗. |
| ⚡ Diwali Kahoot | Quiz | Solo | Kahoot-style: faster correct answers earn more (100–200 pts). |
| 💰 Kaun Banega Crorepati | KBC | Solo | Fastest Finger First picks who takes the hot seat, then they climb an 8-level ladder with safe levels. Lifelines are 50:50, Audience Poll (everyone votes on their phone) and Phone-a-Friend. |

Every game can be switched between **Solo** and **Teams**, reordered, edited (questions, clues, songs, point values) or duplicated from the **Games** tab. You can also add **Custom** games (Antakshari, Tambola, Dumb Charades…) that you score by hand.

## Editing questions & adding music

**Host → ✏️ Questions** shows every game's questions on one page as normal form fields. You can:
- type questions and options, and click the circle next to the correct option
- add, delete and reorder questions, Jeopardy categories and clues, KBC levels and songs
- save one game at a time, or use **Save all**

Every question, clue and song has a **🎵 YouTube link** field. Paste a link with a timestamp (`https://youtu.be/abc?t=75`, `…watch?v=abc&t=1m15s`, or a Shorts link) and the TV plays it from that point. **Play for (s)** stops it after that many seconds.

- Questions play the audio only, so the video doesn't give the answer away. The video appears when the answer is revealed. Tick **show video** to show it from the start.
- Hook Step songs play while the performer is dancing.
- The host's TV card has **Replay / Show video / Stop** buttons, and a box to play any YouTube link on the TV right away.

Click **Tap to enable sound & music** on the TV once, because browsers block audio until someone clicks on the page.

## Personalised questions ("About me")

1. After joining, each guest sees a short **About me** questionnaire on their phone: favourite movie, dream holiday, Diwali sweet, a song that gets them dancing, a hidden talent and more. You can edit the list in **✏️ Questions → ✨ Personalised questions**.
2. When you **start** a game, about **20%** of its questions (adjustable from 0–50%) are swapped for questions built from those answers. The rest come from your standard set, and your saved questions are never changed.
   - **Quiz games:** for example "Whose dream holiday destination is Bali?" (options are guest names) or "What is Priya's favourite movie?" (options are other guests' answers). Guess the Movie prefers movie answers.
   - **Jeopardy:** one category becomes **✨ Know Your Guests**.
   - **KBC:** about 20% of Fastest Finger questions and ladder levels. The person in the hot seat is never asked about themselves.
   - **Hook Step:** guests' favourite dance songs join the song list.
3. Personal questions show **✨ About our guests** on the TV, and the game-start announcement says how many there are. Each guest is featured at most once per game, spread across everyone. The same answer isn't reused in a later game unless the pool runs out.
4. **Players → 📝 "About me" answers** lets you read every answer and delete anything you don't want on the TV. Untick **✨ Personalize** on any game to keep it 100% standard.

## Scoring, rankings & power-ups

- Every point goes into a ledger. You can **undo** any entry from *Scores & Settings*, and award or deduct points for any player or team at any time.
- In team games, every member of the team gets the team's points. Team standings show the average per member, so uneven teams stay fair.
- When a game ends, the TV switches to an animated **leaderboard with ▲/▼ rank movement** since that game started. **Podium** is the grand finale.
- **Secret power-ups:** each guest gets 2 random power-ups when they join. They're hidden behind "tap to reveal" cards on their phone, and the TV announces them dramatically when used:
  - 💥 **Double Dhamaka**: double points for the current or next game
  - 🦹 **Chor Bazaar**: steal points from any player (default 150)
  - 🛡️ **Raksha Kavach**: passive, auto-blocks the first steal or swap against you
  - 🍬 **Lucky Laddoo**: mystery 50–300 points
  - 🔄 **Ulta Pulta**: swap scores with the player just above you (capped at 300)
  - ✨ **Phuljhari Hint**: removes 2 wrong answers on a quiz question

  Pause them, change the steal and swap amounts, or re-deal them from the host console.

## Phone verification

Guests enter their name, choose an avatar and enter their phone number, then verify with a one-time code. The same phone number logs back in on any device and keeps its points.

- **With SMS (Twilio):** set the env vars below and guests receive a 6-digit code by text.
- **Without SMS (default):** a 4-digit code appears on the host console under *Verification codes*, and you read it out to the guest. It costs nothing and needs no setup, which suits a house party.

## Live site

**https://diwali-game-night.vercel.app**: players `/play`, host `/host`, TV `/tv`.

- **Hosting:** Vercel serves `public/`. All `/api/*` routes go to one serverless function (`api/main.js`).
- **State:** the whole game is one JSON row in Supabase (`supabase/schema.sql`), saved with a version check so simultaneous answers never overwrite each other.
- **Real-time:** each save broadcasts the new version on a Supabase Realtime channel, and every screen refetches its own view. If the realtime connection drops, screens poll every few seconds.
- **Timers:** questions and votes end at fixed deadlines. Every request applies any deadline that has passed, and screens send a "tick" when a countdown hits zero.

Vercel environment variables: `SUPABASE_URL`, `SUPABASE_KEY` (publishable key), `DGN_SECRET` (must match the `dgn_secret` row), `HOST_PIN`, plus the optional `TWILIO_*` variables below.

## Run it locally

Requires Node 18+.

```bash
cd diwali-games
npm install
HOST_PIN=2468 npm start      # http://localhost:3000, state saved in ./data, screens poll
```

Without the `SUPABASE_*` variables, the local server keeps state in `data/state.json`. Open `/tv` with the laptop's IP address (not `localhost`) so the QR code works for guests on the same Wi-Fi.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `HOST_PIN` | PIN for the host console |
| `SUPABASE_URL`, `SUPABASE_KEY`, `DGN_SECRET` | Use Supabase for state and realtime (hosted mode) |
| `PORT`, `DATA_DIR` | Local server port and data folder |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Enable real SMS codes |
| `TWILIO_FROM` *or* `TWILIO_MESSAGING_SERVICE_SID` | Sender for the SMS |

## Party-night checklist

1. Start the server, then open `/tv` on the TV and click **Tap to enable sound**.
2. Open `/host`, enter the PIN, and keep the **Players** tab open while guests scan the QR code.
3. **Players → Make teams** (balanced by score, and late joiners are auto-assigned), then **Show teams on TV**.
4. On the **Live** tab, click **Start**. Each game has its own big buttons, and **End game** shows the leaderboard.
5. Finish with **TV → Podium** 🎆

## Project layout

```
api/main.js        Vercel function entry (all /api routes)
server/core.js     request pipeline, auth, host & player actions, views
server/stores.js   Supabase store (hosted) and file store (local)
server/index.js    local dev server
server/state.js    players, teams, ledger, power-ups
server/games.js    game engines (quiz, jeopardy, kbc, hookstep, custom)
server/content.js  sample questions, clues and songs
server/sms.js      Twilio SMS (optional)
public/            play / host / tv pages (vanilla JS, no build step)
```
