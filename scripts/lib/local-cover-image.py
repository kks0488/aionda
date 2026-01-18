#!/usr/bin/env python3
import argparse
import hashlib
import math
import random

from PIL import Image, ImageDraw, ImageFilter


def _seed_from_slug(slug: str) -> int:
    digest = hashlib.md5(slug.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def _lerp(a: int, b: int, t: float) -> int:
    return int(round(a * (1.0 - t) + b * t))


def _lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (_lerp(c1[0], c2[0], t), _lerp(c1[1], c2[1], t), _lerp(c1[2], c2[2], t))


def _pick_palette(seed: int) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    palette = [
        (6, 10, 25),    # near-black navy
        (15, 23, 42),   # slate-900
        (12, 74, 110),  # deep blue
        (2, 132, 199),  # cyan
        (16, 185, 129), # emerald
        (99, 102, 241), # indigo
        (168, 85, 247), # purple
        (244, 63, 94),  # rose
        (245, 158, 11), # amber
    ]
    rng = random.Random(seed)
    c1 = rng.choice(palette)
    c2 = rng.choice(palette)
    while c2 == c1:
        c2 = rng.choice(palette)
    accent = rng.choice(palette)
    return c1, c2, accent


def _make_gradient(w: int, h: int, c1: tuple[int, int, int], c2: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (w, h), c1)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1) if h > 1 else 0.0
        col = _lerp_rgb(c1, c2, t)
        draw.line((0, y, w, y), fill=col)
    return img


def _add_vignette(img: Image.Image, strength: float = 0.55) -> Image.Image:
    w, h = img.size
    vignette = Image.new("L", (w, h), 0)
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = w / 2, h / 2
    max_r = math.hypot(cx, cy)
    steps = 40
    for i in range(steps):
        t = i / (steps - 1) if steps > 1 else 1.0
        r = max_r * t
        alpha = int(255 * (t ** 2) * strength)
        vdraw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=alpha, width=6)
    vignette = vignette.filter(ImageFilter.GaussianBlur(18))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(dark, img, vignette)


def _add_shapes(img: Image.Image, seed: int, accent: tuple[int, int, int]) -> Image.Image:
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    rng = random.Random(seed)

    for _ in range(22):
        x = rng.uniform(-0.1, 1.1) * w
        y = rng.uniform(-0.1, 1.1) * h
        r = rng.uniform(80, 220)
        base = accent if rng.random() < 0.6 else (255, 255, 255)
        alpha = int(rng.uniform(18, 55))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(base[0], base[1], base[2], alpha))

    for _ in range(16):
        x1 = rng.uniform(0, w)
        y1 = rng.uniform(0, h)
        x2 = rng.uniform(0, w)
        y2 = rng.uniform(0, h)
        width = int(rng.uniform(2, 6))
        alpha = int(rng.uniform(10, 26))
        col = (accent[0], accent[1], accent[2], alpha)
        draw.line((x1, y1, x2, y2), fill=col, width=width)

    layer = layer.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def _add_grain(img: Image.Image, seed: int) -> Image.Image:
    w, h = img.size
    rng = random.Random(seed + 1337)
    noise = Image.new("L", (w, h))
    pixels = noise.load()
    for y in range(h):
        for x in range(w):
            pixels[x, y] = rng.randint(0, 255)
    noise = noise.filter(ImageFilter.GaussianBlur(1.2))
    noise = noise.point(lambda v: int(v * 0.18))
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, noise_rgb, 0.18)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=576)
    args = parser.parse_args()

    seed = _seed_from_slug(args.slug)
    c1, c2, accent = _pick_palette(seed)

    img = _make_gradient(args.width, args.height, c1, c2)
    img = _add_shapes(img, seed, accent)
    img = _add_grain(img, seed)
    img = _add_vignette(img)

    img.save(args.output, format="PNG", optimize=True)


if __name__ == "__main__":
    main()

