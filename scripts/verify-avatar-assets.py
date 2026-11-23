"""Verify the three avatar assets that ship with the site.

Run after `scripts/generate-avatar-gif.py` (and in CI before publishing) so a
broken export can never reach main:

    python scripts/verify-avatar-assets.py
"""
import sys
from pathlib import Path
from PIL import Image

SIZE = 320
SOURCE = Path("src/assets/avatar.png")
WEBP = Path("public/favicon/wendell-avatar-animated.webp")
GIF = Path("public/favicon/wendell-avatar-animated.gif")


def webp_animation(path):
    """Return (frames, total_ms) by reading ANMF chunk headers.

    Pillow does not expose per-frame durations for animated WebP, so the
    container is parsed directly. Each ANMF payload starts with a 12-byte frame
    rectangle and then a 24-bit little-endian duration in milliseconds.
    """
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise SystemExit(f"{path} is not a WebP file")
    offset = 12
    frames = 0
    total = 0
    while offset + 8 <= len(data):
        tag = data[offset:offset + 4]
        size = int.from_bytes(data[offset + 4:offset + 8], "little")
        payload = data[offset + 8:offset + 8 + size]
        if tag == b"ANMF":
            if len(payload) < 15:
                raise SystemExit(f"{path} has a truncated ANMF chunk")
            frames += 1
            total += int.from_bytes(payload[12:15], "little")
        offset += 8 + size + (size & 1)
    return frames, total


def gif_animation(path):
    frames = 0
    total = 0
    with Image.open(path) as image:
        frames = getattr(image, "n_frames", 1)
        for index in range(frames):
            image.seek(index)
            total += image.info.get("duration") or 0
    return frames, total


def main():
    for path in (SOURCE, WEBP, GIF):
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"missing or empty: {path}")
        with Image.open(path) as image:
            image.verify()

    webp_frames, webp_total = webp_animation(WEBP)
    gif_frames, gif_total = gif_animation(GIF)
    if webp_frames < 2 or gif_frames < 2:
        raise SystemExit("both animated exports need at least two frames")
    if webp_frames != gif_frames or webp_total != gif_total:
        raise SystemExit(
            f"animation mismatch: webp {webp_frames}f/{webp_total}ms vs gif {gif_frames}f/{gif_total}ms"
        )

    with Image.open(WEBP) as image:
        if image.size != (SIZE, SIZE):
            raise SystemExit(f"{WEBP} must be {SIZE}x{SIZE}")
        if image.mode != "RGBA":
            raise SystemExit("lossless WebP must keep an alpha channel")
        if image.info.get("loop") != 0:
            raise SystemExit("WebP must loop forever")
        if image.getchannel("A").getextrema()[0] != 0:
            raise SystemExit("WebP lost its transparent background")

    with Image.open(GIF) as image:
        if image.size != (SIZE, SIZE):
            raise SystemExit(f"{GIF} must be {SIZE}x{SIZE}")
        if image.info.get("loop") != 0:
            raise SystemExit("GIF must loop forever")
        if "transparency" not in image.info:
            raise SystemExit("GIF has no transparent palette slot")
        image.seek(0)
        if image.convert("RGBA").getchannel("A").getextrema()[0] != 0:
            raise SystemExit("GIF lost its transparent background")

    print(f"Verified avatar assets: {webp_frames} frames, {webp_total}ms loop, transparent background")


if __name__ == "__main__":
    sys.exit(main())
