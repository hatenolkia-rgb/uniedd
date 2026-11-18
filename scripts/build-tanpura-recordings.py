#!/usr/bin/env python3
"""Build the recorded-tanpura loops used by /games/tanpura-tabla (Recorded sound).

Run locally (not part of `npm run build`):
    python3 scripts/build-tanpura-recordings.py <pa.mp3> <ma.mp3> <ni.mp3>

Each input is a real (non-repeating) recording of a 4-string tanpura in C with
the first string on Pa, Ma or Ni. For every one of the 12 keys this script:
  1. measures the recording's real Sa pitch from its harmonic spectrum,
  2. pitch-shifts it to the exact equal-tempered Sa (A4 = 440 Hz) with
     Rubber Band (tempo and pluck speed unchanged),
  3. trims the fades and picks a long stable loop whose seam lines up with the
     pluck cycle, and
  4. writes Opus (.ogg) and AAC (.m4a) files that contain the loop plus a
     crossfade tail, so the browser can play it seamlessly with two
     overlapping voices and correlation-aware equal-power crossfades.

Outputs public/tanpura-rec/<tuning>-<key>.ogg|m4a and manifest.json.
Requires numpy and ffmpeg built with librubberband and libopus.
"""
import json, math, os, subprocess, sys
import numpy as np

SR = 48000
XF = 2.0  # crossfade seconds
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "tanpura-rec")
KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# semitones from the C3 recording for each key: keeps shifts within -5..+6
SHIFT = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]
C3 = 440 * 2 ** ((48 - 69) / 12)
TARGET_RMS_DB = -21.0


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def run_filter(x, af):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-af", af,
                        "-f", "f32le", "-"], input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).copy()


def spectrum(mono):
    n = 1 << int(math.ceil(math.log2(len(mono))))
    S = np.abs(np.fft.rfft(mono * np.hanning(len(mono)), n))
    return S, SR / n


def peak_near(S, df, f, tol_cents=60):
    lo = int(f * 2 ** (-tol_cents / 1200) / df)
    hi = int(f * 2 ** (tol_cents / 1200) / df) + 1
    i = lo + int(np.argmax(S[lo:hi]))
    a, b, c = np.log(S[i - 1:i + 2] + 1e-12)
    d = 0.5 * (a - c) / (a - 2 * b + c)
    return (i + d) * df, S[i]


def sa_pitch(x, sa_guess):
    """Consensus Sa: the frequency whose harmonics (Sa strings, k = 1..12) line up best in the spectrum.

    A real tanpura's Sa strings differ from each other by a few cents, so this is
    a weighted centre, not any single string."""
    mono = x.mean(axis=1)
    S, df = spectrum(mono[: SR * 16])
    # smooth over ~0.6 Hz so slightly detuned strings merge into one hill
    k = max(1, int(0.6 / df))
    ker = np.exp(-0.5 * (np.arange(-3 * k, 3 * k + 1) / k) ** 2)
    hi = int(sa_guess * 13 / df)
    Sm = np.convolve(S[:hi], ker / ker.sum(), mode="same")
    L = np.log(Sm + 1e-9)
    best = None
    cents = np.arange(-50, 50.01, 0.1)
    for c in cents:
        f = sa_guess * 2 ** (c / 1200)
        idx = [h * f / df for h in range(1, 13)]
        sc = sum(np.interp(i, np.arange(len(L)), L) for i in idx)
        if best is None or sc > best[0]:
            best = (sc, f, c)
    return best[1], round(best[2], 1)


def env_db(mono, hop):
    n = len(mono) // hop
    e = np.sqrt(np.mean(mono[: n * hop].reshape(n, hop) ** 2, axis=1))
    return 20 * np.log10(e + 1e-9)


