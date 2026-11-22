/* ---------------- Démarrage ---------------- */
applySimUI();Home.render();
if(!Compass.needsPerm)Compass.enable();
try{history.replaceState({s:'home'},'')}catch(e){}
if(!NATIVE&&'serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
const joinHash=()=>{const m=/^#join-([0-9-]+)/.exec(location.hash);if(!m)return null;try{history.replaceState({s:'home'},'',location.pathname+location.search)}catch(e){}return m[1]};
window.addEventListener('hashchange',()=>{const c=joinHash();if(c)Join.open(c)});
/* application (Android, iPhone) ouverte par un lien groupride://join-CODE (bouton de la page web) */
const linkCode=u=>{const c=normCode(u||'');return validCode(c)?c:null};
if(NATIVE&&P.app){try{P.app.addListener('appUrlOpen',e=>{const c=linkCode(e&&e.url);if(c)Join.open(c)})}catch(e){}}
$('#compassBtn').onclick=async()=>{const ok=await Compass.enable();toast(ok?'Boussole activée':'Boussole refusée ou indisponible',!ok)};
$('#compassBtn').hidden=!Compass.needsPerm;
(async()=>{
  const c=joinHash();
  if(store.get(K.active,null)){await Ride.resume();if(c&&Ride.on&&normCode(c)!==Ride.code)toast('Tu es déjà dans une sortie : quitte-la d\'abord pour en rejoindre une autre.',true);return}
  if(c){Join.open(c);return}
  if(NATIVE&&P.app){try{const r=await P.app.getLaunchUrl();const lc=r&&linkCode(r.url);if(lc){Join.open(lc);return}}catch(e){}}
})();
window.GroupRide={GPS,Ride,RideMap,Stats,Chat,Routes,Join,Create,SessionLink,Mqtt,deriveKey,seal,unseal,newCode,normCode,validCode,fmtCode,parseRouteGPX,makeRoute,routeLocate,encRoute,decRoute,encTrack,decTrack,settings:()=>settings,store,K,BROKERS};
