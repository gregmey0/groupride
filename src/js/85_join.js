/* ---------------- Créer une sortie ---------------- */
const Create={routes:[],
  open(){
    if(Ride.on){show('ride');return}
    this.routes=[];show('create');
    $('#cName').value='Sortie VTT – '+new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    $('#cMe').value=store.get(K.me,'');this.list();
  },
  list(){
    $('#cRoutes').innerHTML=this.routes.map((r,i)=>`<li><span><b>${esc(r.name)}</b><small>${fmtKm(r.L)} km${r.gain!=null?' · D+ '+r.gain+' m':''}</small></span><button type="button" class="mini danger" data-rm="${i}" aria-label="Retirer ${esc(r.name)}">🗑</button></li>`).join('');
  },
  async add(){const rs=await pickGPX(true);this.routes.push(...rs);this.list()},
  async go(){
    const name=$('#cMe').value.trim();if(!name){toast('Indique ton prénom : il s\'affiche sur la carte des autres.',true);$('#cMe').focus();return}
    store.set(K.me,name);Snd.unlock();
    const broker=await pickBroker($('#cGo'));if(!broker)return;
    const code=newCode(broker),{key,tid}=await deriveKey(code),m=new Mqtt(BROKERS[broker]);
    const link={code,key,base:'grr/v1/'+tid,m,session:null,connected:false,onSession:null,onState:null,close(){m.close()}};
    m.onstate=c=>{link.connected=c;if(link.onState)link.onState(c)};
    m.onMessage(async(topic,pl)=>{if(topic!==link.base+'/s')return;let s=null;if(!pl.length)s={status:'deleted'};else try{s=await unseal(key,pl)}catch(e){return}link.session=s;if(link.onSession)link.onSession(s)});
    m.subscribe(link.base+'/s');m.connect();
    const session={name:$('#cName').value.trim()||'Sortie VTT',created:new Date().toISOString(),status:'open'};
    const routes=this.routes.slice();
    Ride.begin({link,name,isOrg:true,session,routes,follow:routes.length===1?{k:'org',id:routes[0].id}:null});
    Invite.open();
  }
};
$('#cAddGpx').onclick=()=>Create.add();
$('#cRoutes').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(b){Create.routes.splice(+b.dataset.rm,1);Create.list()}});
$('#cGo').onclick=()=>Create.go();