def stable_region(x):
    e = env_db(x.mean(axis=1), SR // 10)
    med = np.median(e)
    k = 30  # smooth over a pluck cycle so the gaps between plucks don't count as fades
    sm = np.convolve(e, np.ones(k) / k, mode="same")
    ok = np.nonzero(sm > med - 3)[0]
    return (ok[0] + k // 2) / 10 + 0.3, (ok[-1] - k // 2) / 10 - 0.3


def find_loop(x, s0, s1):
    """Longest loop whose seam matches the pluck pattern; returns (start, L) in samples."""
    mono = x.mean(axis=1)
    hop = SR // 100
    e = env_db(mono, hop)
    st = int(s0 * 100)
    W = int((XF + 1.0) * 100)
    best = None
    lmin = int(12 * 100)
    lmax = int((s1 - s0 - XF) * 100)
    a = e[st: st + W]
    a = (a - a.mean()) / (a.std() + 1e-9)
    for L in range(lmin, lmax):
        b = e[st + L: st + L + W]
        if len(b) < W:
            break
        b = (b - b.mean()) / (b.std() + 1e-9)
        c = float(np.mean(a * b))
        score = c + 0.02 * (L / 100)  # prefer longer loops when the match is close
        if best is None or score > best[0]:
            best = (score, L, c)
    _, L, c = best
    s = st * hop
    Ls = L * hop
    seg = mono[s: s + int(XF * SR)]
    r = int(0.012 * SR)
    bestk, bestv = 0, -2
    for k in range(-r, r + 1, 4):
        t = mono[s + Ls + k: s + Ls + k + len(seg)]
        v = float(np.dot(seg, t) / (np.linalg.norm(seg) * np.linalg.norm(t) + 1e-9))
        if v > bestv:
            bestv, bestk = v, k
    return s, Ls + bestk, c, bestv


def xfade_curves(rho, n):
    t = np.linspace(0, 1, n)
    a = np.sin(t * np.pi / 2)
    b = np.cos(t * np.pi / 2)
    g = np.sqrt(1 + 2 * rho * a * b)
    return a / g, b / g


def seam_check(seg, L, rho):
    """Simulate the browser's two-voice crossfade; compare 100 ms RMS against the sources."""
    n = int(XF * SR)
    fin, fout = xfade_curves(rho, n)
    head = seg[:n].mean(axis=1)
    tail = seg[L: L + n].mean(axis=1)
    mix = head * fin + tail * fout
    w = SR // 10
    out = []
    for i in range(0, n - w, w):
        r = lambda v: 20 * math.log10(math.sqrt(float(np.mean(v[i:i + w] ** 2))) + 1e-9)
        lo = min(r(head), r(tail))
        hi = max(r(head), r(tail))
        m = r(mix)
        out.append((m - lo, m - hi))
    return min(o[0] for o in out), max(o[1] for o in out)


def onsets(mono, L):
    hop = SR // 200
    e = env_db(mono[:L], hop)
    d = np.diff(e)
    k = 6
    cand = []
    for i in range(k, len(d) - k):
        if d[i] > 1.2 and d[i] == max(d[i - k: i + k]):
            if not cand or i - cand[-1] > 0.35 * 200:
                cand.append(i)
    return [round(i / 200, 3) for i in cand]


def encode(x, base):
    tmp = "/tmp/tanpura-rec.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-c:a", "pcm_s16le", tmp], input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libopus", "-b:a", "64k",
                    "-application", "audio", base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "aac", "-b:a", "96k",
                    "-movflags", "+faststart", base + ".m4a"], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {"crossfade": XF, "sampleRate": SR, "files": {}}
    report = []
    only = os.environ.get("ONLY_KEYS")
    for tuning, path in zip(["P", "m", "N"], sys.argv[1:4]):
        src = decode(path)
        src_sa, parts = sa_pitch(src[int(2 * SR):], C3)
        s0, s1 = stable_region(src)
        print(f"{tuning}: source Sa {src_sa:.3f} Hz ({1200 * math.log2(src_sa / C3):+.1f} c vs C3) ; stable {s0:.1f}-{s1:.1f}s", flush=True)
        seg_src = src[int(s0 * SR): int(s1 * SR)]
        for ki, key in enumerate(KEYS):
            if only and key not in only.split(","):
                continue
            target = C3 * 2 ** (SHIFT[ki] / 12)
            ratio = target / src_sa
            pad = int(0.5 * SR)
            padded = np.concatenate([np.zeros((pad, 2), np.float32), seg_src, np.zeros((pad, 2), np.float32)])
            y = run_filter(padded, f"rubberband=pitch={ratio:.8f}:pitchq=quality:channels=together:transients=mixed")
            m_src = env_db(padded.mean(axis=1), SR // 200)
            m_out = env_db(y.mean(axis=1), SR // 200)
            n = min(len(m_src), len(m_out))
            lagbest = max(range(-40, 41), key=lambda l: float(np.dot(m_src[100:n - 100], m_out[100 + l:n - 100 + l])))
            off = pad + lagbest * (SR // 200)
            y = y[off: off + len(seg_src)]
            got, _ = sa_pitch(y[int(1 * SR):], target)
            start, L, env_corr, wave_corr = find_loop(y, 0.2, len(y) / SR)
            seg = y[start: start + L + int(XF * SR)].copy()
            head = seg[: int(XF * SR)].mean(axis=1)
            tail = seg[L: L + int(XF * SR)].mean(axis=1)
            rho = float(np.dot(head, tail) / (np.linalg.norm(head) * np.linalg.norm(tail) + 1e-9))
            rho = max(0.0, min(0.9, rho))
            lo, hi = seam_check(seg, L, rho)
            rms = 20 * math.log10(math.sqrt(float(np.mean(seg ** 2))) + 1e-9)
            seg = seg * 10 ** ((TARGET_RMS_DB - rms) / 20)
            peak = float(np.max(np.abs(seg)))
            if peak > 0.97:
                seg *= 0.97 / peak
            f = int(0.005 * SR)
            seg[:f] *= np.linspace(0, 1, f)[:, None]
            seg[-f:] *= np.linspace(1, 0, f)[:, None]
            fid = f"{tuning}-{key.replace('#', 's')}"
            encode(seg, os.path.join(OUT, fid))
            manifest["files"].setdefault(tuning, {})[key] = {
                "id": fid, "saHz": round(target, 4), "loop": round(L / SR, 6), "duration": round(len(seg) / SR, 6),
                "rho": round(rho, 3), "onsets": onsets(seg.mean(axis=1), L), "shift": SHIFT[ki],
            }
            err = 1200 * math.log2(got / target)
            report.append((fid, SHIFT[ki], round(target, 3), round(got, 3), round(err, 2), round(L / SR, 2), round(env_corr, 2), round(wave_corr, 2), round(rho, 2), round(lo, 2), round(hi, 2)))
            print("  ", report[-1], flush=True)
    if not only:
        json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
    json.dump(report, open("/tmp/tanpura-rec-report.json", "w"))


if __name__ == "__main__":
    main()
