#!/usr/bin/env python3
"""
Extract modelV2 (driving-model output) + liveCalibration from a comma openpilot
rlog into a compact JSON the web simulator can replay.

This is the "cheap" data path described in the model-sim plan: take a real
recorded route's modelV2 stream (predicted path, lane lines, road edges) and
ship it to the browser, where projection.ts reprojects it exactly like
openpilot's selfdrive/ui/onroad/model_renderer.py.

Requirements (host only, not the web app):
    pip install pycapnp

Capnp schemas are fetched once from github (commaai/openpilot + opendbc) and
cached under scripts/sim/.capnp_cache/.

Usage:
    python3 scripts/sim/extract_modelv2.py \
        --route 0c94aa1e1296d7c6/2021-05-05--19-48-37 --segment 0 \
        --out public/sim/demo_route.json
"""
import argparse
import bz2
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".capnp_cache")
HEIGHT_INIT = 1.22  # openpilot/selfdrive/locationd/calibrationd.py

# capnp schema files needed to decode an rlog Event stream, with their fetch URLs
OP = "https://raw.githubusercontent.com/commaai/openpilot/master/openpilot/cereal"
DBC = "https://raw.githubusercontent.com/commaai/opendbc/master/opendbc/car"
SCHEMAS = {
    "log.capnp": f"{OP}/log.capnp",
    "custom.capnp": f"{OP}/custom.capnp",
    "deprecated.capnp": f"{OP}/deprecated.capnp",
    "car.capnp": f"{DBC}/car.capnp",
    "include/c++.capnp": f"{OP}/include/c++.capnp",
}


def fetch(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest):
        return
    print(f"  fetch {url}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    with open(dest, "wb") as f:
        f.write(data)


def load_schema():
    import capnp
    capnp.remove_import_hook()
    for rel, url in SCHEMAS.items():
        fetch(url, os.path.join(CACHE, rel))
    return capnp.load(os.path.join(CACHE, "log.capnp"), imports=[CACHE])


def download_rlog(route: str, segment: int) -> bytes:
    dongle, ts = route.split("/")
    url = (
        f"https://commadataci.blob.core.windows.net/openpilotci/"
        f"{dongle}/{ts}/{segment}/rlog.bz2"
    )
    print(f"download {url}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=120) as r:
        raw = r.read()
    return bz2.decompress(raw)


def r3(values, nd=2):
    return [round(float(v), nd) for v in values]


def xyz(line, nd=2):
    return [r3(line.x, nd), r3(line.y, nd), r3(line.z, nd)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--route", default="0c94aa1e1296d7c6/2021-05-05--19-48-37")
    ap.add_argument("--segment", type=int, default=0)
    ap.add_argument("--out", default="public/sim/demo_route.json")
    ap.add_argument("--stride", type=int, default=1, help="keep every Nth frame")
    ap.add_argument("--min-dist", type=float, default=20.0,
                    help="skip frames whose predicted path is shorter than this (stopped car)")
    ap.add_argument("--rlog-file", help="use a local decompressed rlog instead of downloading")
    args = ap.parse_args()

    log = load_schema()
    if args.rlog_file:
        with open(args.rlog_file, "rb") as f:
            data = f.read()
    else:
        data = download_rlog(args.route, args.segment)

    calib = None
    frames = []
    idx = 0
    for ev in log.Event.read_multiple_bytes(data):
        w = ev.which()
        if w == "liveCalibration":
            lc = ev.liveCalibration
            if len(lc.rpyCalib) == 3 and calib is None:
                h = list(lc.height) if len(lc.height) else []
                calib = {"rpy": r3(lc.rpyCalib, 6),
                         "height": round(float(h[0]), 3) if h else HEIGHT_INIT}
        elif w == "modelV2":
            if idx % args.stride != 0:
                idx += 1
                continue
            idx += 1
            m = ev.modelV2
            # skip standstill frames: a stopped car predicts a ~zero-length path,
            # which projects to garbage (points at x~0 blow up under perspective).
            if len(m.position.x) == 0 or m.position.x[-1] < args.min_dist:
                continue
            frames.append({
                "path": xyz(m.position),
                "lanes": [xyz(l) for l in m.laneLines],
                "laneProbs": r3(m.laneLineProbs, 3),
                "edges": [xyz(e) for e in m.roadEdges],
                "edgeStds": r3(m.roadEdgeStds, 3),
            })

    if calib is None:
        calib = {"rpy": [0.0, 0.0, 0.0], "height": HEIGHT_INIT}

    out = {
        "route": f"{args.route}--{args.segment}",
        "source": "commaai openpilotci (public)",
        "fps": 20,
        # AR0231 / OX03C10 main camera (openpilot common/transformations/camera.py)
        "camera": {"width": 1928, "height": 1208, "focalLength": 2648.0},
        "calib": calib,
        "frames": frames,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    size = os.path.getsize(args.out)
    print(f"wrote {args.out}: {len(frames)} frames, {size/1024:.0f} KiB", file=sys.stderr)


if __name__ == "__main__":
    main()
