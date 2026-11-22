/* ---------------- Carte de la sortie ---------------- */
const STALE_MS=120000;
const RideMap={map:null,follow:true,mk:{},pl:{},me:null,myPl:null,routesDirty:true,fitted:false,
  init(){
    if(this.map)return;
    const m=this.map=makeMap($('#rMap'));
    this.routeLay=L.layerGroup().addTo(m);this.trailLay=L.layerGroup().addTo(m);this.riderLay=L.layerGroup().addTo(m);
    m.on('dragstart',()=>{this.follow=false;this.btns()});
  },
  reset(){
    this.init();this.routeLay.clearLayers();this.trailLay.clearLayers();this.riderLay.clearLayers();
    if(this.me){this.map.removeLayer(this.me);this.me=null}
    this.mk={};this.pl={};this.myPl=null;this.routesDirty=true;this.follow=true;this.fitted=false;this.btns();
    simPad($('#rSimPad'),[['🚴 Rouler',()=>{GPS.simRide(GPS.simHead==null?45:GPS.simHead,GPS.simSpeed?0:5);toast(GPS.simSpeed?'Simulation : 18 km/h':'Simulation : arrêt')}],['↻',()=>{GPS.simHead=((GPS.simHead||0)+45)%360}]]);
  },
  invalidate(){if(!this.map)return;this.map.invalidateSize();this.update()},
  btns(){$('#mMe').classList.toggle('on',this.follow);$('#mTrail').classList.toggle('on',!!settings.showTrails)},
  update(){
    if(!this.map||!Ride.on||Ride.tab!=='map')return;
    if(this.routesDirty)this.drawRoutes();
    this.drawTrails();this.drawRiders();this.drawMe();this.chips();
  },
  /* ---------- tracés GPX ---------- */
  drawRoutes(){
    this.routesDirty=false;this.routeLay.clearLayers();
    const fr=Ride.followRoute(),line=(r,o)=>L.polyline(r.pts.map(q=>[q[0],q[1]]),Object.assign({interactive:false,lineJoin:'round'},o)).addTo(this.routeLay);
    Object.values(Ride.routes).forEach(r=>{if(r===fr)return;line(r,{color:'#000',weight:8,opacity:.35});line(r,{color:'#FF2BD6',weight:4,opacity:.6})});
    if(settings.showOthersRoutes)Ride.others().forEach(R=>{if(!R.route||!R.st||R.st.status!=='on')return;line(R.route,{color:'#000',weight:6,opacity:.3});line(R.route,{color:colorOf(R.pid),weight:3.5,opacity:.85,dashArray:'8 7'})});
    if(Ride.own&&Ride.own!==fr){line(Ride.own,{color:'#000',weight:7,opacity:.3});line(Ride.own,{color:'#00E5FF',weight:3.5,opacity:.8,dashArray:'8 7'})}
    if(fr){line(fr,{color:'#000',weight:11,opacity:.5});line(fr,{color:'#FF2BD6',weight:6,opacity:1});
      const a=fr.pts[0],b=fr.pts[fr.pts.length-1];
      L.marker([b[0],b[1]],{icon:flagIcon('end'),interactive:false}).addTo(this.routeLay);L.marker([a[0],a[1]],{icon:flagIcon('start'),interactive:false}).addTo(this.routeLay)}
  },
  /* ---------- traces parcourues ---------- */
  drawTrails(){
    if(!settings.showTrails){if(Object.keys(this.pl).length||this.myPl){this.trailLay.clearLayers();this.pl={};this.myPl=null}return}
    const seen=new Set();
    Ride.others().forEach(R=>{if(R.st.status!=='on')return;const tr=Ride.fullTrack(R);if(tr.length<2)return;seen.add(R.pid);
      let p=this.pl[R.pid];if(!p){p=this.pl[R.pid]=L.polyline([],{color:colorOf(R.pid),weight:3.5,opacity:.8,interactive:false}).addTo(this.trailLay);p._n=-1}
      if(p._n!==tr.length){p.setLatLngs(tr.map(q=>[q[0],q[1]]));p._n=tr.length}});
    Object.keys(this.pl).forEach(pid=>{if(!seen.has(pid)){this.trailLay.removeLayer(this.pl[pid]);delete this.pl[pid]}});
    const t=Ride.track;
    if(t.length>1){if(!this.myPl){this.myPl=L.polyline([],{color:'#00E5FF',weight:4,opacity:.9,interactive:false}).addTo(this.trailLay);this.myPl._n=-1}
      if(this.myPl._n!==t.length){this.myPl.setLatLngs(t.map(q=>[q[0],q[1]]));this.myPl._n=t.length}}
  },
  /* ---------- participants ---------- */
  drawRiders(){
    const now=Date.now(),seen=new Set();
    Ride.others().forEach(R=>{
      const st=R.st;if(st.status!=='on'||!st.pos)return;seen.add(R.pid);
      const stale=now-st.pos.t>STALE_MS,sos=st.sos&&now-st.sos<SOS_MS,cls=(stale?'stale ':'')+(sos?'sos ':'')+(Ride.sel===R.pid?'sel':'');
      let k=this.mk[R.pid];const ikey=st.name+'|'+cls;
      if(!k){k=this.mk[R.pid]=L.marker([st.pos.lat,st.pos.lon],{icon:riderIcon(st.name,colorOf(R.pid),cls),zIndexOffset:sos?5000:1000}).on('click',()=>this.focus(R.pid,true)).addTo(this.riderLay);k._ikey=ikey}
      else{k.setLatLng([st.pos.lat,st.pos.lon]);if(k._ikey!==ikey){k.setIcon(riderIcon(st.name,colorOf(R.pid),cls));k.setZIndexOffset(sos?5000:1000);k._ikey=ikey}}
    });
    Object.keys(this.mk).forEach(pid=>{if(!seen.has(pid)){this.riderLay.removeLayer(this.mk[pid]);delete this.mk[pid]}});
    if(!this.fitted&&GPS.last&&seen.size){this.fitted=true}
  },
  drawMe(){
    const f=GPS.last;if(!f)return;const h=currentHeading(),hk=h==null?'n':String(Math.round(h/5));
    if(!this.me){this.me=L.marker([f.lat,f.lon],{icon:meIcon(h),interactive:false,zIndexOffset:4000}).addTo(this.map);this.me._hk=hk;this.map.setView([f.lat,f.lon],Math.max(this.map.getZoom(),15));return}
    this.me.setLatLng([f.lat,f.lon]);if(this.me._hk!==hk){this.me.setIcon(meIcon(h));this.me._hk=hk}
    if(this.follow){const c=this.map.getCenter();if(dist({lat:c.lat,lon:c.lng},f)>5)this.map.panTo([f.lat,f.lon],{animate:true,duration:.5})}
  },
  chips(){
    const s=Ride.stats,pr=Ride.prog,fr=Ride.followRoute();let h=`<span class="chip">${fmtKm(s.dist)} km · ${kmh(s.spd)} km/h · moy ${kmh(s.mov>0?s.dist/(s.mov/1000):null)}</span>`;
    if(fr&&pr&&pr.rid===fr.id&&pr.wait)h+=`<span class="chip route">🧭 ${esc(fr.name)} : tracé à ${fmtDist(pr.off)}, rejoins-le</span>`;
    else if(fr&&pr&&pr.rid===fr.id){const off=pr.off>(settings.offDist||50);
      h+=`<span class="chip route${off?' off':''}">🧭 ${fmtKm(pr.along)} / ${fmtKm(fr.L)} km${fr.gain!=null&&pr.gainLeft!=null?' · D+ restant '+Math.round(pr.gainLeft)+' m':''}${off?` · ⚠ hors tracé ${fmtDist(pr.off)}`:''}</span>`}
    else if(fr)h+=`<span class="chip route">🧭 ${esc(fr.name)} : en attente du GPS…</span>`;
    else if(Ride.follow)h+=`<span class="chip route">🧭 Tracé en cours de chargement…</span>`;
    $('#rChips').innerHTML=h;
  },
  focus(pid,sheet){
    const R=Ride.riders[pid];if(!R||!R.st)return;Ride.sel=pid;this.follow=false;this.btns();
    if(R.st.pos)this.map.setView([R.st.pos.lat,R.st.pos.lon],Math.max(this.map.getZoom(),16));
    Ride.dirtyView(true);if(sheet)RiderInfo.open(pid);
  },
  fitAll(){
    const b=L.latLngBounds([]);if(GPS.last)b.extend([GPS.last.lat,GPS.last.lon]);
    Ride.others().forEach(R=>{if(R.st.status==='on'&&R.st.pos)b.extend([R.st.pos.lat,R.st.pos.lon])});
    if(!b.isValid()){toast('Personne à afficher pour l\'instant.',true);return}
    this.follow=false;this.btns();this.map.fitBounds(b,{padding:[50,50],maxZoom:16});
  },
  fitRoute(r){const b=L.latLngBounds(r.pts.map(q=>[q[0],q[1]]));if(b.isValid()){this.follow=false;this.btns();this.map.fitBounds(b,{padding:[30,30]})}}
};
$('#mMe').onclick=()=>{RideMap.follow=true;RideMap.btns();Ride.sel=null;const f=GPS.last;if(f)RideMap.map.setView([f.lat,f.lon],Math.max(RideMap.map.getZoom(),16));else toast('Position GPS en cours de recherche…');Ride.dirtyView(true)};
$('#mAll').onclick=()=>RideMap.fitAll();
$('#mTrail').onclick=()=>{settings.showTrails=!settings.showTrails;saveSettings();RideMap.btns();toast(settings.showTrails?'Positions + traces parcourues':'Positions seules');Ride.dirtyView(true)};
$('#mLayers').onclick=()=>MapOpts.open();
$('#mRoutes').onclick=()=>Routes.open();

