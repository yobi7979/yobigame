#!/usr/bin/env python3
"""Sprite sheet slicing: N-frame row sheet -> individual trimmed/normalized frame PNGs.

Each frame is cut to the character bbox, scaled so the TALLEST frame fills ~94% of
the canvas height (shorter frames — crouches, wings-down — keep their relative
scale), then centered on a square canvas. Guarantees consistent size/position
across frames so the game can drawImage each frame into the same square.
"""
import os
from PIL import Image


def slice_sheet(img, n, name, w, h, out_dir):
    """img: keyed RGBA sheet (N panels side by side). Returns list of saved paths,
    or None if any panel has no content."""
    W, H = img.size
    cw = W // n
    cells = [img.crop((i * cw, 0, (i + 1) * cw, H)) for i in range(n)]
    boxes = [c.getbbox() for c in cells]
    if any(b is None for b in boxes):
        return None
    ref_h = max(b[3] - b[1] for b in boxes)
    outs = []
    for i, (cell, box) in enumerate(zip(cells, boxes)):
        cell = cell.crop(box)
        scale = (w * 0.94) / ref_h
        nw, nh = max(1, round(cell.width * scale)), max(1, round(cell.height * scale))
        s2 = min(1.0, w / nw, h / nh)
        if s2 < 1.0:
            nw, nh = max(1, round(nw * s2)), max(1, round(nh * s2))
        cell = cell.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.alpha_composite(cell, ((w - nw) // 2, (h - nh) // 2))
        out = os.path.join(out_dir, f"{name}_f{i}.png")
        canvas.save(out)
        outs.append(out)
    return outs
