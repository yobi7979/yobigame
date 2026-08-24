#!/usr/bin/env python3
"""One-off: generate v2 assets (new player frames + 3 companion frames each) from v2_manifest.json."""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate  # noqa: E402


def main():
    manifest = json.load(open(os.path.join(HERE, "v2_manifest.json"), encoding="utf-8"))
    res_path = os.path.join(HERE, "results_v2.json")
    res = json.load(open(res_path, encoding="utf-8")) if os.path.exists(res_path) else []
    done = {r["name"] for r in res if r["status"] == "ok"}
    for asset in manifest:
        name = asset["name"]
        if name in done and os.path.exists(os.path.join(HERE, name + ".png")):
            print(f"[skip] {name} (already ok)", flush=True)
            continue
        res = [r for r in res if r["name"] != name]
        print(f"[gen ] {name} ...", flush=True)
        t0 = time.time()
        try:
            r = generate.process(asset)
        except Exception as e:
            r = {"name": name, "seed": None, "status": "fail", "error": repr(e)[:300]}
        r["secs"] = round(time.time() - t0, 1)
        res.append(r)
        with open(res_path, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print(f"[done] {name} -> {r['status']} {r.get('error', '')} {r.get('secs', '')}s", flush=True)
    ok = sum(1 for r in res if r["status"] == "ok")
    print(f"SUMMARY: {ok}/{len(manifest)} ok", flush=True)


if __name__ == "__main__":
    main()
