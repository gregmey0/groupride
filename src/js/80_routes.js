/* ---------------- Tracés : proposés par l'organisateur, personnels, suivis ---------------- */
const Routes={box:null,
  isOpen(){return Sheet.open&&this.box&&this.box.isConnected},
  open(){this.box=document.createElement('div');Sheet.show('Tracés GPX',this.box,()=>{this.box=null});this.render()},
  info(r){return`${fmtKm(r.L)} km${r.gain!=null?' · D+ '+r.gain+' m':''}`},
  render(){
    const b=this.box;if(!b)return;
    const fw=Ride.follow,fr=Ride.followRoute(),org=Object.values(Ride.routes);
    let h=`<section class="card"><h2>Tracé suivi</h2>${fr?`<p><b>${esc(fr.name)}</b> · ${this.info(fr)}</p><div class="row"><button type="button" data-act="see" data-id="${fw.k==='own'?'own':fr.id}">🗺 Voir</button><button type="button" data-act="unfollow">✖ Ne plus suivre</button></div>`
      :fw?'<p class="hint">Tracé en cours de chargement…</p>':'<p class="hint">Aucun. Choisis un tracé ci-dessous : tu verras ton avancement, le dénivelé restant, et une alerte si tu t\'en écartes. Les autres verront où tu en es.</p>'}</section>`;
    h+=`<section class="card"><h2>Tracés de la sortie</h2>${org.length?'<ul class="rlist">'+org.map(r=>`<li><span><b>${esc(r.name)}</b><small>${this.info(r)}</small></span>
      ${fw&&fw.k==='org'&&fw.id===r.id?'<span class="tag">suivi</span>':`<button type="button" class="primary mini" data-act="follow" data-id="${r.id}">Suivre</button>`}<button type="button" class="mini" data-act="see" data-id="${r.id}" aria-label="Voir ${esc(r.name)}">🗺</button>
      ${Ride.isOrg?`<button type="button" class="mini danger" data-act="del" data-id="${r.id}" aria-label="Retirer ${esc(r.name)}">🗑</button>`:''}</li>`).join('')+'</ul>'
      :`<p class="hint">${Ride.isOrg?'Aucun tracé proposé pour l\'instant.':'L\'organisateur n\'a pas encore proposé de tracé.'}</p>`}
      ${Ride.isOrg?'<button type="button" data-act="addorg">📂 Proposer des tracés (GPX)</button><p class="hint">Chacun les reçoit et peut choisir celui qu\'il suit.</p>':''}</section>`;
    const own=Ride.own;
    h+=`<section class="card"><h2>Mon tracé personnel</h2>${own?`<ul class="rlist"><li><span><b>${esc(own.name)}</b><small>${this.info(own)}</small></span>
      ${fw&&fw.k==='own'?'<span class="tag">suivi</span>':'<button type="button" class="primary mini" data-act="followown">Suivre</button>'}<button type="button" class="mini" data-act="see" data-id="own" aria-label="Voir mon tracé">🗺</button><button type="button" class="mini danger" data-act="delown" aria-label="Retirer mon tracé">🗑</button></li></ul>`
      :'<p class="hint">Importe le GPX du parcours que tu veux faire : les autres le verront sur leur carte, avec ta position dessus.</p>'}
      <button type="button" data-act="addown">📂 ${own?'Remplacer par un autre GPX':'Importer mon tracé (GPX)'}</button></section>`;
    const oth=Ride.others().filter(R=>R.route&&R.st.status==='on');
    if(oth.length)h+=`<section class="card"><h2>Tracés des autres</h2><ul class="rlist">${oth.map(R=>`<li><span class="dot" style="background:${colorOf(R.pid)}">${esc(initials(R.st.name))}</span><span><b>${esc(R.st.name)} : ${esc(R.route.name)}</b><small>${this.info(R.route)}${R.st.pr&&R.st.f&&R.st.f.k==='own'?' · en est à '+fmtKm(R.st.pr.a)+' km':''}</small></span>
      <button type="button" class="mini" data-act="seeo" data-id="${R.pid}" aria-label="Voir le tracé de ${esc(R.st.name)}">🗺</button><button type="button" class="mini" data-act="copy" data-id="${R.pid}" title="Le suivre aussi">Suivre</button></li>`).join('')}</ul></section>`;
    b.innerHTML=h;
  },
  async act(a,id){
    if(a==='follow'){Ride.setFollow({k:'org',id});toast('Tracé suivi : '+Ride.routes[id].name);this.render();return}
    if(a==='followown'){Ride.setFollow({k:'own'});toast('Tracé suivi : '+Ride.own.name);this.render();return}
    if(a==='unfollow'){Ride.setFollow(null);this.render();return}
    if(a==='see'||a==='seeo'){const r=a==='seeo'?(Ride.riders[id]||{}).route:id==='own'?Ride.own:Ride.routes[id];if(!r)return;Sheet.hide();Ride.setTab('map');setTimeout(()=>RideMap.fitRoute(r),80);return}
    if(a==='copy'){const R=Ride.riders[id];if(!R||!R.route)return;
      const r=makeRoute({name:R.route.name,pts:R.route.pts,raw:true,owner:Ride.pid});Ride.own=r;Ride.publishOwn();Ride.setFollow({k:'own'});RideMap.routesDirty=true;toast('Tu suis le tracé de '+R.st.name);this.render();return}
    if(a==='addown'){const rs=await pickGPX(false);const r=rs[0];if(!r)return;r.owner=Ride.pid;Ride.own=r;Ride.publishOwn();
      const v=Ride.follow&&Ride.follow.k==='own'?true:await modal({title:'Suivre ce tracé ?',body:`<p><b>${esc(r.name)}</b> · ${this.info(r)}</p>`,buttons:[{label:'🧭 Oui, je le suis',value:true,primary:true},{label:'Non, juste le partager',value:false}]});
      if(v)Ride.setFollow({k:'own'});else Ride.save();RideMap.routesDirty=true;Ride.dirtyView(true);toast('Tracé partagé avec le groupe');this.render();return}
    if(a==='delown'){const v=await modal({title:'Retirer ton tracé ?',body:'<p>Il ne sera plus visible par le groupe.</p>',buttons:[{label:'🗑 Retirer',value:true,danger:true},{label:'Annuler',value:false}]});if(!v)return;
      if(Ride.follow&&Ride.follow.k==='own')Ride.setFollow(null);Ride.own=null;Ride.publishOwn();Ride.save();RideMap.routesDirty=true;Ride.dirtyView(true);this.render();return}
    if(a==='addorg'&&Ride.isOrg){const rs=await pickGPX(true);if(!rs.length)return;rs.forEach(r=>{Ride.routes[r.id]=r;Ride.publishRoute(r)});Ride.publishSession();Ride.save();Ride.routesChanged();
      toast(rs.length>1?rs.length+' tracés proposés au groupe':'Tracé proposé au groupe : '+rs[0].name);
      if(!Ride.follow&&rs.length===1){Ride.setFollow({k:'org',id:rs[0].id})}this.render();return}
    if(a==='del'&&Ride.isOrg){const r=Ride.routes[id];if(!r)return;const v=await modal({title:'Retirer ce tracé ?',body:`<p><b>${esc(r.name)}</b> ne sera plus proposé au groupe.</p>`,buttons:[{label:'🗑 Retirer',value:true,danger:true},{label:'Annuler',value:false}]});if(!v)return;
      delete Ride.routes[id];Ride.pub('route/'+id,null);Ride.publishSession();if(Ride.follow&&Ride.follow.k==='org'&&Ride.follow.id===id)Ride.setFollow(null);Ride.save();Ride.routesChanged();this.render();return}
  }
};
$('#sheetBody').addEventListener('click',e=>{if(!Routes.isOpen())return;const b=e.target.closest('[data-act]');if(b&&Routes.box.contains(b))Routes.act(b.dataset.act,b.dataset.id)});