/* fond de carte et affichage */
const MapOpts={
  open(){
    const box=document.createElement('div');
    box.innerHTML=`<h2>Fond de carte</h2><div class="layers">${Object.entries(LAYERS).map(([k,v])=>`<button type="button" data-ly="${k}" aria-pressed="${settings.layer===k}">${esc(v.name)}</button>`).join('')}</div>
      <p class="hint">Le fond choisi reste enregistré pour les prochaines sorties.</p>
      <h2>Afficher</h2>
      <label class="chk"><input type="checkbox" id="moTrails" ${settings.showTrails?'checked':''}> Traces parcourues (sinon positions seules)</label>
      <label class="chk"><input type="checkbox" id="moOthers" ${settings.showOthersRoutes?'checked':''}> Tracés GPX personnels des autres</label>`;
    Sheet.show('Carte',box);
    box.querySelector('.layers').onclick=e=>{const b=e.target.closest('[data-ly]');if(!b)return;setLayer(b.dataset.ly);box.querySelectorAll('[data-ly]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));toast('Fond : '+LAYERS[b.dataset.ly].name)};
    $('#moTrails').onchange=e=>{settings.showTrails=e.target.checked;saveSettings();RideMap.btns();Ride.dirtyView(true)};
    $('#moOthers').onchange=e=>{settings.showOthersRoutes=e.target.checked;saveSettings();RideMap.routesDirty=true;Ride.dirtyView(true)};
  }
};

/* fiche d'un participant */
const RiderInfo={
  open(pid){
    const R=Ride.riders[pid];if(!R||!R.st)return;const st=R.st,s=st.s||{},now=Date.now();
    const box=document.createElement('div');
    box.innerHTML=`<p class="rhead"><span class="dot" style="background:${colorOf(pid)}">${esc(initials(st.name))}</span><b>${esc(st.name)}</b>${st.org?' <span class="tag">organisateur</span>':''}</p>
      ${st.sos&&now-st.sos<SOS_MS?`<p class="warnbox">🆘 A demandé de l'aide ${fmtAgo(now-st.sos)}</p>`:''}
      <p class="hint">${st.status==='left'?'A quitté la sortie · ':''}Position ${st.pos?fmtAgo(now-st.pos.t):'inconnue'}${st.pos&&GPS.last?' · à '+fmtDist(dist(GPS.last,st.pos))+' de toi ('+cardS(bearing(GPS.last,st.pos))+')':''}${st.bat!=null?' · 🔋 '+st.bat+' %':''}</p>
      <div class="tiles">${tile('Distance',fmtKm(s.dist),'km')}${tile('Vitesse',kmh(st.pos&&now-st.pos.t<STALE_MS?st.pos.spd:null),'km/h')}${tile('Moyenne',kmh(s.mov>0?s.dist/(s.mov/1000):null),'km/h')}${tile('Dénivelé +',s.gain!=null?Math.round(s.gain):'—','m')}</div>
      ${progressLine(st,true)}
      <div class="row"><button type="button" id="riCenter">🎯 Centrer</button>${R.route?'<button type="button" id="riRoute">🧭 Son tracé</button>':''}</div>`;
    Sheet.show(st.name,box,()=>{Ride.sel=null;Ride.dirtyView(true)});
    $('#riCenter').onclick=()=>{Sheet.hide();Ride.setTab('map');RideMap.focus(pid)};
    const rb=$('#riRoute');if(rb)rb.onclick=()=>{Sheet.hide();Ride.setTab('map');RideMap.fitRoute(R.route)};
  }
};
/* avancement d'un participant sur son tracé */
function progressLine(st,long){
  if(!st.f)return'';const pr=st.pr;
  if(!pr)return`<p class="prog">🧭 ${esc(st.f.name)}${long?' : position sur le tracé inconnue':''}</p>`;
  if(pr.w)return`<p class="prog">🧭 ${esc(st.f.name)} : pas encore sur le tracé (à ${fmtDist(pr.off)})</p>`;
  const pct=pr.L?Math.min(100,Math.round(pr.a/pr.L*100)):0,off=pr.off>80;
  return`<p class="prog${off?' off':''}">🧭 ${esc(st.f.name)} : <b>${fmtKm(pr.a)} / ${fmtKm(pr.L)} km</b> (${pct} %)${long&&pr.gl!=null?' · D+ restant '+pr.gl+' m':''}${off?' · ⚠ hors tracé ('+fmtDist(pr.off)+')':''}</p>${long?`<div class="pbar"><i style="width:${pct}%"></i></div>`:''}`;
}
