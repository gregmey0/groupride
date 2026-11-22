# Group Ride – sorties VTT en groupe

Appli pour rouler en groupe : chacun voit la position des autres sur la carte, en direct.

- **Session** : l'organisateur crée la sortie, les autres la rejoignent par lien, QR code ou code à 12 chiffres.
- **Carte** : tout le groupe en direct, avec positions seules ou positions + traces parcourues. Fonds IGN, OpenTopoMap, CyclOSM, OpenStreetMap ou photo aérienne, le choix est mémorisé.
- **Stats** : distance, vitesse, moyenne en mouvement, vitesse max, temps en mouvement, dénivelé et altitude, pour soi et pour chacun du groupe. Sur un tracé commun, on voit qui est devant ou derrière.
- **Tracés GPX** :
  - l'organisateur propose un ou plusieurs tracés, chacun choisit celui qu'il suit (avancement, D+ restant, profil, alerte hors tracé) ;
  - chacun peut aussi importer son propre GPX : les autres le voient sur leur carte, avec sa position dessus.
- **Messagerie** de groupe, messages rapides, envoi de sa position, alerte « 🆘 Besoin d'aide ».
- **Fin de sortie** : bilan et export de sa trace en GPX.

## Installer

- **Android** : télécharger [GroupRide.apk](../../releases/latest/download/GroupRide.apk) depuis le téléphone, l'ouvrir et autoriser l'installation. Le partage continue téléphone verrouillé, et les messages arrivent en notification.
- **Web (tout téléphone, iPhone compris)** : https://gregmey0.github.io/groupride/ puis « Installer l'appli » / « Sur l'écran d'accueil ». Garder l'écran allumé pendant la sortie.

## Relais et confidentialité

Les échanges passent par un relais MQTT public (HiveMQ, à défaut EMQX). Tout est chiffré de bout en bout (AES-GCM) avec une clé dérivée du code de la sortie : le relais ne voit que des données illisibles. Quand l'organisateur termine la sortie, positions, traces et messages sont effacés du relais.

## Développement

- Sources : `src/js/*.js` (modules concaténés dans l'ordre), `src/style.css`, `src/body.html`, icônes générées par `src/icons/gen_icon.py`.
- `python3 build.py` produit `docs/` (version web, GitHub Pages) et `www/` (contenu de l'appli).
- Android : projet Capacitor dans `android/`. Chaque push sur `main` compile l'APK (GitHub Actions) et le publie dans **Releases**.
- La clé `android/app/groupride-sideload.jks` est volontairement publique : elle sert seulement à ce que chaque nouvelle version s'installe par-dessus la précédente.
- Mode simulation (Réglages) pour tester sans bouger. Pour les tests automatiques, `localStorage['grr.testbroker']` peut désigner un relais local (`ws://localhost:8883`).

Greg Meyer, STAPS Avignon.
