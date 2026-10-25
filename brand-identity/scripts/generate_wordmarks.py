#!/usr/bin/env python3
"""Generate outlined Persian wordmark SVG prototypes for Avaye Edalat brand exploration."""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = Path("/workspace/fonts/Vazirmatn-Variable.woff2")
TEXT = "آوای عدالت"


def outlined_paths(weight: float, tracking: float = 0.0, scale: float = 0.08):
    base = TTFont(str(FONT_PATH))
    font = instantiateVariableFont(deepcopy(base), {"wght": weight})
    gos = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upem = font["head"].unitsPerEm

    reshaped = arabic_reshaper.reshape(TEXT)
    display = get_display(reshaped)

    x = 0.0
    parts: list[str] = []
    for ch in display:
        name = cmap.get(ord(ch))
        if not name:
            continue
        pen = SVGPathPen(gos)
        # Flip Y (font → SVG) and scale
        tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, x * scale, 0))
        gos[name].draw(tpen)
        d = pen.getCommands()
        if d:
            parts.append(d)
        adv, _ = hmtx[name]
        x += adv + tracking * upem
    width = x * scale
    # Baseline sits at 0; typical Vazirmatn descenders ~ -0.3em, ascenders ~0.9em
    height = upem * scale * 1.25
    baseline = upem * scale * 0.85
    shifted = []
    for d in parts:
        # shift down so glyphs sit inside viewBox
        shifted.append(d)  # we'll translate group instead
    return {
        "paths": parts,
        "width": width,
        "height": height,
        "baseline": baseline,
        "upem": upem,
        "scale": scale,
    }


def svg_wordmark(
    out: Path,
    *,
    weight: float,
    tracking: float,
    fill: str,
    label: str,
    extras: str = "",
    pad_x: float = 40,
    pad_y: float = 48,
    bg: str | None = None,
    scale: float = 0.09,
):
    data = outlined_paths(weight, tracking=tracking, scale=scale)
    w = data["width"] + pad_x * 2
    h = data["height"] + pad_y * 2
    ty = pad_y + data["baseline"]
    paths = "\n    ".join(f'<path d="{d}"/>' for d in data["paths"])
    bg_el = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" role="img" aria-label="{TEXT}">
  <!-- Direction: {label} | Weight {weight:.0f} | Tracking {tracking:.3f} | Outlined from Vazirmatn (prototype base for custom lettering) -->
  <title>{TEXT} — {label}</title>
  {bg_el}
  {extras}
  <g fill="{fill}" transform="translate({pad_x:.1f}, {ty:.1f})">
    {paths}
  </g>
</svg>
"""
    out.write_text(content, encoding="utf-8")
    print(f"wrote {out} ({w:.0f}×{h:.0f})")


def main():
    # A — Editorial: heavy display weight, tight tracking
    svg_wordmark(
        ROOT / "A-editorial" / "wordmark.svg",
        weight=850,
        tracking=-0.02,
        fill="#12151C",
        label="A Experimental Editorial Authority",
        scale=0.1,
    )
    # B — Archive: medium weight, open tracking
    svg_wordmark(
        ROOT / "B-archive" / "wordmark.svg",
        weight=500,
        tracking=0.08,
        fill="#1C2B28",
        label="B Contemporary Legal Archive",
        scale=0.09,
    )
    # C — Geometric: bold, slight open tracking for modular feel
    svg_wordmark(
        ROOT / "C-geometric" / "wordmark.svg",
        weight=700,
        tracking=0.04,
        fill="#0E1A2B",
        label="C Geometric Intelligence",
        scale=0.095,
    )

    # Also export white-on-transparent for dark lockups
    for folder, weight, tracking, scale in [
        ("A-editorial", 850, -0.02, 0.1),
        ("B-archive", 500, 0.08, 0.09),
        ("C-geometric", 700, 0.04, 0.095),
    ]:
        svg_wordmark(
            ROOT / folder / "wordmark-inverse.svg",
            weight=weight,
            tracking=tracking,
            fill="#FFFFFF",
            label=f"{folder} inverse",
            scale=scale,
        )


if __name__ == "__main__":
    main()
