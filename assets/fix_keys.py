#!/usr/bin/env python3
"""One-off fix: re-key shadow f0/f1 from local raw (white bg); regenerate player_f2 until bg uniform."""
import json
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate  # noqa: E402
from PIL import Image  # noqa: E402


def finish(name, img):
    img = img.resize((256, 256), Image.LANCZOS)
    img.save(os.path.join(HERE, name + ".png"))
    print("saved", name, flush=True)


# 1) re-key shadows from local raw (white background)
for name in ("comp_shadow_f0", "comp_shadow_f1"):
    raw = os.path.join(HERE, "raw", "gen_%s_00001_.png" % name)
    finish(name, generate.key_background(Image.open(raw)))

# 2) regenerate player_f2 until background corners are uniform
manifest = json.load(open(os.path.join(HERE, "v2_manifest.json"), encoding="utf-8"))
asset = next(a for a in manifest if a["name"] == "player_f2")
ok = False
seed = None
fname = None
for attempt in range(1, 4):
    if not generate.wait_queue():
        print("queue busy, abort", flush=True)
        sys.exit(1)
    seed = random.randint(1, 2**31 - 1)
    wf = generate.build_wf(asset["prompt"], asset["gw"], asset["gh"], seed, "gen_player_f2_fix")
    resp = generate.http_json("POST", "/prompt", {"prompt": wf})
    pid = resp.get("prompt_id")
    if not pid or resp.get("node_errors"):
        print("submit failed:", json.dumps(resp)[:200], flush=True)
        continue
    fname = None
    t0 = time.time()
    while time.time() - t0 < 180:
        time.sleep(5)
        try:
            h = generate.http_json("GET", "/history/" + pid)
            for node in h.get(pid, {}).get("outputs", {}).values():
                imgs = node.get("images") or []
                if imgs:
                    fname = imgs[0]["filename"]
                    break
        except Exception:
            pass
        if fname:
            break
    if not fname:
        print("no output, retry", flush=True)
        continue
    raw_path = os.path.join(generate.RAW, fname)
    generate.http_bytes("/view?filename=" + fname + "&type=output", raw_path)
    img = Image.open(raw_path)
    if not generate.bg_uniform(img):
        print("attempt %d: bg not uniform (%s), retry" % (attempt, fname), flush=True)
        continue
    finish("player_f2", generate.key_background(img))
    print("player_f2 ok:", fname, "seed", seed, flush=True)
    ok = True
    break

# 3) update results_v2.json
res_path = os.path.join(HERE, "results_v2.json")
res = json.load(open(res_path, encoding="utf-8")) if os.path.exists(res_path) else []
res = [r for r in res if r["name"] not in ("player_f2", "comp_shadow_f0", "comp_shadow_f1")]
res += [
    {"name": "comp_shadow_f0", "seed": None, "status": "ok", "size": [256, 256], "raw": "gen_comp_shadow_f0_00001_.png", "note": "rekeyed white bg"},
    {"name": "comp_shadow_f1", "seed": None, "status": "ok", "size": [256, 256], "raw": "gen_comp_shadow_f1_00001_.png", "note": "rekeyed white bg"},
    {"name": "player_f2", "seed": seed if ok else None, "status": "ok" if ok else "fail", "size": [256, 256], "raw": fname if ok else None},
]
with open(res_path, "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=1)
print("ALL DONE", flush=True)
sys.exit(0 if ok else 1)
