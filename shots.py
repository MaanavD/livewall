#!/usr/bin/env python3
"""Render every wallpaper to a PNG and stitch a contact sheet.

Usage: python3 shots.py [outdir]
Writes <outdir>/NN-name.png plus <outdir>/contact.jpg
"""
import base64, json, os, socket, subprocess, sys, time, urllib.request
from urllib.error import URLError

CHROME = "/home/maanav/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
OUT    = sys.argv[1] if len(sys.argv) > 1 else "/home/maanav/livewall/shots"
SHOT_W, SHOT_H = 1280, 720


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    os.makedirs(OUT, exist_ok=True)
    port = free_port()
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={port}",
         "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
         "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         f"--window-size={SHOT_W},{SHOT_H}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws = None
        for _ in range(60):
            time.sleep(0.5)
            try:
                for t in urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5).read() and json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5)):
                    if t.get("type") == "page":
                        ws = t["webSocketDebuggerUrl"]; break
            except (URLError, socket.timeout, ConnectionError, json.JSONDecodeError):
                continue
            if ws: break
        if not ws: sys.exit("no chrome page")

        from websockets.sync.client import connect
        with connect(ws, max_size=200 * 1024 * 1024) as c:
            mid = [0]
            def call(method, **params):
                mid[0] += 1
                c.send(json.dumps({"id": mid[0], "method": method, "params": params}))
                while True:
                    m = json.loads(c.recv())
                    if m.get("id") == mid[0]:
                        if "error" in m: raise RuntimeError(m["error"])
                        return m.get("result", {})

            call("Page.enable")
            call("Page.navigate", url="http://127.0.0.1:8793/shot.html")
            for _ in range(60):
                time.sleep(0.5)
                r = call("Runtime.evaluate", expression="!!window.__shotReady", returnByValue=True)
                if r["result"].get("value"): break
            else:
                sys.exit("shot.html never became ready")

            n = call("Runtime.evaluate", expression="window.__count",
                     returnByValue=True)["result"]["value"]
            names = call("Runtime.evaluate", expression="JSON.stringify(window.__names)",
                         returnByValue=True)["result"]["value"]
            names = json.loads(names)

            paths = []
            for i in range(n):
                call("Runtime.evaluate", expression=f"window.__render({i}, 14.0)",
                     returnByValue=True, awaitPromise=True)
                time.sleep(0.15)
                data = call("Page.captureScreenshot", format="png")["data"]
                slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in names[i]).strip("-")
                fp = os.path.join(OUT, f"{i:02d}-{slug}.png")
                with open(fp, "wb") as f:
                    f.write(base64.b64decode(data))
                paths.append(fp)
                print(f"  {i:02d} {names[i]}")
    finally:
        proc.terminate()

    sheet = os.path.join(OUT, "contact.jpg")
    from PIL import Image, ImageDraw
    TW, TH, GAP, LBL = 440, 248, 6, 24
    cols = 4
    rows = (len(paths) + cols - 1) // cols
    canvas = Image.new("RGB", (cols*TW + (cols+1)*GAP,
                               rows*(TH+LBL) + (rows+1)*GAP), (17, 17, 17))
    d = ImageDraw.Draw(canvas)
    for i, (fp, nm) in enumerate(zip(paths, names)):
        im = Image.open(fp).convert("RGB").resize((TW, TH), Image.LANCZOS)
        x = GAP + (i % cols)*(TW+GAP)
        y = GAP + (i // cols)*(TH+LBL+GAP)
        canvas.paste(im, (x, y))
        d.text((x+6, y+TH+5), f"{i:02d}  {nm}", fill=(225, 228, 235))
    canvas.save(sheet, quality=90)
    print("contact sheet:", sheet, canvas.size)


if __name__ == "__main__":
    main()
