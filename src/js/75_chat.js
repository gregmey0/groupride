/* ---------------- Messagerie ---------------- */
const Chat={n:-1,
  render(force){
    if(!Ride.on)return;
    const list=$('#chatList'),arr=[...Ride.msgs.values()].sort((a,b)=>a.t-b.t);
    if(!force&&arr.length===this.n&&Ride.tab!=='chat')return;
    const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<120;
    this.n=arr.length;
    let day='';
    list.innerHTML=arr.length?arr.map(m=>{
      const d=new Date(m.t).toLocaleDateString('fr-FR');let sep='';if(d!==day){day=d;sep=`<li class="day">${new Date(m.t).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</li>`}
      if(m.sys)return sep+`<li class="sys">${esc(m.text)} · ${hhmm(m.t)}</li>`;
      const mine=m.pid===Ride.pid,col=mine?'#00E5FF':colorOf(m.pid);
      return sep+`<li class="msg${mine?' mine':''}${m.k==='sos'?' sos':''}"><div class="mh"><span class="dot" style="background:${col};${mine?'color:#000':''}">${esc(initials(m.name))}</span><b>${mine?'Moi':esc(m.name)}</b><time>${hhmm(m.t)}</time></div>
        <p>${esc(m.text)}</p>${m.pos?`<button type="button" class="mini" data-pos="${m.pos.lat},${m.pos.lon}" data-pid="${esc(m.pid)}">📍 Voir sur la carte${GPS.last&&!mine?' · à '+fmtDist(dist(GPS.last,m.pos)):''}</button>`:''}</li>`}).join('')
      :'<li class="hint">Pas encore de message. Écris au groupe ou utilise un message rapide.</li>';
    if(nearBottom||force)list.scrollTop=list.scrollHeight;
  },
  quick(){
    $('#chatQuick').innerHTML=QUICK.map((q,i)=>`<button type="button" class="${q.k==='sos'?'danger':''}" data-q="${i}">${q.t}</button>`).join('');
  },
  async sendQuick(i){
    const q=QUICK[i];if(!q)return;
    if(q.k==='sos'){
      const v=await modal({title:'🆘 Demander de l\'aide ?',body:'<p>Tout le groupe reçoit une alerte avec ta position, et tu apparais en rouge sur leur carte. Tu pourras indiquer ensuite que tout va bien.</p>',buttons:[{label:'🆘 Envoyer l\'alerte',value:true,danger:true},{label:'Annuler',value:false}]});
      if(!v)return;
      if(!GPS.last)toast('Position GPS inconnue pour l\'instant : l\'alerte part sans position.',true);
    }
    if(Ride.send(q.t,q)){vib(40);if(q.k==='sos')toast('Alerte envoyée au groupe',true);Ride.renderHead()}
  }
};
Chat.quick();
$('#chatQuick').addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b)Chat.sendQuick(+b.dataset.q)});
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const i=$('#chatIn');if(Ride.send(i.value)){i.value='';i.focus()}});
$('#chatList').addEventListener('click',e=>{const b=e.target.closest('[data-pos]');if(!b)return;
  const[lat,lon]=b.dataset.pos.split(',').map(Number);Ride.setTab('map');RideMap.follow=false;RideMap.btns();
  setTimeout(()=>{RideMap.map.setView([lat,lon],17);L.circleMarker([lat,lon],{radius:22,color:'#FF2BD6',weight:4,fill:false,interactive:false}).addTo(RideMap.routeLay);setTimeout(()=>{RideMap.routesDirty=true;Ride.dirtyView(true)},8000)},80)});
