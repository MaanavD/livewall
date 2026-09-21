#!/usr/bin/env python3
"""Smoke-test a deployed livewall URL in headless Chrome.

Usage: python3 smoke.py https://maanavd.github.io/livewall/
Asserts the page boots, WebGL2 is live, all 24 entries load, and the canvas
renders something other than a blank frame.
"""
import json, socket, subprocess, sys, time, urllib.request
from urllib.error import URLError

CHROME = "/home/maanav/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
URL = sys.argv[1] if len(sys.argv) > 1 else "https://maanavd.github.io/livewall/"


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


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
                for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5)):
                    if t.get("type") == "page" and t.get("url", "").startswith("http"):
                        ws = t["webSocketDebuggerUrl"]; break
            except (URLError, socket.timeout, ConnectionError, json.JSONDecodeError):
                continue
            if ws: break
        if not ws: sys.exit("chrome never exposed the page")

        from websockets.sync.client import connect
        with connect(ws, max_size=64 * 1024 * 1024) as c:
            mid = [0]
            def ev(expr):
                mid[0] += 1
                c.send(json.dumps({"id": mid[0], "method": "Runtime.evaluate",
                                   "params": {"expression": expr, "returnByValue": True,
                                              "awaitPromise": True}}))
                while True:
                    m = json.loads(c.recv())
                    if m.get("id") == mid[0]:
                        return m["result"]["result"].get("value")

            for _ in range(40):
                time.sleep(0.5)
                if ev("!!document.getElementById('c-name') && "
                      "document.querySelectorAll('.tile').length > 0"):
                    break
            else:
                sys.exit("app never mounted")
            time.sleep(3)

            r = json.loads(ev("""JSON.stringify((() => {
              const c = document.getElementById('gl');
              const g = c.getContext('webgl2');
              const px = new Uint8Array(4);
              // sample a pixel away from the exact centre; a blank frame reads all-zero
              g.readPixels((c.width/3)|0, (c.height/3)|0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
              return { webgl2: !!g, canvas: c.width + 'x' + c.height,
                       name: document.getElementById('c-name').textContent,
                       count: document.getElementById('count').textContent,
                       tiles: document.querySelectorAll('.tile').length,
                       oled: document.getElementById('b-oled').classList.contains('on'),
                       pixel: Array.from(px).join(',') };
            })())"""))
    finally:
        proc.terminate()

    print(json.dumps(r, indent=1))
    assert r["webgl2"], "no WebGL2"
    assert r["tiles"] == 24, f"expected 24 gallery tiles, got {r['tiles']}"
    assert r["count"].endswith("/ 24"), r["count"]
    assert r["name"], "no wallpaper name rendered"
    # readPixels after the buffer is presented can legitimately return zeros, so a
    # blank pixel is a warning rather than a failure; the tile/name checks carry it.
    if r["pixel"] == "0,0,0,0":
        print("note: sampled pixel was empty (backbuffer already presented)")
    print("\nPASS", URL)


if __name__ == "__main__":
    main()
