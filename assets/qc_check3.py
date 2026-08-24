#!/usr/bin/env python3
"""QC the cardkey-cleared anim frames: near-white %, aspect, fill +
checkerboard contact sheet (qc_check3.png)."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["player", "enemy_basic", "enemy_fast", "enemy_tanky",
         "enemy_ranged", "enemy_miniboss", "enemy_boss"]
NF = 3

print(f"{'char':<14} {'aspect':<6} {'nearWhite%':<12} {'fill%':<8} bbox")
rows = []
for name in NAMES:
    stats = []
    imgs = []
    for i in range(NF):
        im = Image.open(os.path.join(HERE, f"{name}_f{i}.png")).convert("RGBA")
        box = im.getbbox()
        w, h = box[2] - box[0], box[3] - box[1]
        opq = nw = 0
        for y in range(box[1], box[3], 2):
            for x in range(box[0], box[2], 2):
                p = im.getpixel((x, y))
                if p[3] > 0:
                    opq += 1
                    if p[0] > 195 and p[1] > 195 and p[2] > 195:
                        nw += 1
        stats.append((round(w / h, 2), round(100 * nw / opq, 1), round(100 * opq * 4 / (w * h), 1), f"{w}x{h}"))
        imgs.append(im)
    a0, nw0, fill0, b0 = stats[0]
    flag = "  <== WHITE-CARD?" if max(s[1] for s in stats) > 25 else ""
    print(f"{name:<14} {a0:<6} {nw0:<12} {fill0:<8} {b0}{flag}")
    rows.append((name, imgs, stats))

# checkerboard contact sheet: 7 rows x 3 cols, each cell 256
def checker(size=64):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            if (x // 16 + y // 16) % 2 == 0:
                px[x, y] = (90, 90, 90, 255)
            else:
                px[x, y] = (60, 60, 60, 255)
    return img

CELL = 256
PAD = 8
sheet = Image.new("RGBA", (3 * (CELL + PAD) + PAD, len(rows) * (CELL + PAD) + PAD), (20, 20, 20, 255))
for r, (name, imgs, stats) in enumerate(rows):
    for i, im in enumerate(imgs):
        x = PAD + i * (CELL + PAD)
        y = PAD + r * (CELL + PAD)
        tile = checker(CELL)
        tile.alpha_composite(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
        sheet.alpha_composite(tile, (x, y))
out = os.path.join(HERE, "qc_check3.png")
sheet.save(out)
print("sheet:", out, sheet.size)
