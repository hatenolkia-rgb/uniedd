"""Rebuild the Jam metronome voice-count samples (public/metronome/voice/*/*.mp3).

Voices are synthesised offline with Kokoro-82M (Apache-2.0 weights) via kokoro-onnx:
  pip install kokoro-onnx soundfile scipy
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  python scripts/build-metronome-voice.py      # writes out/<voice>/<word>.wav (48 kHz)
  for each wav: ffmpeg -i out/V/W.wav -c:a libmp3lame -q:a 2 public/metronome/voice/V/W.mp3

Processing per word: 80 Hz high-pass, 14 kHz low-pass, silence trimmed to 8 ms before
the first sound, 3 ms / 25 ms raised-cosine fades (no clicks), active-speech RMS
matched to -16 dBFS, peak capped at -1 dBFS. The browser re-measures each word's
start and perceived onset after decoding (engine.ts analyseVoice), so MP3 padding
never shifts the timing.
"""
import json, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
WORDS = {  # id: (text, speed)
 '1':('One!',1.1),'2':('Two!',1.1),'3':('Three!',1.1),'4':('Four!',1.1),
 '5':('Five!',1.1),'6':('Six!',1.1),'7':('Seven!',1.15),
 'and':('and',1.25),'e':('E.',1.1),'a':('a',1.25),'trip':('trip',1.25),'let':('let',1.25),
}
VOICES = {'female':'af_heart','male':'am_fenrir'}
OVERRIDE = {'male': {'e':('E.',1.0),'a':('a',1.0),'6':('six',1.1),'and':('and',1.1)}}
OUT = os.environ.get('OUT','out'); SR_OUT = 48000
def env(x, sr, win=0.005):
    n = max(1, int(sr*win)); return np.sqrt(np.convolve(x**2, np.ones(n)/n, mode='same'))
manifest = {}
for vname, vid in VOICES.items():
    os.makedirs(f'{OUT}/{vname}', exist_ok=True); manifest[vname] = {}
    for wid,(text,speed) in {**WORDS, **OVERRIDE.get(vname,{})}.items():
        s, sr = k.create(text, voice=vid, speed=speed, lang='en-us')
        x = np.asarray(s, dtype=np.float64)
        x = resample_poly(x, SR_OUT, sr); sr = SR_OUT
        x = sosfiltfilt(butter(4, 80, 'hp', fs=sr, output='sos'), x)   # rumble/DC
        x = sosfiltfilt(butter(4, 14000, 'lp', fs=sr, output='sos'), x) # keep it clean of hiss
        e = env(x, sr); pk = e.max()
        above = np.where(e > pk*10**(-40/20))[0]
        start = max(0, above[0] - int(0.008*sr)); end = min(len(x), above[-1] + int(0.04*sr))
        x = x[start:end]
        fi = int(0.003*sr); fo = int(0.025*sr)
        x[:fi] *= 0.5-0.5*np.cos(np.linspace(0, np.pi, fi))
        x[-fo:] *= 0.5+0.5*np.cos(np.linspace(0, np.pi, fo))
        # loudness match: active-speech RMS to -16 dBFS, then peak-cap at -1 dBFS
        e = env(x, sr, 0.02); act = x[e > e.max()*0.1]
        x *= 10**(-16/20) / np.sqrt(np.mean(act**2))
        p = np.abs(x).max(); cap = 10**(-1/20)
        if p > cap: x *= cap/p
        # perceptual onset (P-centre approx): first time 20ms envelope reaches 50% of its max
        e2 = env(x, sr, 0.02); onset = int(np.argmax(e2 >= 0.5*e2.max()))
        sf.write(f'{OUT}/{vname}/{wid}.wav', x.astype(np.float32), sr, subtype='PCM_16')
        manifest[vname][wid] = {'onset': round(onset/sr, 4), 'dur': round(len(x)/sr, 4)}
        print(vname, wid, manifest[vname][wid])
json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=1)
