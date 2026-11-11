# Clap Rhythm songs

Songs for the **Clap Rhythm** game (`/games/clap-rhythm`). Jingle Bells and Happy Birthday
(plus two warm-ups) are built in. This folder fills the 8 extra song slots.

## Add a song (3 steps)

1. Put the audio file here, e.g. `public/clap-songs/my-song.mp3` (mp3, m4a, ogg or wav).
2. Add a song file next to it, e.g. `public/clap-songs/my-song.json` (copy `example-song.json`).
   The easiest way to get the clap timings is the **chart maker** on the game page
   ("For teachers: make a clap chart") — load the audio, tap along, press *Download song file*.
3. List it in `songs.json`:

```json
{ "songs": ["my-song.json", "another-song.json"] }
```

Reload the game: the song takes the next free slot. No code changes are needed.

## Song file fields

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | yes | Name shown in the song list |
| `bpm` | yes | Tempo, used for the beat lines and to turn `claps` (beats) into seconds |
| `timeSignature` | no | `"4/4"` (default), `"3/4"`, `"6/8"`… only the top number is used |
| `audio` | no | Audio file name in this folder (or a full URL). Without it the game plays a synth tune if `notes` have `midi`, otherwise just the clicks |
| `offset` | no | Seconds into the audio where beat 0 (the first downbeat) happens |
| `claps` | one of these | Clap moments in **beats** from beat 0, e.g. `[0, 1, 2, 2.5, 3]` |
| `clapTimes` | one of these | Clap moments in **seconds** from the start of the audio (what the chart maker exports) |
| `notes` | one of these | `[{ "beat": 0, "len": 1, "midi": 64, "lyric": "Jin" }]` — claps plus a synth melody |
| `lyrics` | no | One syllable per clap, shown beside the markers |
| `chords` | no | One chord per bar for the synth backing, e.g. `["C", "F", "G7", "C"]` |
| `difficulty` | no | `"Easy"`, `"Medium"` (default) or `"Hard"` |
| `id`, `subtitle` | no | Unique id (for personal bests) and a short line under the title |

Only use audio you have the rights to share on the website.
