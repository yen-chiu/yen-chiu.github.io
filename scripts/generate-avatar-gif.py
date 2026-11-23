"""Build Vesper animated avatar assets from the original transparent PNG.

Both exports use the same untouched-RGBA frames. GIF is only a compatibility
asset; the lossless animated WebP is used on the site.

Run this by hand after the source portrait changes:

    python -m pip install Pillow
    python scripts/generate-avatar-gif.py

The two files under public/favicon/ are committed, so CI never needs Python:
it only needs the checked-in assets.

GIF notes: the format has indexed colour and binary transparency only. Edge
pixels therefore keep their own unpremultiplied colour and are made fully
opaque or fully transparent at a fixed cutoff — compositing them onto a
near-white matte instead would leave a pale halo around dark outlines when
the avatar sits on the dark theme.
"""
import math
from pathlib import Path
from PIL import Image

SOURCE = Path("src/assets/avatar.png")
OUTPUT_DIR = Path("public/favicon")
SIZE = 320
COUNT = 24
DURATION_MS = 120
ALPHA_CUTOFF = 128

base = Image.open(SOURCE).convert("RGBA")
base.thumbnail((SIZE - 8, SIZE - 8), Image.Resampling.LANCZOS)
frames = []
for index in range(COUNT):
    phase = 2 * math.pi * index / COUNT
    frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # Integer-only idle motion avoids continuously resampling semi-transparent
    # hair and fabric outlines, which caused the previous coloured GIF fringes.
    y = (SIZE - base.height) // 2 + round(2 * math.sin(phase))
    frame.alpha_composite(base, ((SIZE - base.width) // 2, y))
    frames.append(frame)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
webp = OUTPUT_DIR / "wendell-avatar-animated.webp"
frames[0].save(
    webp, format="WEBP", save_all=True, append_images=frames[1:],
    duration=DURATION_MS, loop=0, lossless=True, method=6, exact=True,
)

# Build one palette for the whole loop. Pixels are quantized by their own
# unpremultiplied colour, so transparent regions do not drag a background
# colour into the palette. 254 colours leaves room for the transparent slot
# plus the +1 index shift below.
palette_source = Image.new("RGB", (SIZE * COUNT, SIZE), (0, 0, 0))
for i, frame in enumerate(frames):
    palette_source.paste(frame.convert("RGB"), (i * SIZE, 0))
palette = palette_source.quantize(colors=254, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
shared_rgb = Image.new("P", (1, 1))
shared_rgb.putpalette(palette.getpalette()[:765] + [0] * (768 - len(palette.getpalette()[:765])))

indexed = []
for frame in frames:
    quantized = frame.convert("RGB").quantize(palette=shared_rgb, dither=Image.Dither.NONE)
    # Shift palette indices by one, keeping slot 0 fully transparent.
    raw = quantized.tobytes()
    # +1 keeps slot 0 transparent; clamp in case the quantizer picked a padded
    # palette entry (index 254) for a near-black pixel.
    shifted = bytes(value + 1 if value < 254 else 254 for value in raw)
    alpha = frame.getchannel("A").tobytes()
    pixels = bytes(p if a >= ALPHA_CUTOFF else 0 for p, a in zip(shifted, alpha))
    output = Image.frombytes("P", frame.size, pixels)
    colors = shared_rgb.getpalette()[:765]
    output.putpalette([0, 0, 0] + colors + [0] * (768 - 3 - len(colors)))
    output.info["transparency"] = 0
    indexed.append(output)

gif = OUTPUT_DIR / "wendell-avatar-animated.gif"
indexed[0].save(
    gif, format="GIF", save_all=True, append_images=indexed[1:],
    duration=DURATION_MS, loop=0, transparency=0, disposal=2,
    optimize=False,
)
print(f"Created {webp} (lossless RGBA) and {gif} (shared palette) from {SOURCE}")