/* ---------------- Menu de la sortie ---------------- */
const RideMenu={
  open(){
    const o=Ride.isOrg,box=document.createElement('div');box.className='menu';
    box.innerHTML=`<button type="button" class="primary" data-m="invite">🔗 Inviter (lien, QR code, code)</button>
      <button type="button" data-m="routes">🧭 Tracés GPX</button>
      <button type="button" data-m="map">🗂 Fond de carte et affichage</button>
      <button type="button" data-m="gpx">⬇ Exporter ma trace (GPX)</button>
      ${o?'<button type="button" data-m="gpxall">⬇ Traces de tout le groupe (GPX)</button>':''}
      <button type="button" data-m="settings">⚙ Réglages</button>
      <button type="button" data-m="help">❓ Aide</button>
      ${o?'<button type="button" class="danger" data-m="end">⏹ Terminer la sortie pour tous</button>':''}
      <button type="button" class="danger" data-m="leave">🚪 Quitter la sortie</button>
      <p class="hint center">${o?'Tu es l\'organisateur · ':''}Code ${fmtCode(Ride.code)}</p>`;
    Sheet.show(Ride.sname||'Sortie',box);
    box.onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const k=b.dataset.m;
      if(k==='invite')Invite.open();
      if(k==='routes')Routes.open();
      if(k==='map')MapOpts.open();
      if(k==='gpx'){if(Ride.track.length<2){toast('Pas encore de trace enregistrée.',true);return}shareFile(slug('groupride_'+Ride.sname+'_'+Ride.name)+'.gpx',trackToGPX(Ride.sname+' – '+Ride.name,[{name:Ride.name,pts:Ride.track}]))}
      if(k==='gpxall'){const t=[{name:Ride.name,pts:Ride.track}].concat(Ride.others().map(R=>({name:R.st.name,pts:Ride.fullTrack(R)})));shareFile(slug('groupride_'+Ride.sname)+'.gpx',trackToGPX(Ride.sname,t))}
      if(k==='settings'){Sheet.hide();Settings.open()}
      if(k==='help'){Sheet.hide();show('help')}
      if(k==='end'){Sheet.hide();Ride.endForAll()}
      if(k==='leave'){Sheet.hide();Ride.askLeave()}
    };
  }
};
$('#rMenu').onclick=()=>RideMenu.open();

