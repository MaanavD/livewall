#!/usr/bin/env python3
"""Headless-Chrome bench for livewall.

Loads bench.html in a throwaway Chrome over CDP, waits for window.__bench,
prints brightness/motion per wallpaper plus the most visually similar pairs.
Fails loudly if any shader failed to compile.
"""
import json, os, socket, subprocess, sys, time, urllib.request
from urllib.error import URLError

CHROME = "/home/maanav/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
URL    = "http://127.0.0.1:8793/bench.html"


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def cdp_targets(port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5) as r:
        return json.load(r)


def main():
    port = free_port()
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={port}",
         "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
         "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         "--window-size=1280,720", URL],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws = None
        for _ in range(60):
            time.sleep(0.5)
            try:
                for t in cdp_targets(port):
                    if t.get("type") == "page" and "bench" in t.get("url", ""):
                        ws = t["webSocketDebuggerUrl"]
                        break
            except (URLError, socket.timeout, ConnectionError):
                continue
            if ws:
                break
        if not ws:
            sys.exit("chrome never exposed the bench page")

        from websockets.sync.client import connect
        with connect(ws, max_size=64 * 1024 * 1024) as c:
            def evaluate(expr, mid):
                c.send(json.dumps({"id": mid, "method": "Runtime.evaluate",
                                   "params": {"expression": expr, "returnByValue": True}}))
                while True:
                    m = json.loads(c.recv())
                    if m.get("id") == mid:
                        return m["result"]["result"].get("value")

            mid = 1
            for _ in range(180):          # bench is ~24 shaders of software rasterisation
                v = evaluate("window.__bench ? 'ready' : 'wait'", mid); mid += 1
                if v == "ready":
                    break
                time.sleep(2)
            else:
                sys.exit("bench never finished")
            data = json.loads(evaluate("JSON.stringify(window.__bench)", mid))
    finally:
        proc.terminate()

    if data["errs"]:
        print("SHADER ERRORS:")
        for e in data["errs"]:
            print(" ", e)

    print(f"{'#':<3}{'name':<22}{'mean':>6}{'blk':>6}{'lit':>6}{'avgRGB':>14}{'motion':>8}{'ms':>7}")
    weak = []
    for r in data["rows"]:
        bad = r["black"] > 0.45 or r["lit"] < 0.40 or r["motion"] < 0.03 or r["mean"] > 0.68
        if bad:
            weak.append(r["name"])
        print(f"{r['i']:<3}{r['name']:<22}{r['mean']:>6}{r['black']:>6}{r['lit']:>6}"
              f"{r['rgb']:>14}{r['motion']:>8}{r['ms']:>7}{'  <<' if bad else ''}")
    print("\nweak:", weak or "none")
    print("\nmost similar pairs (.45 layout + .55 hue):")
    for p in data["worstPairs"][:8]:
        print(f"  {p['score']:.3f}  layout {p['layout']:.2f} hue {p['hue']:.2f}  {p['a']} / {p['b']}")

    assert not data["errs"], "shader compile errors"
    assert not weak, f"wallpapers failed the brightness/motion floor: {weak}"
    assert data["worstPairs"][0]["score"] < 0.85, \
        f"too similar: {data['worstPairs'][0]}"
    print("\nPASS")


if __name__ == "__main__":
    main()
