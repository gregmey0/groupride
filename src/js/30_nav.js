/* ---------------- Navigation ---------------- */
let current='home';
const leaveHooks={join:()=>Join.leave()};
function show(id){
  if(id===current)return;
  if(leaveHooks[current])leaveHooks[current]();
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  const prev=current;current=id;window.scrollTo(0,0);
  if(id!=='home'&&prev==='home')try{history.pushState({s:id},'')}catch(e){}
  const h=$('#'+id+' h1');if(h&&id!=='ride')setTimeout(()=>h.focus({preventScroll:true}),30);
  if(id==='home')Home.render();
  if(id==='ride')Ride.onShow();
}
function goBack(){if(current==='settings'||current==='help'){show(Ride.on?'ride':'home');return}show('home')}
window.addEventListener('popstate',()=>{
  if(current==='home')return;
  try{history.pushState({s:current},'')}catch(e){}
  if(Sheet.open){Sheet.hide();return}
  if($('#modal').classList.contains('show'))return;
  if(current==='ride'){if(Ride.tab!=='map')Ride.setTab('map');else toast('La sortie continue. Pour la quitter : ☰ Menu › Quitter la sortie.');return}
  goBack();
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-back]');if(b)goBack()});
function applySimUI(){$('#simBanner').hidden=!settings.sim;document.body.classList.toggle('sim',!!settings.sim)}

/* Feuille plein écran réutilisable */
const Sheet={open:false,onClose:null,
  show(title,node,onClose){if(this.open)this.hide();$('#sheetTitle').textContent=title;const b=$('#sheetBody');b.innerHTML='';if(typeof node==='string')b.innerHTML=node;else b.appendChild(node);this.onClose=onClose||null;$('#sheet').hidden=false;this.open=true;setTimeout(()=>$('#sheetTitle').focus(),50);return b},
  hide(){if(!this.open)return;$('#sheet').hidden=true;this.open=false;const f=this.onClose;this.onClose=null;if(f)f()}
};
$$('.sheetClose').forEach(b=>b.onclick=()=>Sheet.hide());

/* ---------------- Accueil ---------------- */
const Home={deferred:null,
  render(){
    const w=[];
    if(!NATIVE&&!window.isSecureContext)w.push('Le GPS ne fonctionne que si l\'appli est ouverte en <b>https</b>.');
    $('#homeWarn').innerHTML=w.map(x=>`<div class="warnbox">${x}</div>`).join('')+(IOS&&!STANDALONE&&!NATIVE?`<div class="ioshint">📲 Sur iPhone : touche <span class="shr">Partager ⬆︎</span> en bas de Safari, puis « Sur l'écran d'accueil ». Group Ride s'ouvrira ensuite comme une appli, en plein écran.</div>`:'')
      +(ANDROID&&!NATIVE?`<div class="apkhint">🤖 Sur Android, l'<a href="${APP.apk}">application</a> continue à partager ta position téléphone verrouillé.</div>`:'')
      +(IOS&&!NATIVE&&APP.testflight?`<div class="apkhint">🍏 Sur iPhone, l'<a href="${APP.testflight}">application (TestFlight)</a> continue à partager ta position téléphone verrouillé.</div>`:'');
    let h='';
    const act=store.get(K.active,null);if(act)h+=`<button class="primary big" id="hResume">⏯ Revenir à la sortie<small>${esc(act.sname||'')}</small></button>`;
    const last=store.get(K.last,null);if(last&&!act)h+=`<button type="button" id="hLast">📊 Dernière sortie<small>${esc(last.name)} · ${new Date(last.start).toLocaleDateString('fr-FR')} · ${fmtDist(last.stats.dist)}</small></button>`;
    $('#homeExtra').innerHTML=h;
    const r=$('#hResume');if(r)r.onclick=()=>Ride.resume();
    const l=$('#hLast');if(l)l.onclick=()=>Summary.open(store.get(K.last,null));
    $('#hVersion').textContent='Version '+VERSION+(NATIVE?(IOS?' · application iPhone':' · application Android'):'')+' · Greg Meyer, STAPS Avignon';
  }
};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();Home.deferred=e;$('#hInstall').hidden=false});
$('#hInstall').onclick=async()=>{if(!Home.deferred)return;Home.deferred.prompt();try{await Home.deferred.userChoice}catch(e){}Home.deferred=null;$('#hInstall').hidden=true};
$('#hCreate').onclick=()=>Create.open();
$('#hJoin').onclick=()=>Join.open();
$('#hSettings').onclick=()=>Settings.open();
$('#hHelp').onclick=()=>show('help');

/* ---------------- Réglages ---------------- */
const Settings={open(){bindSettings();show('settings')}};
function bindSettings(){
  const sel=$('#setLayer');sel.innerHTML=Object.entries(LAYERS).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join('');
  $$('#settingsBox [data-s]').forEach(el=>{
    const k=el.dataset.s;
    if(el.type==='checkbox'){el.checked=!!settings[k];el.onchange=()=>{settings[k]=el.checked;saveSettings();onSetting(k)}}
    else{el.value=String(settings[k]);el.onchange=()=>{settings[k]=('num' in el.dataset)?parseFloat(el.value):el.value;saveSettings();onSetting(k)}}
  });
}
function onSetting(k){
  if(k==='layer')allMaps.forEach(setMapStyle);
  if(k==='sim'){applySimUI();GPS.stop();toast(settings.sim?'Mode simulation activé':'Mode simulation désactivé : retour au vrai GPS');if(Ride.on)GPS.start()}
  if(k==='notif'&&settings.notif)ensureNotifPermission();
  if(Ride.on)Ride.dirtyView(true);
}

/* ---------------- Bilan d'une sortie ---------------- */
const Summary={
  open(sm){
    if(!sm)return;const s=sm.stats,el=Math.max(0,(sm.end||Date.now())-sm.start);
    const box=document.createElement('div');
    box.innerHTML=`<p><b>${esc(sm.name)}</b></p><p class="hint">${new Date(sm.start).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · ${hhmm(sm.start)} – ${hhmm(sm.end||Date.now())}</p>
      <div class="tiles">${tile('Distance',fmtKm(s.dist),'km')}${tile('Temps en mouvement',fmtTime(s.mov),'')}${tile('Moyenne en mouvement',kmh(s.mov>0?s.dist/(s.mov/1000):null),'km/h')}${tile('Vitesse max',kmh(s.vmax),'km/h')}${tile('Durée totale',fmtTime(el),'')}${tile('Dénivelé',s.gain!=null?'+'+Math.round(s.gain)+' / −'+Math.round(s.loss):'—','m')}</div>
      <div class="row"><button type="button" id="smSave">⬇ Ma trace GPX</button><button type="button" id="smShare">📤 Partager</button></div>`;
    Sheet.show('Bilan de la sortie',box);
    const gpx=()=>trackToGPX(sm.name+' – '+(sm.me||''),[{name:sm.me||'Ma trace',pts:decTrack(sm.track)}]),fn=slug('groupride_'+sm.name)+'.gpx';
    $('#smSave').onclick=()=>{if(!sm.track){toast('Pas de trace enregistrée.',true);return}saveFile(fn,gpx())};
    $('#smShare').onclick=()=>{if(!sm.track){toast('Pas de trace enregistrée.',true);return}shareFile(fn,gpx())};
  }
};
function tile(label,val,unit,cls){return`<div class="tile ${cls||''}"><span>${label}</span><b>${val}<small>${unit?' '+unit:''}</small></b></div>`}
