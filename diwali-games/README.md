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

## Run it

Requires Node 18+.

```bash
cd diwali-games
npm install
HOST_PIN=2468 npm start
```

The server prints the URLs and the host PIN. If you don't set `HOST_PIN`, it generates one and prints it.

### Hosting options

1. **Home Wi-Fi (simplest):** run it on a laptop connected to the TV. Guests on the same Wi-Fi open `http://<laptop-ip>:3000/play`. The TV's lobby shows a QR code for whatever address the TV page was opened with, so open `/tv` using the laptop's IP, not `localhost`.
2. **Public URL from your laptop:** `npx cloudflared tunnel --url http://localhost:3000` (or ngrok) gives you an https link guests can use on mobile data.
3. **Cloud:** any Node host that supports WebSockets (Render, Railway, Fly.io). Start command `npm start`, root directory `diwali-games`. State is saved to `data/state.json`. On hosts with an ephemeral disk, point `DATA_DIR` at a persistent volume if you need it to survive restarts.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default 3000) |
| `HOST_PIN` | PIN for the host console |
| `DATA_DIR` | Where `state.json` is stored (default `./data`) |
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
server/index.js    HTTP + Socket.IO, auth, host actions
server/state.js    players, teams, ledger, power-ups, persistence
server/games.js    game engines (quiz, jeopardy, kbc, hookstep, custom)
server/content.js  sample questions, clues and songs
server/sms.js      Twilio SMS (optional)
public/            play / host / tv pages (vanilla JS, no build step)
```
