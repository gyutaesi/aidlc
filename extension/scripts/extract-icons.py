#!/usr/bin/env python3
"""Extract the largest squirrel circle from moaring_icon.jpeg.

Strategy:
1. Find connected components of cream-colored pixels
2. Pick the largest one (= biggest squirrel circle)
3. Apply circular alpha mask using detected center + radius
4. Resize to all required sizes
"""
from pathlib import Path
from PIL import Image, ImageDraw
import sys

ROOT = Path(__file__).parent.parent
SOURCE = ROOT / "public" / "icons" / "moaring_icon.jpeg"
OUTPUT_DIR = ROOT / "public" / "icons"

SIZES = [128, 48, 32, 16]

# Cream/beige color range — circles are #f0d9b5 ish
# We want pixels that are warm/light but not pure white (text)
CREAM_R_MIN, CREAM_R_MAX = 200, 250
CREAM_G_MIN, CREAM_G_MAX = 180, 230
CREAM_B_MIN, CREAM_B_MAX = 140, 200


def is_cream(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return (
        CREAM_R_MIN <= r <= CREAM_R_MAX
        and CREAM_G_MIN <= g <= CREAM_G_MAX
        and CREAM_B_MIN <= b <= CREAM_B_MAX
    )


def find_largest_cream_blob(img: Image.Image) -> tuple[int, int, int]:
    """Find the largest connected cream-colored region.

    Returns (cx, cy, radius).
    """
    rgb = img.convert("RGB")
    pixels = rgb.load()
    w, h = rgb.size

    # Build cream mask
    cream = [[is_cream(pixels[x, y]) for x in range(w)] for y in range(h)]

    # Flood-fill to find connected components, return largest
    visited = [[False] * w for _ in range(h)]
    best_pixels: list[tuple[int, int]] = []

    sys.setrecursionlimit(10_000_000)

    for sy in range(h):
        for sx in range(w):
            if not cream[sy][sx] or visited[sy][sx]:
                continue
            # BFS (iterative) to avoid recursion depth limits
            stack = [(sx, sy)]
            current: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                if x < 0 or y < 0 or x >= w or y >= h:
                    continue
                if visited[y][x] or not cream[y][x]:
                    continue
                visited[y][x] = True
                current.append((x, y))
                stack.append((x + 1, y))
                stack.append((x - 1, y))
                stack.append((x, y + 1))
                stack.append((x, y - 1))
            if len(current) > len(best_pixels):
                best_pixels = current

    if not best_pixels:
        raise RuntimeError("No cream region found")

    xs = [p[0] for p in best_pixels]
    ys = [p[1] for p in best_pixels]
    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)
    cx = (left + right) // 2
    cy = (top + bottom) // 2
    # Take half of the larger dimension so the entire circle fits
    radius = max((right - left) // 2, (bottom - top) // 2)
    # Shrink radius slightly to cut off any dark edge pixels
    radius = int(radius * 0.95)
    print(f"  Largest blob: {len(best_pixels)} pixels")
    print(f"  Bbox: left={left}, right={right}, top={top}, bottom={bottom}")
    print(f"  Center: ({cx}, {cy}), Radius: {radius}")
    return cx, cy, radius


def crop_and_mask_circle(img: Image.Image, cx: int, cy: int, radius: int) -> Image.Image:
    size = radius * 2
    box = (cx - radius, cy - radius, cx + radius, cy + radius)
    cropped = img.crop(box).convert("RGBA")

    # Anti-aliased circle mask: render at 4x resolution then downscale
    upscale = 4
    mask_large = Image.new("L", (size * upscale, size * upscale), 0)
    draw = ImageDraw.Draw(mask_large)
    draw.ellipse((0, 0, size * upscale - 1, size * upscale - 1), fill=255)
    mask = mask_large.resize((size, size), Image.LANCZOS)

    cropped.putalpha(mask)
    return cropped


def main() -> None:
    img = Image.open(SOURCE)
    print(f"Source: {img.size}")

    cx, cy, radius = find_largest_cream_blob(img)
    masked = crop_and_mask_circle(img, cx, cy, radius)
    print(f"Cropped + masked: {masked.size}")

    raw_path = OUTPUT_DIR / "_cropped_raw.png"
    masked.save(raw_path, "PNG")
    print(f"Saved: {raw_path}")

    for size in SIZES:
        resized = masked.resize((size, size), Image.LANCZOS)
        out_path = OUTPUT_DIR / f"icon{size}.png"
        resized.save(out_path, "PNG", optimize=True)
        print(f"  → {out_path.name} ({size}x{size})")


if __name__ == "__main__":
    main()
