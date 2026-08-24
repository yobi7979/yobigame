#!/usr/bin/env python3
"""QC tooling for game assets.
Usage:
  python qc.py sheet    -> QC_sheet.png  (all assets on game-like bg, grid)
  python qc.py mockup   -> mockup.png    (game scene at REAL in-game sprite sizes)
  python qc.py colors   -> top-5 colors per sprite (palette check)
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BG = (10, 10, 18)          # #0a0a12
GRID = (30, 34, 54)
GOLD = (255, 209, 102)
manifest = json.load(open(os.path.join(HERE, "manifest.json"), encoding="utf-8"))


def load(name, w, h):
    p = os.path.join(HERE, name + ".png")
    if not os.path.exists(p):
        return None
    return Image.open(p).convert("RGBA")


def sheet():
    cols, cell, label = 5, 288, 34
    rows = (len(manifest) + cols - 1) // cols
    canvas = Image.new("RGBA", (cols * cell, rows * (cell + label)), BG)
    d = ImageDraw.Draw(canvas)
    for i, a in enumerate(manifest):
        r, c = divmod(i, cols)
        x0, y0 = c * cell, r * (cell + label)
        # grid
        for gx in range(x0, x0 + cell, 32):
            d.line([(gx, y0), (gx, y0 + cell)], fill=GRID, width=1)
        for gy in range(y0, y0 + cell, 32):
            d.line([(x0, gy), (x0 + cell, gy)], fill=GRID, width=1)
        img = load(a["name"], a["w"], a["h"])
        if img is None:
            d.text((x0 + 10, y0 + cell // 2), a["name"] + " (MISSING)", fill=(255, 80, 80))
        else:
            canvas.alpha_composite(img, (x0 + (cell - img.width) // 2, y0 + (cell - img.height) // 2))
        d.text((x0 + 8, y0 + cell + 6), f"{a['name']} {a['w']}x{a['h']}", fill=GOLD)
    out = os.path.join(HERE, "QC_sheet.png")
    canvas.convert("RGB").save(out, quality=92)
    print(out)


def mockup():
    """Player + enemies at real in-game drawn sizes, with HP bars and XP orbs."""
    W, H = 1024, 768
    canvas = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    for gx in range(0, W, 32):
        d.line([(gx, 0), (gx, H)], fill=GRID, width=1)
    for gy in range(0, H, 32):
        d.line([(0, gy), (W, gy)], fill=GRID, width=1)

    def place(name, x, y, draw_size):
        img = load(name, 0, 0)
        if img is None:
            return
        img = img.resize((draw_size, draw_size), Image.LANCZOS)
        canvas.alpha_composite(img, (x - draw_size // 2, y - draw_size // 2))

    def hpbar(x, y, w, frac, color):
        d.rectangle([x - w // 2, y - w // 2, x + w // 2, y - w // 2 + 6], fill=(40, 40, 60))
        d.rectangle([x - w // 2, y - w // 2, x - w // 2 + int(w * frac), y - w // 2 + 6], fill=color)

    # player r=14 -> 28px
    place("player", W // 2, H // 2, 28)
    d.ellipse([W // 2 - 18, H // 2 - 18, W // 2 + 18, H // 2 + 18], outline=GOLD, width=2)
    hpbar(W // 2, H // 2 - 34, 60, 0.8, (74, 222, 128))
    # enemies r~12-20 -> 24-40px
    specs = [
        ("enemy_basic", 180, 180, 34, (230, 57, 70)),
        ("enemy_fast", 380, 140, 28, (122, 229, 130)),
        ("enemy_tanky", 700, 180, 44, (177, 151, 252)),
        ("enemy_ranged", 850, 320, 34, (77, 171, 247)),
        ("enemy_miniboss", 200, 520, 56, (74, 222, 128)),
        ("enemy_boss", 780, 560, 96, (255, 46, 99)),
    ]
    for name, x, y, s, c in specs:
        place(name, x, y, s)
        hpbar(x, y - s // 2 - 12, min(70, s + 10), 0.6, c)
    # xp orbs r=5 -> 10px
    orb = load("xp_orb", 0, 0)
    if orb:
        orb = orb.resize((10, 10), Image.LANCZOS)
        for ox, oy in [(500, 300), (520, 340), (470, 350), (540, 280), (490, 420)]:
            canvas.alpha_composite(orb, (ox - 5, oy - 5))
    # skill icons row (game draws 30px)
    icons = [m["name"] for m in manifest if m["name"].startswith("icon_")][:10]
    for i, n in enumerate(icons):
        place(n, 60 + i * 90, 720, 30)
    # title art as banner (game: 640x120 area, we preview at 512x256)
    t = load("title_art", 0, 0)
    if t:
        t = t.resize((512, 256), Image.LANCZOS)
        canvas.alpha_composite(t, (256, 16))
        d.rectangle([256, 16, 768, 272], outline=GOLD, width=1)
    d.text((W // 2 - 120, 660), "MOCKUP: real in-game sizes", fill=GOLD)
    out = os.path.join(HERE, "mockup.png")
    canvas.convert("RGB").save(out, quality=92)
    print(out)


def colors():
    for a in manifest:
        if a.get("post") != "key":
            continue
        img = load(a["name"], a["w"], a["h"])
        if img is None:
            print(f"{a['name']}: MISSING")
            continue
        arr = np.array(img)
        mask = arr[:, :, 3] > 128
        px = arr[:, :, :3][mask]
        if len(px) == 0:
            print(f"{a['name']}: no opaque pixels!")
            continue
        q = (px // 32 * 32).astype(np.uint8)
        keys = [tuple(p) for p in np.unique(q.reshape(-1, 3), axis=0)]
        cnt = [(tuple(k), int((q.reshape(-1, 3) == k).all(axis=1).sum())) for k in keys]
        cnt.sort(key=lambda t: -t[1])
        top = ", ".join(f"#{r:02x}{g:02x}{b:02x}({n})" for (r, g, b), n in cnt[:5])
        print(f"{a['name']}: {top}")


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "sheet"
    {"sheet": sheet, "mockup": mockup, "colors": colors}[cmd]()
