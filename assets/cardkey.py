#!/usr/bin/env python3
"""Remove white card panels behind characters in anim frames (post-process).

Z-Image draws a white card behind most characters despite "no cards" prompts.
The character has a thick dark outline, so flood-filling near-white pixels from
the content-bbox boundary removes only the card, never the character. A fringe
pass removes the semi-transparent dark ring at the card edge. Frames are then
re-trimmed and re-normalized (tallest frame fills 94% of canvas height) so the
character ends up ~25% larger than before (the card no longer eats space).

Guard: if the boundary-connected near-white region covers < 30% of the bbox,
it is NOT a card (e.g. the knight's white helmet at the silhouette edge) and
the frame is left untouched.

Usage: python cardkey.py [name ...]
"""
import os
import shutil
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CHARS = ["player", "enemy_basic", "enemy_fast", "enemy_tanky",
         "enemy_ranged", "enemy_miniboss", "enemy_boss"]
CANVAS = {c: 256 for c in CHARS}
CANVAS["enemy_boss"] = 512
NF = 3
BACKUP = os.path.join(HERE, "_precardkey")


def is_nw(p):
    return p[3] > 128 and p[0] > 195 and p[1] > 195 and p[2] > 195


def flood_card(img):
    """Return (set of card pixel coords, bbox_area). Card = near-white pixels
    connected (4-dir) to near-white pixels on the content bbox boundary."""
    box = img.getbbox()
    if not box:
        return None, 0
    x0, y0, x1, y1 = box
    px = img.load()
    reached = set()
    q = deque()

    def seed(x, y):
        if (x, y) not in reached and is_nw(px[x, y]):
            reached.add((x, y))
            q.append((x, y))

    def walk_seed(x, y, dx, dy):
        """Walk inward from a bbox-boundary pixel through the semi-transparent
        black-key ring (alpha < 255) and seed the first near-white pixel found.
        Stops at opaque non-near-white (character edge) or transparent gaps."""
        for step in range(1, 10):
            nx, ny = x + dx * step, y + dy * step
            if not (x0 <= nx < x1 and y0 <= ny < y1):
                break
            p = px[nx, ny]
            if p[3] == 0:
                break
            if is_nw(p):
                seed(nx, ny)
                return
            if p[3] == 255:
                break  # opaque, not near-white: character edge, no card here

    for x in range(x0, x1):
        walk_seed(x, y0, 0, 1)
        walk_seed(x, y1 - 1, 0, -1)
    for y in range(y0, y1):
        walk_seed(x0, y, 1, 0)
        walk_seed(x1 - 1, y, -1, 0)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in reached or not (x0 <= nx < x1 and y0 <= ny < y1):
                continue
            if is_nw(px[nx, ny]):
                reached.add((nx, ny))
                q.append((nx, ny))
    return reached, (x1 - x0) * (y1 - y0)


def clean_frame(img):
    """Return (image, removed_count). No-op if no card detected."""
    reached, box_area = flood_card(img)
    if not reached or len(reached) < 0.40 * box_area:
        return img, 0
    px = img.load()
    for (x, y) in reached:
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
    removed = set(reached)
    # fringe: semi-transparent pixels adjacent to the removed card (its AA ring)
    for _ in range(3):
        add = set()
        for (x, y) in removed:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in removed:
                        continue
                    if 0 <= nx < img.width and 0 <= ny < img.height:
                        if px[nx, ny][3] < 255:
                            add.add((nx, ny))
        for (x, y) in add:
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)
        if not add:
            break
        removed |= add
    return img, len(removed)


def normalize(frames, canvas):
    """Re-trim each frame, scale so the tallest fills 94% of canvas height,
    center on a transparent square canvas (same contract as sheet.py)."""
    trimmed = [im.crop(im.getbbox()) for im in frames]
    ref_h = max(c.height for c in trimmed)
    out = []
    for c in trimmed:
        scale = (canvas * 0.94) / ref_h
        nw, nh = max(1, round(c.width * scale)), max(1, round(c.height * scale))
        s2 = min(1.0, canvas / nw, canvas / nh)
        if s2 < 1.0:
            nw, nh = max(1, round(nw * s2)), max(1, round(nh * s2))
        c = c.resize((nw, nh), Image.LANCZOS)
        cv = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        cv.alpha_composite(c, ((canvas - nw) // 2, (canvas - nh) // 2))
        out.append(cv)
    return out


def main():
    import sys
    only = set(sys.argv[1:])
    if not os.path.exists(BACKUP):
        os.makedirs(BACKUP)
    for name in CHARS:
        if only and name not in only:
            continue
        paths = [os.path.join(HERE, f"{name}_f{i}.png") for i in range(NF)]
        if not all(os.path.exists(p) for p in paths):
            print(f"[skip] {name} (missing frames)")
            continue
        frames = [Image.open(p).convert("RGBA") for p in paths]
        for i in range(NF):
            shutil.copy2(paths[i], os.path.join(BACKUP, os.path.basename(paths[i])))
        totals = []
        for i in range(NF):
            frames[i], n = clean_frame(frames[i])
            totals.append(n)
        canvas = CANVAS[name]
        frames = normalize(frames, canvas)
        for i in range(NF):
            frames[i].save(paths[i])
        print(f"[done] {name}: removed px per frame = {totals}")


if __name__ == "__main__":
    main()
