#!/usr/bin/env python3
"""Run with Python 3 and Pillow. The original icon.png is the source artwork."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = (47, 74, 57)
OLIVE = (158, 170, 126)
CREAM = (251, 241, 223)
GOLD = (237, 198, 119)


def leaf_artwork(source):
    result = Image.new("RGBA", source.size)
    pixels = []
    for red, green, blue, opacity in source.get_flattened_data():
        if red - green <= -5 or opacity == 0:
            pixels.append((0, 0, 0, 0))
            continue
        color = (red, green, blue)
        candidates = []
        for foreground in (CREAM, GOLD):
            direction = tuple(f - b for f, b in zip(foreground, OLIVE))
            coverage = max(0, min(1, sum((c - b) * d for c, b, d in zip(color, OLIVE, direction)) / sum(d * d for d in direction)))
            residual = sum((c - (b + coverage * d)) ** 2 for c, b, d in zip(color, OLIVE, direction))
            candidates.append((residual, coverage, foreground))
        _, coverage, foreground = min(candidates)
        # Unmatte edge pixels before compositing, so the old olive cannot form a halo.
        rgb = color if coverage >= 0.98 else foreground
        pixels.append((*rgb, round(opacity * coverage)))
    result.putdata(pixels)
    # The source also has an antialiased tile edge. Keep only the leaf area.
    bounds = (round(source.width * 0.20), round(source.height * 0.10), round(source.width * 0.82), round(source.height * 0.91))
    isolated = Image.new("RGBA", source.size)
    isolated.paste(result.crop(bounds), bounds)
    return isolated


def export_icons():
    source = Image.open(ROOT / "assets/images/icon.png").convert("RGBA")
    leaf = leaf_artwork(source)
    adaptive = Image.new("RGBA", (1024, 1024))
    adaptive.alpha_composite(leaf.resize((760, 760), Image.Resampling.LANCZOS), (132, 132))
    adaptive.save(ROOT / "assets/images/app-icons/adaptive-foreground.png")
    tile = Image.new("RGBA", source.size, BACKGROUND)
    tile.putalpha(source.getchannel("A"))
    tile = Image.alpha_composite(tile, leaf)
    square = Image.new("RGBA", source.size, BACKGROUND)
    square = Image.alpha_composite(square, leaf)
    square.resize((1024, 1024), Image.Resampling.LANCZOS).convert("RGB").save(ROOT / "assets/images/app-icons/app-icon.png")
    square.resize((512, 512), Image.Resampling.LANCZOS).convert("RGB").save(ROOT / "assets/store/google-play/icon-512.png")
    for name, canvas_color in (("splash-icon.png", (250, 248, 244)), ("splash-icon-dark.png", (28, 25, 22))):
        canvas = Image.new("RGBA", (1024, 1024), canvas_color)
        small = tile.resize((512, 512), Image.Resampling.LANCZOS)
        canvas.alpha_composite(small, (256, 256))
        canvas.convert("RGB").save(ROOT / "assets/images/app-icons" / name)


if __name__ == "__main__":
    export_icons()
