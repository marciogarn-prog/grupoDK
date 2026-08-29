#!/usr/bin/env python3
"""Gera ícones PWA com fundo distinto por app (192 e 512)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"
SOURCE = ICONS / "dk-locadora-icon-source.png"

APPS = {
    "grupodk": (255, 255, 255),  # branco
    "locadora": (0, 0, 0),  # preto
    "centro": (21, 101, 192),  # azul
    "construtora": (107, 114, 128),  # cinza
}


def is_red(r: int, g: int, b: int) -> bool:
    return r >= 70 and r >= g + 25 and r >= b + 25


def is_light(r: int, g: int, b: int) -> bool:
    return min(r, g, b) >= 130 or (r + g + b) >= 420


def is_bg_candidate(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    if is_red(r, g, b) or is_light(r, g, b):
        return False
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    chroma = max(r, g, b) - min(r, g, b)
    return luma <= 95 and chroma <= 40


def extract_logo(src: Image.Image) -> Image.Image:
    w, h = src.size
    pix = src.load()
    bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        r, g, b, a = pix[x, y]
        if not bg[y][x] and is_bg_candidate(r, g, b, a):
            bg[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    for frac in (0.12, 0.18, 0.25):
        x0 = int(w * frac)
        y0 = int(h * frac)
        x1 = w - 1 - x0
        y1 = h - 1 - y0
        for x in range(x0, x1 + 1, 4):
            seed(x, y0)
            seed(x, y1)
        for y in range(y0, y1 + 1, 4):
            seed(x0, y)
            seed(x1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]:
                r, g, b, a = pix[nx, ny]
                if is_bg_candidate(r, g, b, a):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if not bg[y][x]:
                op[x, y] = pix[x, y]
    return out


def composite(logo: Image.Image, rgb: tuple[int, int, int], size: int) -> Image.Image:
    canvas = Image.new("RGBA", logo.size, rgb + (255,))
    canvas.alpha_composite(logo)
    return canvas.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"fonte não encontrada: {SOURCE}")
    logo = extract_logo(Image.open(SOURCE).convert("RGBA"))
    ICONS.mkdir(parents=True, exist_ok=True)
    for name, rgb in APPS.items():
        for size in (192, 512):
            dest = ICONS / f"icon-{name}-{size}.png"
            composite(logo, rgb, size).save(dest, "PNG", optimize=True)
            print(f"wrote {dest.name} {dest.stat().st_size} bytes")


if __name__ == "__main__":
    main()
