# Piano Falling Notes – song charts

Each song is one JSON file listed in `songs.json`. Only public-domain / traditional melodies.

```json
{
  "id": "twinkle-twinkle",
  "title": "Twinkle Twinkle Little Star",
  "level": 1,                 // 1 Beginner, 2 Easy, 3 Intermediate, 4 Advanced
  "bpm": 96,                  // quarter notes per minute
  "timeSig": [4, 4],
  "pickup": 0,                // pickup length in quarter beats (the last bar completes it)
  "key": "C",
  "labels": "letters",        // or "sargam"
  "credit": "Traditional melody, public domain",
  "tracks": [
    { "hand": "R", "notes": "C4 C4 G4 G4 | A4 A4 G4:2 | ..." },
    { "hand": "L", "notes": "C3:4 | F3:2 C3:2 | ..." }
  ]
}
```

Notation: tokens separated by spaces, bars by `|`. `NOTE[:beats]` (default 1 beat = a quarter
note), chords `C4+E4+G4:2`, rests `r:1`. C4 is middle C. Beats are always quarter notes, so a 3/4
bar adds up to 3, a 6/8 bar to 3 and a 3/8 bar to 1.5.

`npm test` checks that every bar adds up, both hands have the same length and all notes are on an
88-key piano, and compares the openings of the well-known songs with their standard melodies.
