#!/usr/bin/env python3
"""Game asset generation pipeline.
Z-Image Turbo @ ComfyUI 192.168.201.104:8188 -> key-out black bg -> resize -> assets/<name>.png
Usage: python generate.py [name ...]   (no args = whole manifest; existing final files are skipped)
"""
import copy
import json
import os
import random
import sys
import time
import urllib.request
from collections import deque

BASE = "http://192.168.201.104:8188"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
RESULTS = os.path.join(HERE, "results.json")
os.makedirs(RAW, exist_ok=True)

from PIL import Image, ImageFilter, ImageChops


def http_json(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data, timeout=60) as r:
        return json.loads(r.read().decode())


def http_bytes(path, out):
    with urllib.request.urlopen(BASE + path, timeout=120) as r:
        with open(out, "wb") as f:
            f.write(r.read())


def queue_free():
    try:
        q = http_json("GET", "/queue")
        return len(q.get("queue_running") or []) == 0
    except Exception:
        return False


def wait_queue(max_wait=180):
    t0 = time.time()
    while time.time() - t0 < max_wait:
        if queue_free():
            return True
        time.sleep(5)
    return False


WF = {
    "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2"}},
    "4": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    "5": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
    "6": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["5", 0], "shift": 3}},
    "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["3", 0], "text": "PROMPT"}},
    "8": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["7", 0]}},
    "9": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
    "10": {"class_type": "KSampler", "inputs": {"model": ["6", 0], "positive": ["7", 0], "negative": ["8", 0], "latent_image": ["9", 0], "seed": 1, "steps": 8, "cfg": 1, "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1}},
    "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["4", 0]}},
    "12": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "gen"}},
}


def build_wf(prompt, w, h, seed, prefix):
    wf = copy.deepcopy(WF)
    wf["7"]["inputs"]["text"] = prompt
    wf["9"]["inputs"]["width"] = w
    wf["9"]["inputs"]["height"] = h
    wf["10"]["inputs"]["seed"] = seed
    wf["12"]["inputs"]["filename_prefix"] = prefix
    return wf


def key_background(img, thresh=26, light_thresh=200):
    """Remove ONLY background connected to image borders (flood fill) -> keeps inner details.
    Auto-detects black OR white background from corners (Z-Image Turbo sometimes ignores
    the 'black background' prompt). Mixed corners: accept both dark and light seeds."""
    img = img.convert("RGBA")
    sw, sh = 256, 256
    small = img.resize((sw, sh))
    px = small.load()
    corners = [px[2, 2], px[sw - 3, 2], px[2, sh - 3], px[sw - 3, sh - 3]]
    dark_bg = all(max(c[:3]) <= 60 for c in corners)
    light_bg = all(min(c[:3]) >= light_thresh for c in corners)

    def is_bg(x, y):
        r, g, b, _ = px[x, y]
        if dark_bg and not light_bg:
            return max(r, g, b) <= thresh
        if light_bg and not dark_bg:
            return min(r, g, b) >= light_thresh
        return max(r, g, b) <= thresh or min(r, g, b) >= light_thresh  # mixed: both seeds

    seen = [[False] * sw for _ in range(sh)]
    dq = deque()

    def seed(x, y):
        if not seen[y][x] and is_bg(x, y):
            seen[y][x] = True
            dq.append((x, y))

    for x in range(sw):
        seed(x, 0); seed(x, sh - 1)
    for y in range(sh):
        seed(0, y); seed(sw - 1, y)
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < sw and 0 <= ny < sh:
                seed(nx, ny)

    bg = Image.new("L", (sw, sh), 0)
    bgp = bg.load()
    for y in range(sh):
        for x in range(sw):
            if seen[y][x]:
                bgp[x, y] = 255
    bg = bg.resize(img.size, Image.BILINEAR)
    alpha = ImageChops.invert(bg).filter(ImageFilter.GaussianBlur(1.0))
    img.putalpha(alpha)
    return img


def bg_uniform(img):
    """True if the (raw, unkeyed) background corners are all-dark or all-light.
    Gradient/mixed backgrounds are unsafe to key for dark characters -> caller should retry."""
    px = img.convert("RGB").resize((4, 4)).load()
    corners = [px[0, 0], px[3, 0], px[0, 3], px[3, 3]]
    return max(max(c) for c in corners) <= 80 or min(min(c) for c in corners) >= 175


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
    prefix = "gen_" + name
    out_final = os.path.join(HERE, name + ".png")

    seed = random.randint(1, 2**31 - 1)
    if not wait_queue():
        return {"name": name, "seed": seed, "status": "fail", "error": "queue busy >180s"}
    wf = build_wf(asset["prompt"], asset["gw"], asset["gh"], seed, prefix)
    resp = http_json("POST", "/prompt", {"prompt": wf})
    pid = resp.get("prompt_id")
    if not pid or resp.get("node_errors"):
        return {"name": name, "seed": seed, "status": "fail", "error": json.dumps(resp)[:300]}

    fname = None
    t0 = time.time()
    while time.time() - t0 < 180:
        time.sleep(5)
        try:
            h = http_json("GET", "/history/" + pid)
            outs = h.get(pid, {}).get("outputs", {})
            for node in outs.values():
                imgs = node.get("images") or []
                if imgs:
                    fname = imgs[0]["filename"]
                    break
        except Exception:
            pass
        if fname:
            break
    if not fname:
        return {"name": name, "seed": seed, "status": "fail", "error": "no output in 180s"}

    raw_path = os.path.join(RAW, fname)
    http_bytes("/view?filename=" + fname + "&type=output", raw_path)
    img = Image.open(raw_path)
    if asset.get("post") == "key":
        img = key_background(img)
    img = img.resize((asset["w"], asset["h"]), Image.LANCZOS)
    img.save(out_final)
    return {"name": name, "seed": seed, "status": "ok", "size": [asset["w"], asset["h"]], "raw": fname}


def main():
    only = set(sys.argv[1:])
    manifest = json.load(open(os.path.join(HERE, "manifest.json"), encoding="utf-8"))
    res = load_results()
    done_names = {r["name"] for r in res if r["status"] == "ok"}
    for asset in manifest:
        name = asset["name"]
        if only and name not in only:
            continue
        final = os.path.join(HERE, name + ".png")
        if os.path.exists(final) and name in done_names:
            print(f"[skip] {name} (already ok)", flush=True)
            continue
        res = [r for r in res if r["name"] != name]
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