/* ---------------- Invitation : lien, QR code, code ---------------- */
const Invite={
  open(){
    const url=joinURL(Ride.code),q=qrcode(0,'M');q.addData(url);q.make();
    const box=document.createElement('div');box.className='qrbox';
    box.innerHTML=`<div class="qr">${q.createSvgTag({cellSize:8,margin:2,scalable:true})}</div><p class="code">${fmtCode(Ride.code)}</p>
      <p class="hint">Scanne ce QR code avec l'appareil photo, ou ouvre Group Ride › « Rejoindre une sortie » et tape le code.</p><p class="hint url">${esc(url)}</p>
      <div class="row"><button type="button" class="primary" id="ivShare">📤 Envoyer le lien</button><button type="button" id="ivCopy">📋 Copier</button></div>`;
    Sheet.show('Inviter : '+(Ride.sname||'sortie'),box);
    const text=`Rejoins la sortie « ${Ride.sname} » sur Group Ride : ${url} (code ${fmtCode(Ride.code)})`;
    $('#ivCopy').onclick=async()=>{try{await navigator.clipboard.writeText(text);toast('Invitation copiée')}catch(e){toast('Copie impossible : '+url,true)}};
    $('#ivShare').onclick=async()=>{try{if(NATIVE)await P.share.share({title:'Group Ride',text,dialogTitle:'Envoyer l\'invitation'});else if(navigator.share)await navigator.share({title:'Group Ride',text});else{await navigator.clipboard.writeText(text);toast('Invitation copiée')}}catch(e){}};
  }
};
