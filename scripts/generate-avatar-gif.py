from PIL import Image, ImageDraw
import math
from pathlib import Path

# Animated directly from the original Vesper PNG; no character regeneration.
source = Path('src/assets/avatar.png')
output = Path('public/favicon/wendell-avatar-animated.gif')
size, count, duration = 320, 32, 110
portrait = Image.open(source).convert('RGBA')
portrait.thumbnail((size - 50, size - 50), Image.Resampling.LANCZOS)

frames = []
for i in range(count):
    phase = 2 * math.pi * i / count
    # Restrained one-pixel breathing and idle float preserve the original face.
    scale = 1 + .008 * math.sin(phase)
    width, height = round(portrait.width * scale), round(portrait.height * scale)
    img = portrait.resize((width, height), Image.Resampling.LANCZOS)
    dy = round(2 * math.sin(phase - .5))
    frame = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    frame.alpha_composite(img, ((size - width) // 2, (size - height) // 2 + dy))

    # The silver sparkle stays outside the head and fades as the loop turns.
    sparkle = max(0, math.sin(phase + 1.2))
    if sparkle > .08:
        cx, cy = size - 40, 61
        radius = 4 + 3 * sparkle
        alpha = int(95 * sparkle)
        draw = ImageDraw.Draw(frame)
        draw.line((cx-radius, cy, cx+radius, cy), fill=(200, 216, 247, alpha), width=1)
        draw.line((cx, cy-radius, cx, cy+radius), fill=(200, 216, 247, alpha), width=1)
    frames.append(frame)

output.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(output, save_all=True, append_images=frames[1:],
               duration=duration, loop=0, disposal=2, optimize=False)
print(f'Generated {output} from {source}: {len(frames)} frames / {duration} ms')
