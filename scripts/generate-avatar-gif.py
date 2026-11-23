"""Build Vesper animated avatar assets from the original transparent PNG.

Both exports use the same untouched-RGBA frames. GIF is only a compatibility
asset; the lossless animated WebP is used on the site.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

SOURCE = Path("src/assets/avatar.png")
OUTPUT_DIR = Path("public/favicon")
SIZE = 320
COUNT = 24
DURATION_MS = 120

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

# GIF supports only indexed colours and binary transparency. Build a shared
# palette on a neutral matte; reserve index 0 for transparent pixels and never
# introduce per-frame colour dithering.
matte = (245, 245, 248)
def flatten(image):
    rgb = Image.new("RGB", image.size, matte)
    rgb.paste(image, mask=image.getchannel("A"))
    return rgb

palette_source = Image.new("RGB", (SIZE * COUNT, SIZE), matte)
for i, frame in enumerate(frames):
    palette_source.paste(flatten(frame), (i * SIZE, 0))
# Reserve the top index: every pixel is shifted by one so slot 0 can stay
# transparent, and a 256-colour palette would push index 255 out of range.
palette = palette_source.quantize(colors=254, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
shared_rgb = Image.new("P", (1, 1))
shared_rgb.putpalette(palette.getpalette()[:765] + [0] * (768 - len(palette.getpalette()[:765])))

indexed = []
for frame in frames:
    quantized = flatten(frame).quantize(palette=shared_rgb, dither=Image.Dither.NONE)
    # Shift palette indices by one, keeping slot 0 fully transparent.
    raw = quantized.tobytes()
    # +1 keeps slot 0 transparent; clamp in case the quantizer picked a padded
    # palette entry (index 254) for a near-black pixel.
    shifted = bytes(value + 1 if value < 254 else 254 for value in raw)
    alpha = frame.getchannel("A").tobytes()
    pixels = bytes(p if a >= 128 else 0 for p, a in zip(shifted, alpha))
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
