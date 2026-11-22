#!/usr/bin/env python3
"""Assemble Group Ride : docs/ (version web, GitHub Pages) et www/ (appli Android)."""
import base64, json, pathlib, shutil

ROOT = pathlib.Path(__file__).parent
SRC, NM = ROOT / "src", ROOT / "node_modules"
DIST = ROOT / "docs"          # version web (GitHub Pages)
WWW = ROOT / "www"            # contenu embarqué dans l'appli Android
VERSION = json.loads((ROOT / "package.json").read_text())["version"]
for d in (DIST, WWW):
    if d.exists():
        shutil.rmtree(d)
    d.mkdir()

leaflet_css = (NM / "leaflet/dist/leaflet.css").read_text()
leaflet_js = (NM / "leaflet/dist/leaflet.js").read_text().replace("//# sourceMappingURL=leaflet.js.map", "")
f400 = base64.b64encode((NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2").read_bytes()).decode()
f700 = base64.b64encode((NM / "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2").read_bytes()).decode()
fonts = (
    "@font-face{font-family:'Atkinson';src:url(data:font/woff2;base64,%s) format('woff2');font-weight:400;font-display:swap}"
    "@font-face{font-family:'Atkinson';src:url(data:font/woff2;base64,%s) format('woff2');font-weight:700;font-display:swap}"
) % (f400, f700)
icon_uri = "data:image/svg+xml;base64," + base64.b64encode((SRC / "icons/icon.svg").read_bytes()).decode()

app_js = "\n".join(p.read_text() for p in sorted((SRC / "js").glob("*.js")))
app_js = app_js.replace("const VERSION='1.0.0';", f"const VERSION='{VERSION}';", 1)
body = (SRC / "body.html").read_text().replace('src="icon.svg"', f'src="{icon_uri}"')
html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="theme-color" content="#0b0d0b">
<meta name="description" content="Sorties VTT en groupe : positions de chacun en direct sur la carte, statistiques, tracés GPX partagés et messagerie du groupe.">
<title>Group Ride – sorties VTT en groupe</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" sizes="180x180" href="icon-180.png">
<meta name="apple-mobile-web-app-title" content="Group Ride">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<style>{leaflet_css}</style>
<style>{fonts}
{(SRC / "style.css").read_text()}</style>
</head>
<body>
{body}
<script>{leaflet_js}</script>
<script>{(NM / "@capacitor/core/dist/capacitor.js").read_text()}</script>
<script>{(NM / "qrcode-generator/dist/qrcode.js").read_text()}</script>
<script>'use strict';
(function(){{
{app_js}
}})();</script>
</body>
</html>
"""
(DIST / "index.html").write_text(html)
for f in ("icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"):
    shutil.copy(SRC / "icons" / f, DIST / f)
# politique de confidentialité (demandée par Apple pour TestFlight et l'App Store)
shutil.copy(SRC / "confidentialite.html", DIST / "confidentialite.html")
# manuel d'utilisation (PDF, généré par manuel/build_manual.py)
if (ROOT / "manuel/manuel-group-ride.pdf").exists():
    shutil.copy(ROOT / "manuel/manuel-group-ride.pdf", DIST / "manuel-group-ride.pdf")

manifest = {
    "name": "Group Ride – sorties VTT en groupe",
    "short_name": "Group Ride",
    "description": "Positions du groupe en direct, statistiques, tracés GPX partagés et messagerie.",
    "lang": "fr",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#0b0d0b",
    "theme_color": "#0b0d0b",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"},
    ],
}
(DIST / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

sw = """// Group Ride – service worker : l'appli s'ouvre hors connexion une fois chargée.
const CACHE = 'groupride-v%s';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // fonds de carte, relais : réseau direct
  if (req.mode === 'navigate') { // page : la dernière version si le réseau répond vite, sinon celle gardée hors ligne
    e.respondWith(caches.open(CACHE).then(async c => {
      try {
        const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('lent')), 4000))]);
        if (r && r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) { return (await c.match('./index.html')) || (await c.match(req, { ignoreSearch: true })) || Response.error(); }
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
""" % VERSION
(DIST / "sw.js").write_text(sw)
(DIST / ".nojekyll").write_text("")
shutil.copy(DIST / "index.html", WWW / "index.html")
print("OK docs:", sorted(p.name for p in DIST.iterdir()), "| www:", sorted(p.name for p in WWW.iterdir()), round((WWW / "index.html").stat().st_size / 1024), "Ko")
