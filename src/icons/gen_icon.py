#!/usr/bin/env python3
"""Icône Group Ride : trois repères de position sur un sentier, devant les collines.
viewBox 108 = gabarit d'icône adaptative Android (zone sûre : disque de 66 au centre).
Produit les SVG, les PNG web et les ressources Android (rsvg-convert requis)."""
import pathlib, subprocess, shutil
from PIL import Image

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
RES = ROOT / "android/app/src/main/res"

BG = '''<defs>
 <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2418"/><stop offset="0.7" stop-color="#24502F"/><stop offset="1" stop-color="#3B7340"/></linearGradient>
 <linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8A45"/><stop offset="1" stop-color="#2F6233"/></linearGradient>
</defs>
<rect width="108" height="108" fill="url(#sky)"/>
<path d="M0,58 L14,46 L24,52 L40,34 L52,44 L62,36 L76,48 L88,40 L108,54 L108,108 L0,108 Z" fill="url(#far)" opacity=".9"/>
<path d="M0,74 C18,62 34,60 54,66 C72,71 90,64 108,58 L108,108 L0,108 Z" fill="#183A20"/>'''

def pin(x, y, col, s=1.0):
    # repère de position (goutte) dont la pointe est en (x, y)
    return (f'<g transform="translate({x},{y}) scale({s})">'
            '<path d="M0,0 C-3,-6 -9,-10 -9,-17 A9,9 0 1,1 9,-17 C9,-10 3,-6 0,0 Z" fill="%s" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/>'
            '<circle cx="0" cy="-17" r="3.6" fill="#fff" stroke="#000" stroke-width="1.2"/></g>') % col

FG = ('<path d="M24,96 C34,86 30,78 40,72 C50,66 60,70 64,60 C68,50 60,46 70,40 C78,35 84,34 88,26" fill="none" stroke="#3A2A16" stroke-width="9" stroke-linecap="round"/>'
      '<path d="M24,96 C34,86 30,78 40,72 C50,66 60,70 64,60 C68,50 60,46 70,40 C78,35 84,34 88,26" fill="none" stroke="#E9D3A6" stroke-width="5" stroke-linecap="round"/>'
      + pin(39, 72, '#A3E635', 1.05) + pin(63, 61, '#FF8A00', 0.95) + pin(73, 39, '#00E5FF', 0.85))

def svg(body, vb="0 0 108 108"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>'

def render(src, out, w, h=None):
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h or w), "-o", str(out), str(src)], check=True)

if __name__ == "__main__":
    tmp = HERE / "_tmp"; tmp.mkdir(exist_ok=True)
    (tmp / "bg.svg").write_text(svg(BG)); (tmp / "fg.svg").write_text(svg(FG))
    web = svg(BG + FG, "12 12 84 84")
    (HERE / "icon.svg").write_text(web); (tmp / "web.svg").write_text(web)
    for n in (180, 192, 512):
        render(tmp / "web.svg", HERE / f"icon-{n}.png", n)
    # Android : icône adaptative (avant-plan + fond) et icônes classiques
    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for d, k in dens.items():
        dd = RES / f"mipmap-{d}"
        render(tmp / "fg.svg", dd / "ic_launcher_foreground.png", int(108 * k))
        render(tmp / "bg.svg", dd / "ic_launcher_background.png", int(108 * k))
        n = int(48 * k)
        render(tmp / "web.svg", dd / "ic_launcher.png", n)
        im = Image.open(dd / "ic_launcher.png").convert("RGBA")
        mask = Image.new("L", im.size, 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((0, 0, n - 1, n - 1), fill=255)
        rnd = Image.new("RGBA", im.size, (0, 0, 0, 0)); rnd.paste(im, (0, 0), mask)
        rnd.save(dd / "ic_launcher_round.png")
    # écrans de démarrage : fond noir, icône au centre (mêmes dimensions que les fichiers existants)
    render(tmp / "web.svg", tmp / "big.png", 512)
    big = Image.open(tmp / "big.png").convert("RGBA")
    for f in RES.glob("drawable*/splash.png"):
        w, h = Image.open(f).size
        s = int(min(w, h) * 0.36)
        canvas = Image.new("RGB", (w, h), (11, 13, 11))
        ic = big.resize((s, s), Image.LANCZOS)
        canvas.paste(ic, ((w - s) // 2, (h - s) // 2), ic)
        canvas.save(f)
    shutil.rmtree(tmp)
    print("icônes générées")
