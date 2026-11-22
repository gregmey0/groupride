/* ---------------- Écran statistiques ---------------- */
const Stats={
  render(){
    if(!Ride.on)return;
    const s=Ride.stats,now=Date.now(),el=now-Ride.start,avg=s.mov>0?s.dist/(s.mov/1000):null;
    let h=`<section class="card"><h2>Moi</h2><div class="tiles">
      ${tile('Distance',fmtKm(s.dist),'km','big')}${tile('Vitesse',kmh(s.spd),'km/h','big')}
      ${tile('Moyenne en mouvement',kmh(avg),'km/h')}${tile('Vitesse max',kmh(s.vmax),'km/h')}
      ${tile('Temps en mouvement',fmtTime(s.mov),'')}${tile('Durée totale',fmtTime(el),'')}
      ${tile('Dénivelé',s.alt!=null||s.gain?'+'+Math.round(s.gain||0)+' / −'+Math.round(s.loss||0):'—','m')}${tile('Altitude',s.alt!=null?'≈ '+Math.round(s.alt):'—','m')}
    </div><p class="hint">Altitude et dénivelé viennent du GPS du téléphone : ce sont des estimations (± 10 à 20 m).</p></section>`;
    const fr=Ride.followRoute(),pr=Ride.prog;
    if(fr){
      const ok=pr&&pr.rid===fr.id,pct=ok&&fr.L?Math.min(100,Math.round(pr.along/fr.L*100)):0;
      h+=`<section class="card"><h2>🧭 ${esc(fr.name)}</h2>
        <p><b>${ok?fmtKm(pr.along):'—'} / ${fmtKm(fr.L)} km</b>${ok?` · ${pct} % · reste ${fmtKm(Math.max(0,fr.L-pr.along))} km`:' · en attente du GPS'}</p>
        ${fr.gain!=null?`<p class="hint">D+ total ${fr.gain} m${ok&&pr.gainLeft!=null?` · D+ restant ${Math.round(pr.gainLeft)} m`:''}</p>`:''}
        ${ok&&pr.off>(settings.offDist||50)?`<p class="warnbox">⚠ Hors tracé : ${fmtDist(pr.off)}</p>`:''}
        <div class="pbar"><i style="width:${pct}%"></i></div>${this.profile(fr)}</section>`;
    }
    h+=`<section class="card"><h2>Le groupe</h2><ul class="group">${this.groupRows()}</ul></section>`;
    $('#statsBody').innerHTML=h;
  },
  /* profil du tracé suivi, avec ma position et celle des autres sur le même tracé */
  profile(r){
    if(!r.hasEle||r.L<100)return'';
    const W=600,H=150,top=12,bot=22,p=r.pts;let mn=Infinity,mx=-Infinity;p.forEach(q=>{if(q[2]!=null){mn=Math.min(mn,q[2]);mx=Math.max(mx,q[2])}});
    if(mx-mn<20){const c=(mx+mn)/2;mn=c-10;mx=c+10}
    const X=d=>d/r.L*W,Y=e=>top+(1-(e-mn)/(mx-mn))*(H-top-bot);
    const step=Math.max(1,Math.floor(p.length/400));let d='M0,'+(H-bot);
    for(let i=0;i<p.length;i+=step)if(p[i][2]!=null)d+=` L${X(r.cum[i]).toFixed(1)},${Y(p[i][2]).toFixed(1)}`;
    d+=` L${W},${Y(p[p.length-1][2]??mn).toFixed(1)} L${W},${H-bot} Z`;
    const at=a=>{let i=0;while(i<r.cum.length-2&&r.cum[i+1]<a)i++;return p[i][2]??mn};
    const dots=[];
    Ride.others().forEach(R=>{const st=R.st;if(st.status!=='on'||!st.pr||!st.f)return;
      const same=st.f.k==='org'&&Ride.follow&&Ride.follow.k==='org'&&st.f.id===Ride.follow.id;if(!same)return;
      dots.push(`<g><circle cx="${X(st.pr.a).toFixed(1)}" cy="${Y(at(st.pr.a)).toFixed(1)}" r="7" fill="${colorOf(R.pid)}" stroke="#fff" stroke-width="2"/><title>${esc(st.name)}</title></g>`)});
    const pr=Ride.prog;
    if(pr&&pr.rid===r.id)dots.push(`<circle cx="${X(pr.along).toFixed(1)}" cy="${Y(at(pr.along)).toFixed(1)}" r="9" fill="#00E5FF" stroke="#000" stroke-width="3"/>`);
    return`<svg class="profile" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil du tracé : de ${Math.round(mn)} à ${Math.round(mx)} m d'altitude">
      <path d="${d}" fill="rgba(163,230,53,.25)" stroke="#A3E635" stroke-width="2.5"/>
      <text x="4" y="${top+10}" class="pt">${Math.round(mx)} m</text><text x="4" y="${H-bot-4}" class="pt">${Math.round(mn)} m</text>
      <text x="${W-4}" y="${H-5}" text-anchor="end" class="pt">${fmtKm(r.L)} km</text><text x="4" y="${H-5}" class="pt">0</text>${dots.join('')}</svg>`;
  },
  groupRows(){
    const now=Date.now(),me=GPS.last,mine=Ride.prog,myId=Ride.follow&&Ride.follow.k==='org'?Ride.follow.id:null;
    const rows=[];
    const s=Ride.stats;
    rows.push(`<li class="me"><span class="dot" style="background:#00E5FF;color:#000">${esc(initials(Ride.name))}</span><span class="gn"><b>${esc(Ride.name)} (moi)</b><small>${fmtKm(s.dist)} km · moy ${kmh(s.mov>0?s.dist/(s.mov/1000):null)} km/h · D+ ${Math.round(s.gain||0)} m</small></span></li>`);
    const arr=Ride.others().sort((a,b)=>(a.st.status==='on'?0:1)-(b.st.status==='on'?0:1)||a.st.name.localeCompare(b.st.name,'fr'));
    arr.forEach(R=>{
      const st=R.st,ss=st.s||{},left=st.status==='left',age=st.pos?now-st.pos.t:null,sos=st.sos&&now-st.sos<SOS_MS;
      let rel='';
      if(!left&&st.pos&&me)rel='à '+fmtDist(dist(me,st.pos));
      if(!left&&myId&&st.f&&st.f.k==='org'&&st.f.id===myId&&st.pr&&mine&&mine.rid===myId){const dd=st.pr.a-mine.along;rel=Math.abs(dd)<100?'avec toi':(dd>0?fmtDist(dd)+' devant':fmtDist(-dd)+' derrière')+' sur le tracé'}
      rows.push(`<li class="${left?'left':''}${sos?' sos':''}"><button type="button" data-rider="${R.pid}">
        <span class="dot" style="background:${colorOf(R.pid)}">${esc(initials(st.name))}</span>
        <span class="gn"><b>${esc(st.name)}${st.org?' <span class="tag">orga</span>':''}${sos?' 🆘':''}</b>
        <small>${fmtKm(ss.dist)} km · moy ${kmh(ss.mov>0?ss.dist/(ss.mov/1000):null)} km/h · D+ ${Math.round(ss.gain||0)} m</small>
        ${progressLine(st,false)}</span>
        <span class="gr">${left?'a quitté':esc(rel)}<small>${left?'':age!=null?(age>STALE_MS?'⚠ ':'')+fmtAgo(age):'pas de GPS'}${st.bat!=null?' · 🔋'+st.bat+'%':''}</small></span></button></li>`);
    });
    if(!arr.length)rows.push(`<li class="hint">Personne d'autre pour l'instant. Invite le groupe : ☰ Menu › Inviter.</li>`);
    return rows.join('');
  }
};
$('#statsBody').addEventListener('pointerdown',()=>{Stats.busy=true;clearTimeout(Stats.bt)});
['pointerup','pointercancel'].forEach(ev=>$('#statsBody').addEventListener(ev,()=>{clearTimeout(Stats.bt);Stats.bt=setTimeout(()=>Stats.busy=false,400)}));
$('#statsBody').addEventListener('click',e=>{const b=e.target.closest('[data-rider]');if(b)RiderInfo.open(b.dataset.rider)});
