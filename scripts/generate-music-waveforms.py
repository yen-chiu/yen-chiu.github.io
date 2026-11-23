#!/usr/bin/env python3
"""Precompute 64 RMS envelope samples per Vesper track using FFmpeg.

Usage: python3 scripts/generate-music-waveforms.py
Requires ffmpeg on PATH and network access to Wikimedia Commons.
No audio files are committed; only 64 normalized amplitudes per track.
"""
import json
import math
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKS = ROOT / "src/data/music.ts"
OUTPUT = ROOT / "src/data/music-waveforms.json"
BINS = 64
SAMPLE_RATE = 8000

def load_sources():
    source = TRACKS.read_text(encoding="utf-8")
    entries = re.findall(r"\{\s*id:\s*'([^']+)'(.*?)\n\s*\}", source, re.S)
    return [(id_, re.search(r"url:\s*'([^']+)'", body).group(1))
            for id_, body in entries if "source: 'audio'" in body and re.search(r"url:\s*'([^']+)'", body)]

def analyze(url):
    request = urllib.request.Request(url, headers={"User-Agent": "VesperMusicWaveformGenerator/1.0 (offline build)"})
    with urllib.request.urlopen(request, timeout=45) as response:
        # ffmpeg consumes streamed audio; avoid storing licensed recordings.
        # A temporary file avoids deadlocks between simultaneous pipe readers.
        import tempfile
        with tempfile.TemporaryFile() as temp:
            while True:
                chunk = response.read(256 * 1024)
                if not chunk:
                    break
                temp.write(chunk)
            temp.seek(0)
            decoded = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
                 "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1"],
                stdin=temp, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
    import array
    samples = array.array("f")
    samples.frombytes(decoded[:len(decoded)//4*4])
    if not samples:
        raise ValueError("Empty decoded audio")
    size = len(samples)
    rms = []
    for index in range(BINS):
        start = index * size // BINS
        end = max(start + 1, (index + 1) * size // BINS)
        # Limit work on very long recordings without changing time coverage.
        step = max(1, (end - start) // 4096)
        values = samples[start:end:step]
        rms.append(math.sqrt(sum(v*v for v in values) / len(values)))
    peak = max(rms) or 1
    return [round(min(1, math.sqrt(value / peak)), 3) for value in rms]

def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required")
    result = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    failures = []
    for id_, url in load_sources():
        try:
            result[id_] = analyze(url)
            print(f"OK {id_}: {len(result[id_])} RMS bins")
        except Exception as exc:
            failures.append(id_)
            print(f"FAILED {id_}: {exc}", file=sys.stderr)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        sys.exit("Waveforms not generated for: " + ", ".join(failures))

if __name__ == "__main__":
    main()
