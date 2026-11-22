#!/usr/bin/env python3
"""Manuel d'utilisation Group Ride : HTML mis en page puis imprimé en PDF par Chrome (Playwright).
Captures d'écran dans img/ ; QR codes img/qr_*.svg. Sortie : manuel-group-ride.pdf (copié dans docs/ par build.py)."""
import asyncio, pathlib, re
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).parent
IMG = HERE / "img"
ROOT = HERE.parent
FONTS = ROOT / "node_modules/@fontsource/atkinson-hyperlegible/files"
VERSION = "1.0.2"
WEB = "https://gregmey0.github.io/groupride/"
APK = "https://github.com/gregmey0/groupride/releases/latest/download/GroupRide.apk"

def shot(name, cap="", w=58, extra=""):
    return f'<figure class="fig" style="width:{w}mm">{extra}<img class="shot" src="img/{name}"><figcaption>{cap}</figcaption></figure>'

CSS = f"""
@font-face{{font-family:'Atk';src:url('file://{FONTS}/atkinson-hyperlegible-latin-400-normal.woff2') format('woff2');font-weight:400}}
@font-face{{font-family:'Atk';src:url('file://{FONTS}/atkinson-hyperlegible-latin-700-normal.woff2') format('woff2');font-weight:700}}
@page{{size:A4;margin:15mm 15mm 16mm 15mm}}
*{{box-sizing:border-box}}
html{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{{margin:0;font-family:'Atk','Noto Color Emoji',sans-serif;font-size:11pt;line-height:1.42;color:#1d241b}}
h1,h2,h3{{font-weight:700;line-height:1.2}}
h2{{font-size:19pt;color:#22400a;margin:0 0 4mm;padding-bottom:2mm;border-bottom:3px solid #A3E635;break-after:avoid}}
h2 .n{{display:inline-block;background:#A3E635;color:#111;border-radius:7px;padding:0 2.6mm;margin-right:2.5mm}}
h3{{font-size:13pt;color:#2f5a0e;margin:5mm 0 2mm;break-after:avoid}}
p{{margin:0 0 2.4mm}}
ul,ol{{margin:0 0 3mm;padding-left:6mm}}
li{{margin:0 0 1.3mm}}
b{{color:#111}}
.sec{{break-before:page}}
.pb{{break-before:page;height:0}}
.cols{{display:flex;gap:7mm;align-items:flex-start}}
.cols>.txt{{flex:1;min-width:0}}
.figs{{display:flex;gap:5mm;justify-content:center;flex-wrap:wrap;margin:2mm 0 4mm;break-inside:avoid}}
.fig{{margin:0;break-inside:avoid;position:relative}}
.shot{{width:100%;display:block;border-radius:9px;border:2.2px solid #1b1b1b;box-shadow:0 1.5mm 3.5mm rgba(0,0,0,.22)}}
figcaption{{font-size:8.6pt;color:#555;text-align:center;margin-top:1.6mm;line-height:1.3}}
.call{{border-radius:3mm;padding:3mm 4mm;margin:3mm 0;break-inside:avoid;border-left:2mm solid}}
.call.info{{background:#f1f9e4;border-color:#8cc63f}}
.call.warn{{background:#fff4e0;border-color:#f39c12}}
.call.danger{{background:#fdeaea;border-color:#e74c3c}}
.call p:last-child,.call ul:last-child{{margin-bottom:0}}
table{{border-collapse:collapse;width:100%;margin:2mm 0 4mm;break-inside:avoid;font-size:10.5pt}}
td,th{{border-bottom:1px solid #d8dfd2;padding:1.8mm 2mm;vertical-align:top;text-align:left}}
th{{background:#eef6e2;color:#22400a}}
td.k{{white-space:nowrap;font-weight:700;width:1%}}
.btn{{display:inline-block;border:1.6px solid #222;border-radius:2mm;padding:0 1.8mm;font-weight:700;font-size:9.6pt;background:#fff;white-space:nowrap}}
.btn.p{{background:#A3E635;border-color:#7fb81f}}
.steps{{counter-reset:st;list-style:none;padding:0}}
.steps>li{{counter-increment:st;position:relative;padding-left:10mm;margin-bottom:2.6mm}}
.steps>li::before{{content:counter(st);position:absolute;left:0;top:-.2mm;width:6.8mm;height:6.8mm;border-radius:50%;background:#22400a;color:#fff;font-weight:700;font-size:10pt;display:flex;align-items:center;justify-content:center}}
.stamp{{position:absolute;top:30mm;left:50%;transform:translateX(-50%) rotate(-14deg);background:#e74c3c;color:#fff;font-weight:700;font-size:11pt;padding:1mm 4mm;border-radius:2mm;z-index:2;letter-spacing:.06em;box-shadow:0 1mm 2mm rgba(0,0,0,.3)}}
/* couverture */
.cover{{height:263mm;display:flex;flex-direction:column;background:linear-gradient(170deg,#0E2418 0%,#24502F 62%,#3B7340 100%);color:#fff;border-radius:6mm;padding:18mm 16mm 14mm;position:relative;overflow:hidden}}
.cover .logo{{width:44mm;height:44mm;border-radius:10mm;box-shadow:0 2mm 6mm rgba(0,0,0,.4)}}
.cover h1{{font-size:44pt;margin:9mm 0 0;color:#A3E635}}
.cover .sub{{font-size:20pt;margin:1mm 0 6mm;font-weight:700}}
.cover .lead{{font-size:13pt;max-width:150mm;color:#e6f2dc}}
.cover .inst{{margin-top:auto;display:flex;gap:8mm}}
.cover .box{{flex:1;background:rgba(255,255,255,.96);color:#1d241b;border-radius:4mm;padding:4mm;display:flex;gap:4mm;align-items:center;font-size:10pt;line-height:1.35}}
.cover .box svg{{width:27mm;height:27mm;flex:none}}
.cover .box b{{font-size:12.5pt;display:block;margin-bottom:1mm;color:#22400a}}
.cover .box small{{font-size:8.4pt;color:#555;display:block;margin-top:1.5mm;overflow-wrap:anywhere}}
.cover .box{{min-width:0}}.cover .box>div{{min-width:0}}
.cover .meta{{margin-top:7mm;font-size:9.5pt;color:#cfe3c4}}
.toc{{columns:2;column-gap:10mm;font-size:11pt;padding-left:6mm}}
.toc li{{margin-bottom:1.6mm}}
.grid3{{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:3mm 0 5mm}}
.card{{border:1.5px solid #d3e2c2;border-radius:3mm;padding:3mm;background:#fbfdf8;break-inside:avoid}}
.card b{{display:block;color:#22400a;margin-bottom:1mm}}
.card .e{{font-size:17pt;line-height:1}}
.small{{font-size:9.6pt;color:#555}}
a{{color:#2f6b0e}}
"""

