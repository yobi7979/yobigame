#!/usr/bin/env python3
"""3-frame animation sheet pipeline.
anim_manifest.json -> Z-Image Turbo (ComfyUI) sheet -> key bg -> slice frames ->
assets/<name>_f0..fN.png. Resumable like generate.py (results_anim.json).
Usage: python gen_anim.py [name ...]   (no args = whole anim manifest)
"""
import json
import os
import random
import sys
import time

import generate as G
from PIL import Image
from sheet import slice_sheet

HERE = os.path.dirname(os.path.abspath(__file__))
ANIM_MANIFEST = os.path.join(HERE, "anim_manifest.json")
RESULTS = os.path.join(HERE, "results_anim.json")


def load_results():
    if os.path.exists(RESULTS):
        try:
            return json.load(open(RESULTS, encoding="utf-8"))
        except Exception:
            pass
    return []


def save_results(res):
    with open(RESULTS, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


def process(asset):
    name = asset["name"]
    prefix = "anim_" + name
    n = asset.get("frames", 3)
    seed = random.randint(1, 2**31 - 1)
    if not G.wait_queue():
        return {"name": name, "seed": seed, "status": "fail", "error": "queue busy >180s"}
    wf = G.build_wf(asset["prompt"], asset["gw"], asset["gh"], seed, prefix)
    resp = G.http_json("POST", "/prompt", {"prompt": wf})
    pid = resp.get("prompt_id")
    if not pid or resp.get("node_errors"):
        return {"name": name, "seed": seed, "status": "fail", "error": json.dumps(resp)[:300]}

    fname = None
    t0 = time.time()
    while time.time() - t0 < 300:
        time.sleep(5)
        try:
            h = G.http_json("GET", "/history/" + pid)
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
        return {"name": name, "seed": seed, "status": "fail", "error": "no output in 300s"}

    raw_path = os.path.join(G.RAW, fname)
    G.http_bytes("/view?filename=" + fname + "&type=output", raw_path)
    img = Image.open(raw_path)
    img = G.key_background(img)
    outs = slice_sheet(img, n, name, asset["w"], asset["h"], HERE)
    if not outs:
        return {"name": name, "seed": seed, "status": "fail", "error": "empty frame in sheet", "raw": fname}
    return {"name": name, "seed": seed, "status": "ok", "frames": outs, "raw": fname}


def main():
    only = set(sys.argv[1:])
    manifest = json.load(open(ANIM_MANIFEST, encoding="utf-8"))
    res = load_results()
    for asset in manifest:
        name = asset["name"]
        if only and name not in only:
            continue
        final0 = os.path.join(HERE, name + "_f0.png")
        done = any(r["name"] == name and r["status"] == "ok" for r in res)
        if os.path.exists(final0) and done:
            print(f"[skip] {name} (already ok)", flush=True)
            continue
        res = [r for r in res if r["name"] != name]
        for i in range(asset.get("frames", 3)):
            p = os.path.join(HERE, f"{name}_f{i}.png")
            if os.path.exists(p):
                os.remove(p)
        print(f"[gen ] {name} ...", flush=True)
        try:
            r = process(asset)
        except Exception as e:
            r = {"name": name, "seed": None, "status": "fail", "error": repr(e)[:300]}
        res.append(r)
        save_results(res)
        print(f"[done] {name} -> {r['status']} {r.get('error', '')}", flush=True)
    ok = sum(1 for r in res if r["status"] == "ok")
    print(f"SUMMARY: {ok}/{len(manifest)} ok", flush=True)


if __name__ == "__main__":
    main()
