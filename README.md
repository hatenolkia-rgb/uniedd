# UniEDD website

Marketing site for [uniedd.com](https://uniedd.com): live 1:1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess. Built with Next.js (App Router), Tailwind CSS, and GSAP, and deployed on Vercel.

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## Clap Rhythm game

`/games/clap-rhythm` is a rhythm trainer: clap markers scroll down a highway in time with a song and the
student claps on the hit ring. Code lives in `app/games/clap/` (`songs.ts` song data, `engine.ts` Web Audio
synth + mic clap detector, `highway.ts` canvas renderer, `ClapTrainer.tsx` UI).

- **Mic claps:** the mic signal is high-passed (claps are bright, voices and hum are not) and an AudioWorklet
  flags sudden energy spikes above an adaptive noise floor (80 ms debounce). Space / tap is the fallback.
- **Calibration:** the student claps along to 12 clicks; the median offset is saved per device and
  subtracted from every clap.
- **Add songs:** drop an audio file and a song JSON into `public/clap-songs/` and list it in
  `public/clap-songs/songs.json` — see `public/clap-songs/README.md`. The in-game chart maker
  ("For teachers") creates the JSON by tapping along to the audio.
- **Difficulty stars:** every song shows 1–5 ★. Set `difficulty` in the song data, or it is computed from
  the chart (clap density, shortest gap, off-beat claps, tempo) by `autoStars()` in `songs.ts`.
- **Kids & Nursery Rhymes:** public-domain tunes written as melody data in `songs.ts` (`kids: true`).
- **Sync (one clock):** audio files are decoded to an `AudioBuffer` and started with
  `AudioBufferSourceNode.start(when, offset)`; synth notes, metronome, count-in and guide clicks are queued by a
  25 ms / 500 ms lookahead scheduler on `AudioContext` time. All of them, and the markers, use
  `songTime = anchorSong + (ctxTime - anchorCtx) * speed`. Slower speeds use `playbackRate` (the pitch drops).
  Visuals use the *heard* time `ctx.currentTime - outputLatency` (fallback `baseLatency`), smoothed every frame.
  The mic/tap calibration only shifts how claps are judged, never visuals or audio. Players can fine-tune
  ±150 ms with the **Audio sync** slider (`localStorage["uniedd-clap-audio-sync"]`), checking with **Guide clap**.
  Add `?clapdebug=1` to the URL to log every marker crossing in `window.__clapSync`.

## Online chess

`/games/chess-online` lets two visitors play a live game. A player types a display name (no sign-up), presses
**Find opponent** and waits in the online waiting room until they're paired with the next waiting player
(first in, first out). Code: `app/games/chess/PlayOnline.tsx` (UI), `app/games/chess/online.ts` (shared rules),
`app/api/games/chess/route.ts` (API) and `app/lib/games/chessStore.ts` (storage).

- **Storage:** Supabase tables and functions from `supabase/chess_multiplayer.sql`, called only from the server
  with the service-role key. `chess_matchmake()` pairs players under an advisory lock with
  `FOR UPDATE SKIP LOCKED`, so nobody is matched twice. Every move is checked with chess.js on the server and
  stored with an expected-ply check, so a stale or illegal move is rejected.
- **Security:** each player gets a random secret in their browser; only its SHA-256 hash is stored. RLS lets the
  anon key *read* `chess_games` (names and moves) for Realtime and nothing else.
- **Live updates:** Supabase Realtime on `chess_games` when `SUPABASE_ANON_KEY` is set, plus a heartbeat that
  doubles as polling. Waiting players not seen for 15 s are never matched; an opponent silent for 15 s shows a
  "disconnected" notice and after 45 s the other player can claim the win.
- **Private teacher lobbies** (`supabase/chess_teacher_lobby.sql`): a teacher presses *Create private lobby* and
  gets a 6-character code plus a link (`/games/chess-online?room=CODE`); one student joins with it. Rooms are never
  matched from the public waiting room. The teacher can take back the last move, approve or decline a student's
  take-back request, allow free student take-backs, reset the board, pick or swap colours, and use demo mode
  (move both sides). Teacher actions are checked against the creator's secret in the API and again in
  `chess_room_update()`, and every change must quote `chess_games.version`, so stale actions are rejected. The room
  code and secrets live in the server-only `chess_rooms` table, never in `chess_games`.
- **Local dev:** without Supabase env vars, `npm run dev` uses an in-memory store with the same rules, so you can
  play yourself in two browser windows. Production never uses the memory store.
- **Emoji reactions:** players tap one of 10 allowlisted emoji (`app/games/chess/reactions.ts`); only the id is
  sent. The server stores the latest one per player in the existing `chess_games.last_move` jsonb (`rx`), so it
  reaches the opponent through the same Realtime update/polling as moves — no extra SQL. Rate-limited per player
  (1.5 s cooldown, checked against the stored reaction) and per IP (30/min). The next move clears them.

### Board styles and capture animations

All chess pages share `app/games/chess/Board.tsx`. The "🎨 Board style" panel (`StylePicker.tsx`) picks a board
theme and a piece set (classic or emoji sets on white/blue vs dark/orange discs) from `themes.ts`; the choice is
saved in localStorage. Capturing a knight/bishop, rook or queen plays a short (~1.5 s), non-blocking celebration
(`captures.ts`, `CaptureFx.tsx`, CSS in `chessThemes.css`) that grows with the piece's value. It can be switched
off in the panel and is toned down for `prefers-reduced-motion`. The "⛶ Fullscreen" button (`ChessGame.tsx`) puts
the whole chess area in browser fullscreen, or a full-window layer where the Fullscreen API isn't available
(iPhone Safari); Esc exits.

## How demo bookings work

1. A visitor submits the "Book a Demo" form (`app/components/CTA.tsx`). Demos are free.
2. `app/api/contact/route.ts` validates the request and then:
   - sends a WhatsApp alert to the team (`app/lib/whatsapp.ts`)
   - sends a WhatsApp welcome message to the visitor
   - emails the visitor a confirmation through Resend (`app/lib/resend.ts`)
   - queues the lead in Supabase (`lead_digest_queue`)
3. Once a day, Vercel Cron calls `app/api/send-lead-digest/route.ts` (schedule in `vercel.json`). It emails `ADMIN_EMAIL` one summary of the queued leads, then clears the queue.

Every integration is optional. If its env vars are missing, that step is skipped and the booking still goes through.

## Environment variables

Set these in Vercel → Project Settings → Environment Variables.

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | Confirmation and digest emails (sent from `no-reply@uniedd.com`) |
| `ADMIN_EMAIL` | Where the daily lead digest goes |
| `CRON_SECRET` | Authorises the digest cron job (enable "Secure Cron Jobs" in Vercel) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Lead digest queue and online chess. Server-side only; never expose the service-role key |
| `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Optional. Lets online chess push moves instantly with Supabase Realtime; without it the game polls every 1.5 s |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API sender |
| `WHATSAPP_NOTIFY_TO` | Comma-separated team numbers for lead alerts (E.164 without `+`) |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | Team alert template (default `new_lead_alert` / `en_US`) |
| `WHATSAPP_STUDENT_TEMPLATE_NAME`, `WHATSAPP_STUDENT_TEMPLATE_LANG` | Visitor welcome template (default `student_welcome` / `en`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Shared rate limiting (see below) |

The WhatsApp templates must be approved in Meta WhatsApp Manager. `app/lib/whatsapp.ts` documents their body variables.

## One-time setup

- Run `supabase/lead_digest_queue.sql` in the Supabase SQL editor.
- Run `supabase/chess_multiplayer.sql` in the Supabase SQL editor (online chess; safe to re-run).
- Then run `supabase/chess_teacher_lobby.sql` (private teacher lobbies; safe to re-run).

## Tracking

The Meta Pixel (`app/components/MetaPixel.tsx`) loads only after a visitor accepts the cookie banner. If you add another tracker, gate it the same way and list it in the privacy policy (`app/privacy/page.tsx`).

## Rate limiting

`app/api/rate-limit.ts` keeps its counters in Upstash Redis, so the limits hold across every serverless instance. The booking form allows 5 requests per IP every 10 minutes and 2 requests per phone number per day. To set it up, add Upstash from Vercel → Storage (this sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), or create a database at upstash.com and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without these, or if Redis can't be reached, it falls back to a per-instance in-memory limiter that only stops simple abuse.
