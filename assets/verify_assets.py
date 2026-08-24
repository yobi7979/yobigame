#!/usr/bin/env python3
"""Verify 12 asset frames: alpha corners, fill, edge contact; build f0/f2 comparison montage."""
from PIL import Image

NAMES = ["player_f0", "player_f1", "player_f2",
         "comp_warrior_f0", "comp_warrior_f1", "comp_warrior_f2",
         "comp_guardian_f0", "comp_guardian_f1", "comp_guardian_f2",
         "comp_shadow_f0", "comp_shadow_f1", "comp_shadow_f2"]

print("name | corners(tl,tr,bl,br) | filled | edge_contact(L,R,T,B)")
bad = []
for n in NAMES:
    im = Image.open(n + ".png").convert("RGBA")
    a = im.getchannel("A")
    w, h = im.size
    c = [a.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    filled = sum(1 for p in a.getdata() if p > 128)
    # edge contact: any opaque pixel in outermost rows/cols
    rows = list(a.getdata())
    left = max(rows[y * w] for y in range(h))
    right = max(rows[y * w + w - 1] for y in range(h))
    top = max(rows[x] for x in range(w))
    bot = max(rows[(h - 1) * w + x] for x in range(w))
    ec = [left > 128, right > 128, top > 128, bot > 128]
    ok = all(v == 0 for v in c) and not any(ec)
    if not ok:
        bad.append(n)
    print("%-18s %s %6d  %s" % (n, c, filled, ec))

# montage: player f0 | f1 | f2 on dark bg
m = Image.new("RGB", (768, 256), (40, 44, 52))
for i, n in enumerate(["player_f0", "player_f1", "player_f2"]):
    im = Image.open(n + ".png").convert("RGBA")
    m.paste(im, (i * 256, 0), im)
m.save("player_compare.png")
print("bad:", bad)
print("montage saved: player_compare.png")
