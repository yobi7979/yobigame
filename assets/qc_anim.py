#!/usr/bin/env python3
"""애니메이션 프레임 QC 컨택트 시트.
각 캐릭터 3프레임을 나란히 + 실제 게임 크리싱 축소 버전으로 한 장에 구성.
python qc_anim.py  ->  assets/qc_anim_sheet.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

# (이름, 실제 게임 표시 크기 px)
CHARS = [
    ("player", 36),
    ("enemy_basic", 26),
    ("enemy_fast", 26),
    ("enemy_tanky", 40),
    ("enemy_ranged", 26),
    ("enemy_miniboss", 60),
    ("enemy_boss", 88),
]

def load_frames(name):
    out = []
    for i in range(3):
        p = os.path.join(HERE, f"{name}_f{i}.png")
        if os.path.exists(p):
            out.append(Image.open(p).convert("RGBA"))
    return out

def main():
    n = len(CHARS)
    pad = 14
    label_h = 26
    big = 240  # 큰 프레임 표시
    row_h = big + label_h + 8
    W = pad * 2 + big * 3 + pad * 2
    H = 60 + n * row_h
    sheet = Image.new("RGBA", (W, H), (18, 20, 30, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 14), "ANIMATION QC  (3 frames each:  f0 f1 f2)   -> right = scaled to in-game size", fill=(255, 209, 102))
    y = 60
    for name, gs in CHARS:
        frames = load_frames(name)
        # 라벨
        d.text((pad, y), f"{name}   (in-game {gs}px)", fill=(125, 211, 252))
        y += label_h
        # 큰 3프레임
        for i, f in enumerate(frames):
            x = pad + i * (big + pad)
            sheet.paste(f, (x, y), f)
            d.rectangle([x, y, x + f.width - 1, y + f.height - 1], outline=(90, 96, 120))
            d.text((x + 4, y + 4), f"f{i}", fill=(255, 255, 255))
        # 실제 게임 크기 축소
        sx = pad + big * 3 + pad + 30
        for i, f in enumerate(frames):
            g = f.resize((gs, gs), Image.LANCZOS)
            gx = sx + i * (gs + 12)
            sheet.paste(g, (gx, y + (big - gs) // 2), g)
        y += row_h
    out = os.path.join(HERE, "qc_anim_sheet.png")
    sheet.convert("RGB").save(out, quality=92)
    print("WROTE", out)

if __name__ == "__main__":
    main()