/* ---------------- Rejoindre une sortie ---------------- */
const Join={link:null,stream:null,own:null,
  open(code){
    if(Ride.on){if(code&&normCode(code)!==Ride.code)toast('Tu es déjà dans une sortie : quitte-la d\'abord (☰ Menu).',true);show('ride');return}
    show('join');this.own=null;this.appBtn(code);$('#jCode').value=code?fmtCode(normCode(code)):'';$('#jName').value=store.get(K.me,'');
    $('#jInfo').innerHTML='';$('#jConfirm').hidden=true;$('#jScan').hidden=!('BarcodeDetector' in window&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
    if(code)this.lookup();
  },
  /* page web sur Android : proposer d'ouvrir l'application (partage téléphone verrouillé) */
  appBtn(code){
    const c=normCode(code||''),noapp=/[?&]noapp=1/.test(location.search),ok=!NATIVE&&ANDROID&&validCode(c);
    $('#jApp').hidden=!ok||noapp;$('#jAppNo').hidden=!ok||!noapp;
    if(ok)$('#jApp').onclick=()=>{location.href=appIntent(c)};
  },
  leave(){this.stopScan();if(this.link){this.link.close();this.link=null}},
  async lookup(){
    const code=normCode($('#jCode').value);
    if(!validCode(code)){toast('Code invalide : il faut les 12 chiffres, par exemple 148 291 355 720',true);return}
    $('#jCode').value=fmtCode(code);$('#jConfirm').hidden=true;this.appBtn(code);$('#jInfo').innerHTML='<p class="card">⏳ Recherche de la sortie…</p>';
    if(this.link){this.link.close();this.link=null}
    let link=null;try{link=await SessionLink.connect(code)}catch(e){}
    if(current!=='join'){if(link)link.close();return}
    if(!link){$('#jInfo').innerHTML='<p class="warnbox">Sortie introuvable : vérifie le code et la connexion internet.</p>';return}
    const s=link.session;
    if(s.status!=='open'){link.close();$('#jInfo').innerHTML='<p class="warnbox">Cette sortie est terminée.</p>';return}
    this.link=link;
    const rs=s.routes||[];
    $('#jInfo').innerHTML=`<section class="card"><h2>${esc(s.name)}</h2><p>Organisée par <b>${esc(s.orgName||'?')}</b>${rs.length?` · ${rs.length} tracé${rs.length>1?'s':''} proposé${rs.length>1?'s':''}`:''}</p>
      <p class="hint">En rejoignant, ta position, ta trace et tes stats sont partagées avec le groupe (chiffrées) jusqu'à ce que tu quittes la sortie.</p><p class="hint web-only">Sur navigateur, garde l'écran allumé : le verrouiller coupe le partage. L'appli Android, elle, continue téléphone verrouillé.</p></section>`;
    const sel=$('#jRoute');
    sel.innerHTML=`<option value="">Aucun pour l'instant</option>${rs.map(r=>`<option value="org:${esc(r.id)}">${esc(r.name)} (${fmtKm(r.L)} km${r.gain!=null?', D+ '+r.gain+' m':''})</option>`).join('')}<option value="own">📂 Mon propre GPX…</option>`;
    sel.value=rs.length===1?'org:'+rs[0].id:'';$('#jOwn').textContent='';
    $('#jConfirm').hidden=false;setTimeout(()=>{if(!$('#jName').value)$('#jName').focus()},50);
  },
  async pickOwn(){const rs=await pickGPX(false);if(rs[0]){this.own=rs[0];$('#jOwn').textContent='✔ '+rs[0].name+' · '+fmtKm(rs[0].L)+' km'}else{$('#jRoute').value=''}},
  join(){
    const name=$('#jName').value.trim();if(!name){toast('Indique ton prénom : il s\'affiche sur la carte des autres.',true);$('#jName').focus();return}
    if(!this.link){toast('Cherche d\'abord la sortie',true);return}
    store.set(K.me,name);Snd.unlock();
    const v=$('#jRoute').value;let follow=null,own=null;
    if(v.startsWith('org:'))follow={k:'org',id:v.slice(4)};
    if(v==='own'){if(!this.own){toast('Choisis d\'abord ton fichier GPX.',true);this.pickOwn();return}own=this.own;own.owner=null;follow={k:'own'}}
    const link=this.link;this.link=null;this.stopScan();
    Ride.begin({link,name,follow,own});
    toast('Bienvenue dans la sortie « '+(link.session.name||'')+' »');
  },
  async scan(){
    try{
      const det=new BarcodeDetector({formats:['qr_code']}),v=$('#jVideo');
      this.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=this.stream;v.hidden=false;await v.play();
      $('#jScan').textContent='✖ Arrêter le scan';
      const loop=async()=>{if(!this.stream)return;try{const r=await det.detect(v);if(r.length){const code=normCode(r[0].rawValue);if(validCode(code)){this.stopScan();Snd.unlock();Snd.ok();$('#jCode').value=fmtCode(code);this.lookup();return}}}catch(e){}setTimeout(loop,300)};loop();
    }catch(e){this.stopScan();toast('Caméra indisponible : tape le code à la main.',true)}
  },
  stopScan(){if(this.stream){this.stream.getTracks().forEach(t=>t.stop());this.stream=null}const v=$('#jVideo');v.hidden=true;v.srcObject=null;$('#jScan').textContent='📷 Scanner le QR'}
};
$('#jLookup').onclick=()=>Join.lookup();
$('#jCode').addEventListener('keydown',e=>{if(e.key==='Enter')Join.lookup()});
$('#jCode').addEventListener('input',e=>{const c=normCode(e.target.value);if(c.length===12&&validCode(c)&&!Join.link)Join.lookup()});
$('#jRoute').onchange=e=>{if(e.target.value==='own')Join.pickOwn();else{Join.own=null;$('#jOwn').textContent=''}};
$('#jGo').onclick=()=>Join.join();
$('#jScan').onclick=()=>{if(Join.stream)Join.stopScan();else Join.scan()};