def nb(html):
    """espaces insécables de la typographie française, hors balises"""
    out=[]
    for part in re.split(r'(<[^>]+>)', html):
        if part.startswith('<'):
            out.append(part);continue
        part=re.sub(r' ([:;!?»])', ' \\1', part)
        part=re.sub(r'« ', '« ', part)
        out.append(part)
    return ''.join(out)

qr_web=(IMG/'qr_web.svg').read_text(); qr_apk=(IMG/'qr_apk.svg').read_text()
logo=(ROOT/'src/icons/icon.svg').read_text().replace('<svg ','<svg class="logo" ',1)

BODY = f"""
<section class="cover">
  {logo}
  <h1>Group Ride</h1>
  <div class="sub">Manuel d'utilisation</div>
  <p class="lead">Rouler en groupe en sachant où est chacun : positions en direct sur la carte, statistiques de tout le groupe, tracés GPX partagés, messagerie et alerte « Besoin d'aide ».</p>
  <div class="inst">
    <div class="box">{qr_apk}<div><b>🤖 Android</b>Scanne pour télécharger l'application. Le partage continue téléphone verrouillé.<small>github.com/gregmey0/groupride › Releases</small></div></div>
    <div class="box">{qr_web}<div><b>🍏 iPhone et navigateur</b>Scanne pour ouvrir la version web, puis « Sur l'écran d'accueil ».<small>gregmey0.github.io/groupride</small></div></div>
  </div>
  <p class="meta">Version {VERSION} · novembre 2026 · Greg Meyer, STAPS Avignon Université</p>
</section>

<section class="sec">
  <h2>En bref</h2>
  <div class="grid3">
    <div class="card"><span class="e">🔗</span><b>Une sortie, un code</b>L'organisateur crée la sortie. Les autres la rejoignent par lien, QR code ou code à 12 chiffres.</div>
    <div class="card"><span class="e">🗺</span><b>Tout le monde sur la carte</b>Chacun voit la position des autres en direct, avec ou sans les traces parcourues.</div>
    <div class="card"><span class="e">📊</span><b>Les stats du groupe</b>Distance, vitesse, moyenne, dénivelé… pour soi et pour chacun, et qui est devant ou derrière.</div>
    <div class="card"><span class="e">🧭</span><b>Tracés GPX</b>Tracés proposés par l'organisateur ou tracé perso de chacun : avancement, D+ restant, alerte hors tracé.</div>
    <div class="card"><span class="e">💬</span><b>Messagerie du groupe</b>Messages libres, messages rapides, envoi de sa position.</div>
    <div class="card"><span class="e">🆘</span><b>Besoin d'aide</b>Une alerte qui sonne chez tout le monde, avec ta position.</div>
  </div>
  <h3>Sommaire</h3>
  <ol class="toc">
    <li>Installer l'application</li><li>Créer une sortie (organisateur)</li><li>Rejoindre une sortie</li><li>La carte</li>
    <li>Les statistiques</li><li>Les tracés GPX</li><li>Messages et alerte « Besoin d'aide »</li><li>Menu et fin de sortie</li>
    <li>Réglages</li><li>Conseils et dépannage</li>
  </ol>
  <h3>Ce qu'il faut</h3>
  <ul>
    <li>Un smartphone avec GPS et une connexion mobile (4G/5G). En zone blanche, l'appli continue d'enregistrer et envoie tout au retour du réseau.</li>
    <li>Le lien, le QR code ou le code de la sortie, donné par l'organisateur.</li>
    <li>Aucun compte à créer : un prénom suffit.</li>
  </ul>
  <div class="call info"><p><b>Confidentialité.</b> Positions, traces et messages passent par un relais internet public, mais ils sont chiffrés avec une clé tirée du code de la sortie : sans le code, personne ne peut les lire. Quand l'organisateur termine la sortie, tout est effacé du relais.</p></div>
</section>

<section class="sec">
  <h2><span class="n">1</span>Installer l'application</h2>
  <div class="cols"><div class="txt">
    <h3>🤖 Sur Android : l'application</h3>
    <ol class="steps">
      <li>Sur le téléphone, ouvre le lien de téléchargement (QR code de la couverture) : <b>GroupRide.apk</b> se télécharge.</li>
      <li>Ouvre le fichier. Android demande d'autoriser l'installation depuis le navigateur ou les fichiers : accepte, puis <span class="btn">Installer</span>.</li>
      <li>Au premier lancement, autorise la <b>position précise</b> (« Toujours » si Android le propose) et les <b>notifications</b>.</li>
    </ol>
    <p>L'application continue à partager ta position <b>téléphone verrouillé</b>, dans la poche ou le sac à dos. Une notification « Group Ride – position partagée » le rappelle. Les messages du groupe arrivent aussi en notification.</p>
    <div class="call warn"><p><b>Important sur certains Android</b> (Samsung, Xiaomi, Huawei…) : désactive l'optimisation de batterie pour Group Ride, sinon le téléphone peut couper le partage écran éteint. <i>Paramètres › Applications › Group Ride › Batterie › Sans restriction</i>.</p></div>
    <p class="small">Mise à jour : retélécharge GroupRide.apk et installe-le par-dessus. Tes réglages et ta dernière sortie sont conservés.</p>
    <h3>🍏 Sur iPhone (et tout autre téléphone) : la version web</h3>
    <ol class="steps">
      <li>Ouvre <b>gregmey0.github.io/groupride</b> dans <b>Safari</b> (QR code de la couverture).</li>
      <li>Touche <span class="btn">Partager ⬆︎</span> puis <span class="btn">Sur l'écran d'accueil</span>. Group Ride s'ouvre ensuite comme une appli, en plein écran.</li>
      <li>Au premier usage, autorise la position. La boussole s'autorise dans les Réglages de l'appli.</li>
    </ol>
    <div class="call warn"><p><b>Sur iPhone, l'écran doit rester allumé</b> pendant la sortie : le verrouiller coupe le partage de position. Group Ride essaie d'empêcher la mise en veille ; si l'écran s'éteint quand même, règle <i>Réglages › Luminosité et affichage › Verrouillage automatique › Jamais</i> le temps de la sortie.</p></div>
  </div>
  {shot('home_android.jpg','Accueil. Sur Android dans le navigateur, un bandeau propose l\'application.',54)}
  </div>
</section>

<section class="sec">
  <h2><span class="n">2</span>Créer une sortie (organisateur)</h2>
  <ol class="steps">
    <li>Sur l'accueil, touche <span class="btn p">➕ Créer une sortie</span>.</li>
    <li>Donne un <b>nom</b> à la sortie et indique ton <b>prénom</b> : c'est lui qui s'affiche sur la carte des autres.</li>
    <li><i>Facultatif</i> : <span class="btn">📂 Ajouter des GPX</span> pour proposer un ou plusieurs tracés. Tu pourras aussi en ajouter pendant la sortie.</li>
    <li>Touche <span class="btn p">📡 Créer la sortie</span>. L'écran <b>Inviter</b> s'ouvre : montre le QR code, envoie le lien (WhatsApp, SMS, mail…) avec <span class="btn p">📤 Envoyer le lien</span>, ou dicte le code à 12 chiffres.</li>
  </ol>
  <div class="figs">{shot('create.jpg','Créer une sortie, avec un tracé proposé',56)}{shot('invite.jpg','Inviter : QR code, code et lien',56,'<span class="stamp">EXEMPLE</span>')}</div>
  <div class="call info"><p><b>Le rôle de l'organisateur.</b> Il est aussi un participant (sa position est partagée), et il est le seul à pouvoir proposer ou retirer des tracés pour tout le groupe et <b>terminer la sortie pour tous</b>. L'invitation reste accessible à tout moment : ☰ Menu › <b>Inviter</b>.</p></div>
</section>

<section class="sec">
  <h2><span class="n">3</span>Rejoindre une sortie</h2>
  <div class="cols"><div class="txt">
    <p>Trois façons de rejoindre, au choix :</p>
    <ul>
      <li><b>QR code</b> : scanne-le avec l'appareil photo du téléphone. La page de la sortie s'ouvre directement.</li>
      <li><b>Lien</b> reçu par message : touche-le.</li>
      <li><b>Code</b> : dans Group Ride, <span class="btn">🔗 Rejoindre une sortie</span>, tape les 12 chiffres. La recherche part toute seule.</li>
    </ul>
    <p>La fiche de la sortie s'affiche (nom, organisateur, tracés proposés). Ensuite :</p>
    <ol class="steps">
      <li>Indique ton <b>prénom</b>.</li>
      <li>Choisis le <b>tracé que tu suis</b> : un tracé proposé par l'organisateur (présélectionné s'il n'y en a qu'un), <b>📂 Mon propre GPX…</b>, ou <b>Aucun pour l'instant</b>.</li>
      <li>Touche <span class="btn p">✔ Rejoindre la sortie</span>.</li>
    </ol>
    <div class="call info"><p><b>Android, depuis un QR code ou un lien :</b> si l'application est installée, le bouton <span class="btn">📱 Ouvrir dans l'application</span> l'ouvre directement sur la bonne sortie.</p></div>
    <p class="small">Si l'appli se ferme pendant la sortie (batterie, fausse manœuvre), rouvre-la : elle reprend la sortie toute seule, avec ta trace et tes stats.</p>
  </div>
  {shot('join.jpg','Rejoindre : prénom et tracé suivi',58)}
  </div>
</section>

<section class="sec">
  <h2><span class="n">4</span>La carte</h2>
  <div class="cols"><div class="txt">
    <h3>Le bandeau du haut</h3>
    <table>
      <tr><td class="k">👥 6</td><td>Nombre de participants dans la sortie.</td></tr>
      <tr><td class="k">±4 m</td><td>Précision du GPS : vert (bonne), orange (moyenne), rouge (mauvaise), gris (recherche).</td></tr>
      <tr><td class="k">📡</td><td>Connexion au relais. <b>📡✖</b> : hors ligne, tout partira au retour du réseau.</td></tr>
    </table>
    <h3>Ce que tu vois</h3>
    <ul>
      <li><b>Toi</b> : le rond bleu avec une flèche dans ton sens de déplacement.</li>
      <li><b>Les autres</b> : un rond de couleur avec leurs initiales et leur prénom. Estompé avec ⏳ : pas de nouvelles depuis plus de 2 minutes (zone blanche, téléphone éteint). Rouge clignotant : demande d'aide.</li>
      <li><b>Le tracé que tu suis</b> : épais, magenta, avec le départ ▶ et l'arrivée 🏁. Les autres tracés proposés sont plus fins.</li>
      <li><b>Les tracés perso des autres</b> : en pointillés, à leur couleur.</li>
      <li><b>Les traces parcourues</b> : la ligne de couleur derrière chacun.</li>
    </ul>
    <p>En haut à gauche, deux étiquettes résument ta sortie (distance, vitesse, moyenne) et ton avancement sur le tracé.</p>
  </div>
  {shot('map_all.jpg','Toute la sortie : chacun sur le tracé, Léa sur sa variante, Julien sans nouvelles depuis 4 min',62)}
  </div>
  <div class="pb"></div><h3>Les boutons de la carte</h3>
  <table>
    <tr><td class="k">🎯</td><td><b>Me suivre</b> : la carte reste centrée sur toi. Dès que tu la déplaces avec le doigt, elle arrête de te suivre ; 🎯 la recentre.</td></tr>
    <tr><td class="k">👥</td><td><b>Tout le groupe</b> : cadre la carte sur tous les participants.</td></tr>
    <tr><td class="k">〰</td><td><b>Positions seules</b> ou <b>positions + traces parcourues</b> (bouton cerclé de vert).</td></tr>
    <tr><td class="k">🗂</td><td><b>Fond de carte</b> : IGN Plan, Relief (OpenTopoMap), Vélo / VTT (CyclOSM), OpenStreetMap ou Photo aérienne. Le choix reste enregistré.</td></tr>
    <tr><td class="k">🧭</td><td><b>Tracés GPX</b> : choisir, proposer ou importer un tracé (chapitre 6).</td></tr>
  </table>
  <div class="figs">{shot('rider_c.jpg','Touche un participant : sa fiche',56)}{shot('layers_c.jpg','🗂 Fond de carte et affichage',56)}</div>
  <p>En bas, quatre onglets : <span class="btn">🗺 Carte</span> <span class="btn">📊 Stats</span> <span class="btn">💬 Messages</span> (une pastille rouge compte les messages non lus) et <span class="btn">☰ Menu</span>.</p>
</section>

<section class="sec">
  <h2><span class="n">5</span>Les statistiques</h2>
  <div class="figs">{shot('stats_top.jpg','Mes stats et le tracé suivi',50)}{shot('stats_group.jpg','Profil du tracé et le groupe',50)}</div>
  <table>
    <tr><th colspan="2">Moi</th></tr>
    <tr><td class="k">Distance</td><td>Distance parcourue depuis que tu as rejoint la sortie.</td></tr>
    <tr><td class="k">Vitesse</td><td>Vitesse du moment.</td></tr>
    <tr><td class="k">Moyenne en mouvement</td><td>Distance ÷ temps en mouvement : les arrêts ne la font pas baisser.</td></tr>
    <tr><td class="k">Vitesse max</td><td>Vitesse la plus élevée, filtrée pour ignorer les sauts du GPS.</td></tr>
    <tr><td class="k">Temps en mouvement</td><td>Temps passé à plus de 3 km/h environ.</td></tr>
    <tr><td class="k">Durée totale</td><td>Temps écoulé depuis que tu as rejoint la sortie, pauses comprises.</td></tr>
    <tr><td class="k">Dénivelé, altitude</td><td>Calculés à partir du GPS du téléphone : ce sont des estimations, à 10 ou 20 m près.</td></tr>
  </table>
  <p><b>Tracé suivi</b> : kilomètres faits sur le total, pourcentage, distance et D+ restants, et le <b>profil</b> du tracé avec ta position (point bleu) et celle des autres qui suivent le même tracé (points de couleur).</p>
  <p><b>Le groupe</b> : pour chacun, distance, moyenne et D+, son avancement sur son tracé, et à droite où il est par rapport à toi : « 1,2 km devant / derrière sur le tracé » si vous suivez le même, sinon la distance à vol d'oiseau. Dessous : l'âge de sa dernière position (⚠ si plus de 2 min) et sa batterie quand le téléphone la donne. Touche une ligne pour ouvrir sa fiche.</p>
</section>

<section class="sec">
  <h2><span class="n">6</span>Les tracés GPX</h2>
  <div class="cols"><div class="txt">
    <p>Le bouton 🧭 de la carte (ou ☰ Menu › Tracés GPX) ouvre la gestion des tracés.</p>
    <h3>Option 1 : les tracés de la sortie (organisateur)</h3>
    <p>L'organisateur propose un ou plusieurs GPX, à la création ou pendant la sortie avec <span class="btn">📂 Proposer des tracés (GPX)</span>. Tout le monde les reçoit (« 🧭 Nouveau tracé proposé ») et chacun touche <span class="btn p">Suivre</span> pour choisir le sien. L'organisateur peut retirer un tracé avec 🗑.</p>
    <h3>Option 2 : mon tracé personnel</h3>
    <p><span class="btn">📂 Importer mon tracé (GPX)</span> : choisis ton fichier, puis décide de le suivre ou seulement de le partager. Les autres le voient en <b>pointillés à ta couleur</b>, avec ta position dessus et ton avancement en km. Dans « Tracés des autres », <span class="btn">Suivre</span> permet de prendre le tracé d'un autre participant.</p>
  </div>
  {shot('routes.jpg','🧭 Tracés GPX',58)}
  </div>
  <h3>Suivre un tracé</h3>
  <ul>
    <li><b>Avant d'y arriver</b> (trajet depuis le parking) : l'étiquette indique « tracé à 800 m, rejoins-le ». Pas d'alerte pendant ce temps.</li>
    <li><b>Sur le tracé</b> : kilomètres faits et restants, D+ restant, profil, et ta position vue par les autres.</li>
    <li><b>Hors tracé</b> : si tu t'écartes de plus de 50 m (réglable) pendant 8 secondes, le téléphone sonne et vibre, et l'étiquette passe au rouge. « ✔ De retour sur le tracé » quand tu le retrouves.</li>
    <li><b>Fin du tracé</b> : un message s'affiche à l'arrivée.</li>
  </ul>
  <div class="call info"><p><b>Où trouver des GPX ?</b> Komoot, Strava, Visorando, OpenRunner, Garmin Connect… : utilise « Exporter en GPX » ou « Télécharger le GPX ». Un fichier reçu par WhatsApp ou mail fonctionne aussi : enregistre-le d'abord dans le téléphone. Les gros fichiers sont simplifiés automatiquement, sans perte visible.</p></div>
</section>

<section class="sec">
  <h2><span class="n">7</span>Messages et alerte « Besoin d'aide »</h2>
  <div class="cols"><div class="txt">
    <h3>La messagerie</h3>
    <p>L'onglet <span class="btn">💬 Messages</span> réunit tout le groupe. Écris en bas et touche ➤. Les nouveaux venus voient aussi les messages précédents.</p>
    <p><b>Messages rapides</b> (à faire défiler sous la conversation) :</p>
    <table>
      <tr><td class="k">👍 Tout va bien</td><td>Rassure le groupe, et lève ta demande d'aide si tu en avais fait une.</td></tr>
      <tr><td class="k">⏸ Pause</td><td>Tu t'arrêtes un moment.</td></tr>
      <tr><td class="k">⏳ Attendez-moi</td><td>Tu es décroché.</td></tr>
      <tr><td class="k">🔧 Problème mécanique</td><td>Crevaison, chaîne…</td></tr>
      <tr><td class="k">↩ Je rentre</td><td>Tu abandonnes ou tu coupes.</td></tr>
      <tr><td class="k">📍 Ma position</td><td>Envoie ta position. Les autres touchent « Voir sur la carte ».</td></tr>
    </table>
    <p>À l'arrivée d'un message : son, vibration et aperçu. Sur Android, notification même téléphone verrouillé.</p>
  </div>
  {shot('chat.jpg','La messagerie du groupe',58)}
  </div>
  <div class="pb"></div><div class="cols"><div class="txt">
    <h3>🆘 Besoin d'aide</h3>
    <p>Le dernier message rapide, en rouge. Après confirmation :</p>
    <ul>
      <li>tous les téléphones sonnent et vibrent ;</li>
      <li>un bandeau rouge s'affiche chez tout le monde, avec la distance qui vous sépare. Le toucher centre la carte sur toi ;</li>
      <li>ton rond devient rouge et clignote sur leur carte.</li>
    </ul>
    <p>Quand tout est réglé, touche le bandeau « Tu as demandé de l'aide : appuie ici quand tout va bien », ou envoie 👍 Tout va bien. Sans action, l'alerte s'efface d'elle-même au bout de 45 minutes.</p>
    <div class="call danger"><p><b>Group Ride ne remplace pas les secours.</b> En cas d'accident sérieux, appelle le <b>112</b> (ou le 15) : l'alerte sert à prévenir le groupe et à le guider jusqu'à toi.</p></div>
  </div>
  {shot('sos.jpg','Sophie a demandé de l\'aide',58)}
  </div>
</section>

<section class="sec">
  <h2><span class="n">8</span>Menu et fin de sortie</h2>
  <div class="cols"><div class="txt">
    <table>
      <tr><td class="k">🔗 Inviter</td><td>QR code, code et lien de la sortie.</td></tr>
      <tr><td class="k">🧭 Tracés GPX</td><td>Voir chapitre 6.</td></tr>
      <tr><td class="k">🗂 Fond de carte</td><td>Fond et affichage des traces.</td></tr>
      <tr><td class="k">⬇ Exporter ma trace</td><td>Ta trace en GPX, à envoyer ou à importer dans Strava, Komoot, Garmin Connect…</td></tr>
      <tr><td class="k">⬇ Traces du groupe</td><td><i>Organisateur</i> : les traces de tout le monde dans un seul GPX.</td></tr>
      <tr><td class="k">⏹ Terminer pour tous</td><td><i>Organisateur</i> : arrête le partage sur tous les téléphones, puis efface positions, traces et messages du relais.</td></tr>
      <tr><td class="k">🚪 Quitter la sortie</td><td>Arrête le partage de ta position. La sortie continue pour les autres.</td></tr>
    </table>
    <p>Que tu quittes ou que l'organisateur termine, le <b>bilan</b> s'affiche : distance, temps en mouvement, moyenne, vitesse max, durée, dénivelé, et ta trace en GPX (<span class="btn">⬇ Ma trace GPX</span> ou <span class="btn">📤 Partager</span>). Il reste accessible sur l'accueil : <b>📊 Dernière sortie</b>.</p>
  </div>
  <div>{shot('menu_c.jpg','☰ Menu (organisateur)',54)}<div style="height:4mm"></div>{shot('bilan_c.jpg','Le bilan de la sortie',54)}</div>
  </div>
</section>

<section class="sec">
  <h2><span class="n">9</span>Réglages</h2>
  <div class="cols"><div class="txt">
    <p>Accessibles depuis l'accueil (<span class="btn">⚙ Réglages</span>) ou pendant la sortie (☰ Menu).</p>
    <table>
      <tr><td class="k">Fond de carte</td><td>Celui utilisé par défaut.</td></tr>
      <tr><td class="k">Traces parcourues</td><td>Positions + traces, ou positions seules.</td></tr>
      <tr><td class="k">Tracés perso des autres</td><td>Les afficher ou non.</td></tr>
      <tr><td class="k">Alerte hors tracé</td><td>Activée ou non, et l'écart qui la déclenche : 30, 50, 100 ou 200 m.</td></tr>
      <tr><td class="k">Son, vibrations</td><td>Pour les messages et les alertes.</td></tr>
      <tr><td class="k">Notifications</td><td><i>Android</i> : messages en notification téléphone verrouillé.</td></tr>
      <tr><td class="k">Boussole</td><td><i>iPhone</i> : l'autoriser pour orienter ta flèche à l'arrêt.</td></tr>
      <tr><td class="k">Mode simulation</td><td>Pour découvrir l'appli chez soi : ta position se déplace avec des flèches, ou « 🚴 Rouler » avance tout seul. À désactiver avant de partir !</td></tr>
    </table>
  </div>
  {shot('settings.jpg','Réglages',56)}
  </div>
</section>

<section class="sec">
  <h2><span class="n">10</span>Conseils et dépannage</h2>
  <h3>Avant de partir</h3>
  <ul>
    <li>Fais créer la sortie au parking et rejoindre tout le monde <b>avant le départ</b>, en zone couverte.</li>
    <li>Vérifie le compteur 👥 : tout le monde doit y être.</li>
    <li>Charge ton téléphone. Le GPS consomme, et beaucoup plus écran allumé (iPhone, navigateur) qu'avec l'appli Android écran éteint. Pour une longue sortie, emporte une batterie externe.</li>
  </ul>
  <h3>Questions fréquentes</h3>
  <table>
    <tr><th>Problème</th><th>Solution</th></tr>
    <tr><td class="k">Je ne vois personne</td><td>Regarde 📡 dans le bandeau : s'il est barré, tu es hors réseau, ça repartira tout seul. Vérifie que tout le monde a bien le même code.</td></tr>
    <tr><td class="k">Un participant est estompé ⏳</td><td>Pas de nouvelles depuis plus de 2 min : zone blanche, téléphone éteint, ou appli coupée. Sa dernière position reste affichée.</td></tr>
    <tr><td class="k">Mon partage s'arrête écran éteint</td><td><i>Android</i> : utilise l'application (pas le navigateur) et désactive l'optimisation de batterie (chapitre 1). <i>iPhone</i> : garde l'écran allumé.</td></tr>
    <tr><td class="k">Position imprécise</td><td>Le badge ±m en haut l'indique. Attends quelques secondes à découvert ; sous forêt dense ou en gorge, la précision baisse.</td></tr>
    <tr><td class="k">L'appli s'est fermée</td><td>Rouvre-la : elle revient seule dans la sortie, avec ta trace et tes stats.</td></tr>
    <tr><td class="k">« Sortie introuvable »</td><td>Code mal saisi, pas de réseau, ou sortie déjà terminée par l'organisateur.</td></tr>
    <tr><td class="k">Alerte hors tracé trop sensible</td><td>Réglages › Écart avant l'alerte : passe à 100 m, ou désactive-la.</td></tr>
    <tr><td class="k">Altitude un peu fausse</td><td>Normal : le GPS donne l'altitude à 10 à 20 m près. Le dénivelé reste une estimation.</td></tr>
  </table>
  <div class="call info"><p><b>Une idée, un souci ?</b> Group Ride est développé pour le club et le STAPS d'Avignon. Fais remonter tes retours à Greg : ils servent à améliorer l'appli.</p></div>
</section>
"""

HTML = f"<!DOCTYPE html><html lang='fr'><head><meta charset='utf-8'><title>Group Ride – Manuel d'utilisation</title><style>{CSS}</style></head><body>{nb(BODY)}</body></html>"
(HERE / "manuel.html").write_text(HTML)

FOOT = ("<div style='font-family:sans-serif;font-size:7.5pt;color:#8a8f86;width:100%;padding:0 15mm;display:flex;justify-content:space-between'>"
        "<span>Group Ride · Manuel d'utilisation · version " + VERSION + "</span><span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>")

async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path="/usr/bin/google-chrome")
        p = await br.new_page()
        await p.goto((HERE / "manuel.html").as_uri(), wait_until="networkidle")
        await p.evaluate("document.fonts.ready")
        await p.pdf(path=str(HERE / "manuel-group-ride.pdf"), format="A4", print_background=True,
                    margin={"top": "15mm", "bottom": "16mm", "left": "15mm", "right": "15mm"},
                    display_header_footer=True, header_template="<div></div>", footer_template=FOOT)
        await br.close()
asyncio.run(main())
print("PDF OK")
