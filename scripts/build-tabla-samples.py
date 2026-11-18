#!/usr/bin/env python3
"""Build the compressed tabla kit used by /games/tanpura-tabla.

Run locally (not part of `npm run build`):
    python3 scripts/build-tabla-samples.py <one-shots-dir> <loops-dir>

<one-shots-dir> holds one folder per stroke (Ta, Tin, Tun, Ti, Ke, Open Ghe, ...)
with RR<n>_V<nn>_*.wav files. <loops-dir> holds <bpm>_*_<nn>_*.wav loops.

Output (public/tanpura-tabla/):
  kit.ogg / kit.m4a   one mono sprite with every selected stroke (Opus / AAC)
  kit.json            slot map: stroke -> [{start, dur, onset, vel, rr}]
  loops/*.ogg|m4a     a few real tabla loops at their native tempo
  loops.json          loop list with bpm, beats, duration and first onset

Requires numpy and ffmpeg (with libopus). Only the strokes listed in PICK are
shipped, trimmed, faded and compressed — never the raw recordings.
"""
import json, os, re, subprocess, sys
import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "tanpura-tabla")

# stroke id -> (folder, max seconds, [(rr, vel), ...]) ordered soft -> loud
PICK = {
    "na":   ("Ta",          1.5, [(1, 2), (2, 2), (1, 4), (2, 4), (1, 6), (2, 6)]),
    "tin":  ("Tin",         1.5, [(1, 3), (2, 3), (1, 4), (2, 4), (1, 8), (3, 8)]),
    "tun":  ("Tun",         1.8, [(1, 2), (2, 2), (1, 4), (2, 4), (1, 6), (2, 6)]),
    "ti":   ("Ti",          0.5, [(1, 1), (2, 1), (1, 2), (3, 2), (1, 3), (2, 3), (1, 4), (2, 4)]),
    "ke":   ("Ke",          0.45, [(1, 2), (2, 2), (1, 4), (2, 4), (1, 6), (2, 6)]),
    "ge":   ("Open Ghe",    1.9, [(1, 2), (1, 3), (1, 4), (1, 5)]),
    "gem":  ("Muted Ghe",   0.45, [(1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3)]),
    "geb":  ("Ghe Bend",    2.2, [(2, 4), (1, 6)]),
}
GAP = 0.2
FADE = 0.12


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def first_onset(x, rel=0.08):
    pk = np.max(np.abs(x)) or 1.0
    return int(np.argmax(np.abs(x) > pk * rel))


def encode(src_wav, base, channels, opus_kbps, aac_kbps):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src_wav, "-ac", str(channels), "-c:a", "libopus",
                    "-b:a", f"{opus_kbps}k", "-application", "audio", base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src_wav, "-ac", str(channels), "-ar", "48000",
                    "-c:a", "aac", "-b:a", f"{aac_kbps}k", "-movflags", "+faststart", base + ".m4a"], check=True)


def write_wav(path, x, channels=1):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(channels), "-i", "-",
                    "-c:a", "pcm_s16le", path], input=x.tobytes(), check=True)


def build_kit(src):
    clips, slots = [], {}
    for sid, (folder, maxdur, picks) in PICK.items():
        slots[sid] = []
        for rr, vel in picks:
            name = None
            for f in os.listdir(os.path.join(src, folder)):
                if re.match(rf"RR{rr}_V{vel:02d}_", f):
                    name = f
            if not name:
                raise SystemExit(f"missing {folder} RR{rr} V{vel}")
            x = load(os.path.join(src, folder, name))
            on = first_onset(x, 0.02)
            st = max(0, on - int(0.002 * SR))
            x = x[st: st + int(maxdur * SR)]
            n = len(x)
            # trim the quiet tail (-50 dB), then fade out
            pk = np.max(np.abs(x))
            loud = np.nonzero(np.abs(x) > pk * 10 ** (-50 / 20))[0]
            n = min(n, int(loud[-1]) + 1 + int(0.03 * SR))
            x = x[:n]
            f = min(int(FADE * SR), n // 3)
            x[n - f:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, f)))
            clips.append((sid, rr, vel, x, first_onset(x)))
    peak = max(np.max(np.abs(c[3])) for c in clips)
    gain = 0.89 / peak
    total = sum(len(c[3]) + int(GAP * SR) for c in clips) + int(GAP * SR)
    sprite = np.zeros(total, dtype=np.float32)
    pos = int(GAP * SR)
    for sid, rr, vel, x, on in clips:
        sprite[pos: pos + len(x)] = x * gain
        slots[sid].append({"start": round(pos / SR, 5), "dur": round(len(x) / SR, 4),
                           "onset": round((pos + on) / SR, 5), "vel": vel, "rr": rr,
                           "peak": round(float(np.max(np.abs(x)) * gain), 3)})
        pos += len(x) + int(GAP * SR)
    tmp = "/tmp/tabla-kit.wav"
    write_wav(tmp, sprite)
    encode(tmp, os.path.join(OUT, "kit"), 1, 48, 64)
    json.dump({"sampleRate": SR, "duration": round(total / SR, 4),
               # dayan (Ta/Na, Tin, Tun) is tuned near C4 +25 cents in these recordings
               "dayanSaHz": 265.5, "slots": slots},
              open(os.path.join(OUT, "kit.json"), "w"), indent=1)
    print("kit", round(total / SR, 1), "s", {k: len(v) for k, v in slots.items()})


def build_loops(src):
    os.makedirs(os.path.join(OUT, "loops"), exist_ok=True)
    out = []
    files = sorted(f for f in os.listdir(src) if f.endswith(".wav"))
    for f in files:
        m = re.match(r"(\d+)_\D+_(\d+)_", f)
        bpm, idx = int(m.group(1)), int(m.group(2))
        if idx > 3:
            continue
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(src, f), "-ac", "2", "-ar", str(SR),
                              "-f", "f32le", "-"], capture_output=True, check=True).stdout
        st = np.frombuffer(raw, dtype=np.float32).copy()
        dur = len(st) / 2 / SR
        beats = round(dur * bpm / 60)
        exact = beats * 60 / bpm
        n = int(round(exact * SR))
        st = st[: n * 2]
        if len(st) < n * 2:
            st = np.concatenate([st, np.zeros(n * 2 - len(st), dtype=np.float32)])
        mono = st.reshape(-1, 2).mean(axis=1)
        pk = np.max(np.abs(st))
        st *= 0.89 / pk
        tmp = "/tmp/tabla-loop.wav"
        write_wav(tmp, st, 2)
        lid = f"groove-{bpm}-{idx}"
        encode(tmp, os.path.join(OUT, "loops", lid), 2, 64, 96)
        out.append({"id": lid, "bpm": bpm, "beats": beats, "duration": round(exact, 5),
                    "onset": round(first_onset(mono) / SR, 5)})
    json.dump(out, open(os.path.join(OUT, "loops.json"), "w"), indent=1)
    print("loops", len(out))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_kit(sys.argv[1])
    build_loops(sys.argv[2])
