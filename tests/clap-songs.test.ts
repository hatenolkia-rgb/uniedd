import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { BUILT_IN_SONGS, clapNotes, clapTimes, normalizeSong, parseDifficulty, type SongFile } from "../app/games/clap/songs";

const dir = join(__dirname, "..", "public", "clap-songs");

describe("clap rhythm songs", () => {
  it("built-in songs are well formed and rated 1–5 stars", () => {
    const ids = new Set<string>();
    for (const song of BUILT_IN_SONGS) {
      expect(ids.has(song.id)).toBe(false);
      ids.add(song.id);
      expect(song.stars).toBeGreaterThanOrEqual(1);
      expect(song.stars).toBeLessThanOrEqual(5);
      const notes = clapNotes(song);
      expect(notes.length).toBeGreaterThan(5);
      for (let i = 1; i < song.notes.length; i++) expect(song.notes[i].beat).toBeGreaterThanOrEqual(song.notes[i - 1].beat);
      const last = song.notes[song.notes.length - 1];
      expect(last.beat + last.len).toBeLessThanOrEqual(song.lengthBeats + 1e-6);
      // whole number of bars (allowing a pickup / trailing rest beat)
      expect(Math.abs(song.lengthBeats / song.beatsPerBar - Math.round(song.lengthBeats / song.beatsPerBar))).toBeLessThan(0.51);
    }
  });

  it("maps difficulty words and numbers", () => {
    expect(parseDifficulty(4)).toBe(4);
    expect(parseDifficulty("Easy")).toBe(2);
    expect(parseDifficulty("nope")).toBeNull();
  });

  it("uploaded song files listed in songs.json load", () => {
    const list = JSON.parse(readFileSync(join(dir, "songs.json"), "utf8")) as { songs: string[] };
    list.songs.forEach((file, i) => {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as SongFile;
      const song = normalizeSong(raw, i);
      expect(song).not.toBeNull();
      if (!song) return;
      if (song.audio) expect(existsSync(join(dir, song.audio.replace("/clap-songs/", "")))).toBe(true);
      const times = clapTimes(song);
      const raw0 = raw.clapTimes?.[0];
      if (raw0 !== undefined) expect(Math.abs(times[0] - raw0)).toBeLessThan(0.002);
      expect(song.stars).toBeGreaterThanOrEqual(1);
    });
  });

  it("drum & rhythm-pattern songs have their own row, a set difficulty and claps on their beat grid", () => {
    const list = JSON.parse(readFileSync(join(dir, "songs.json"), "utf8")) as { songs: string[] };
    const drums = list.songs
      .map((f, i) => [JSON.parse(readFileSync(join(dir, f), "utf8")) as SongFile, i] as const)
      .filter(([raw]) => raw.row === "drums");
    expect(drums.length).toBeGreaterThanOrEqual(6);
    for (const [raw, i] of drums) {
      const song = normalizeSong(raw, i)!;
      expect(song.drums).toBe(true);
      expect(raw.difficulty).toBeGreaterThanOrEqual(1);
      expect(raw.difficulty).toBeLessThanOrEqual(5);
      // every clap sits on a 1/12-beat subdivision of the generated grid (eighths, sixteenths, triplets)
      const spb = 60 / song.bpm;
      for (const t of raw.clapTimes!) {
        const pos = ((t - raw.beatTimes![0]) / spb) * 12;
        expect(Math.abs(pos - Math.round(pos))).toBeLessThan(0.01);
      }
    }
  });

  it("prints the song table", () => {
    const list = JSON.parse(readFileSync(join(dir, "songs.json"), "utf8")) as { songs: string[] };
    const uploaded = list.songs.map((f, i) => normalizeSong(JSON.parse(readFileSync(join(dir, f), "utf8")) as SongFile, i)!);
    for (const s of [...BUILT_IN_SONGS, ...uploaded]) {
      const t = clapTimes(s);
      const span = t[t.length - 1] - t[0];
      console.log(`${"★".repeat(s.stars).padEnd(5, "☆")} ${s.title.padEnd(32)} bpm ${Math.round(s.bpm)} claps ${t.length} ${(t.length / span).toFixed(2)}/s len ${Math.round(t[t.length - 1] + 2)}s`);
    }
  });
});
