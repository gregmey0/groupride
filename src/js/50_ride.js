/* ---------------- Sortie en cours ----------------
   Canaux sur le relais (tous chiffrés, sous grr/v1/<canal de la sortie>) :
   s            fiche de la sortie (organisateur) : nom, statut, liste des tracés
   route/<id>   tracé GPX proposé par l'organisateur
   p/<pid>      état d'un participant : position, stats, tracé suivi, avancement
   t/<pid>/<k>  trace parcourue, par morceaux de 300 points
   r/<pid>      tracé GPX personnel d'un participant
   m/<pid>      ses derniers messages (60)
   Tout est « retenu » par le relais : un nouvel arrivant reçoit l'état complet. */
const CHUNK=300;
const QUICK=[
  {k:'ok',t:'👍 Tout va bien'},{k:'pause',t:'⏸ Pause'},{k:'wait',t:'⏳ Attendez-moi'},{k:'meca',t:'🔧 Problème mécanique'},
  {k:'back',t:'↩ Je rentre'},{k:'pos',t:'📍 Ma position',pos:true},{k:'sos',t:'🆘 Besoin d\'aide',pos:true}
];
const SOS_MS=45*60000;

const Ride={on:false,tab:'map',riders:{},routes:{},msgs:new Map(),
  /* a : {link, name, isOrg, session (organisateur), routes (organisateur), follow, own, resume} */
  begin(a){
    const s=a.resume||{},link=a.link;
    clearInterval(this.tickI);if(this.unsub)this.unsub();
    Object.assign(this,{on:true,ended:false,link,code:link.code,key:link.key,base:link.base,m:link.m,
      pid:s.pid||uid(),name:a.name||s.name||'Moi',isOrg:!!(a.isOrg||s.isOrg),
      session:s.session||a.session||link.session||null,sname:s.sname||'',
      start:s.start||Date.now(),track:s.track?decTrack(s.track):[],
      stats:Object.assign({dist:0,mov:0,vmax:0,gain:0,loss:0,alt:null,spd:null},s.stats||{}),
      altS:s.altS==null?null:s.altS,altRef:s.altRef==null?null:s.altRef,
      follow:s.follow||a.follow||null,own:s.own?decRoute(s.own):(a.own||null),
      myMsgs:s.myMsgs||[],msgs:new Map((s.msgs||[]).map(m=>[m.id,m])),lastRead:s.lastRead||0,
      sos:s.sos||null,status:'on',riders:{},routes:{},prog:null,offSince:null,offAlerted:false,armed:false,endReached:false,
      lastPub:0,lastChunkPub:0,lastSave:0,dirty:new Set(),fixes:[],prevSpd:null,syncT:Date.now(),
      ready:!!(link.session&&!a.resume)||!!(a.isOrg&&!a.resume),firstConn:true,sel:null});
    if(this.session&&this.session.name)this.sname=this.session.name;
    (s.orgRoutes||[]).forEach(e=>{const r=decRoute(e);if(r)this.routes[r.id]=r});
    (a.routes||[]).forEach(r=>{this.routes[r.id]=r});
    this.shared=[];this.track.forEach(p=>this.addShared(p));this.dirty=new Set();
    for(let k=0;k*CHUNK<this.shared.length;k++)this.dirty.add(k);
    link.onSession=x=>this.onSession(x);link.onState=c=>this.onNet(c);
    this.m.onMessage((t,pl)=>this.onMsg(t,pl));
    ['/p/+','/t/+/+','/r/+','/m/+','/route/+'].forEach(t=>this.m.subscribe(this.base+t));
    if(!this.ready)setTimeout(()=>{if(this.on&&!this.ready){this.ready=true;this.publishAll()}},5000);
    /* navigateur : l'écran doit rester allumé ; application : le partage continue écran éteint, on laisse le téléphone se verrouiller */
    GPS.start();this.unsub=GPS.on(f=>this.onFix(f));if(!NATIVE)Wake.on();
    this.tickI=setInterval(()=>this.tick(),1000);
    RideMap.reset();show('ride');this.setTab('map');
    if(this.link.session&&!this.isOrg)this.onSession(this.link.session);
    if(this.m.connected)this.onNet(true);
    this.save();this.renderHead();
    if(settings.notif)ensureNotifPermission();
  },
  async resume(){
    const a=store.get(K.active,null);if(!a)return;
    if(this.on){show('ride');return}
    let link=null;try{link=await SessionLink.connect(a.code,{silent:true})}catch(e){}
    if(!link){toast('Impossible de reprendre cette sortie.',true);return}
    const s=link.session;
    if(s&&(s.status==='closed'||s.status==='deleted')){link.close();this.archive(a);store.del(K.active);toast('Cette sortie est terminée.');Home.render();return}
    if(!s)toast('Relais injoignable : la sortie reprend, les données partiront dès le retour du réseau.',true);
    this.begin({link,resume:a});
  },
  /* ---------- relais ---------- */
  onNet(c){
    this.renderHead();
    if(c&&this.on&&this.ready)this.publishAll();
  },
  publishAll(){
    if(!this.on||!this.ready)return;
    if(this.isOrg){this.publishSession();Object.values(this.routes).forEach(r=>this.publishRoute(r))}
    this.publishOwn();this.publishMsgs();this.publish(true);
    if(this.firstConn){this.firstConn=false;this.publishChunks(true)}
  },
  /* la connexion est capturée à l'appel : un message envoyé juste avant la fin (« a quitté », « terminée ») part quand même */
  pub(topic,obj){const m=this.m;if(!m)return;const t=this.base+'/'+topic;if(obj==null){m.publish(t,new Uint8Array(0),true);return}seal(this.key,obj).then(b=>m.publish(t,b,true))},
  sessionMsg(){const s=this.session;return{v:1,type:'s',name:s.name,created:s.created,status:s.status,org:this.pid,orgName:this.name,routes:Object.values(this.routes).map(r=>({id:r.id,name:r.name,L:Math.round(r.L),gain:r.gain}))}},
  publishSession(){if(this.isOrg&&this.session)this.pub('s',this.sessionMsg())},
  publishRoute(r){if(this.isOrg)this.pub('route/'+r.id,encRoute(r))},
  publishOwn(){this.pub('r/'+this.pid,this.own?encRoute(this.own):null)},
  publishMsgs(){if(this.myMsgs.length)this.pub('m/'+this.pid,{pid:this.pid,name:this.name,msgs:this.myMsgs.slice(-40)})},
  stateMsg(){
    const f=GPS.last,s=this.stats,now=Date.now(),h=currentHeading(),fr=this.followRoute(),pr=this.prog;
    return{v:1,pid:this.pid,name:this.name,status:this.status,org:this.isOrg?1:0,start:this.start,
      pos:f?{lat:+f.lat.toFixed(6),lon:+f.lon.toFixed(6),acc:Math.round(f.acc),alt:f.alt!=null?Math.round(f.alt):null,spd:f.speed!=null?+f.speed.toFixed(1):null,hd:h!=null?Math.round(h):null,t:f.t,sim:f.sim?1:undefined}:null,
      s:{dist:Math.round(s.dist),mov:Math.round(s.mov),vmax:+(s.vmax||0).toFixed(1),gain:Math.round(s.gain||0),loss:Math.round(s.loss||0)},
      f:this.follow&&fr?{k:this.follow.k,id:this.follow.k==='org'?this.follow.id:null,name:fr.name,L:Math.round(fr.L)}:null,
      pr:pr&&fr&&pr.rid===fr.id?{a:Math.round(pr.along),L:Math.round(pr.L),off:Math.round(pr.off),gl:pr.gainLeft!=null?Math.round(pr.gainLeft):null,w:pr.wait?1:undefined}:null,
      sos:this.sos&&now-this.sos<SOS_MS?this.sos:null,bat:Battery.level,app:NATIVE?'android':'web',upd:now};
  },
  publish(force){
    if(!this.on||!this.ready)return;const now=Date.now();if(!force&&now-this.lastPub<5000)return;this.lastPub=now;
    this.pub('p/'+this.pid,this.stateMsg());
    if(force||now-this.lastChunkPub>40000)this.publishChunks();
  },
  publishChunks(all){
    this.lastChunkPub=Date.now();const ks=all?[...Array(Math.ceil(this.shared.length/CHUNK)).keys()]:[...this.dirty];this.dirty.clear();
    ks.forEach(k=>{const e=encTrack(this.shared.slice(k*CHUNK,(k+1)*CHUNK));if(e)this.pub('t/'+this.pid+'/'+k,Object.assign({pid:this.pid,k},e))});
  },
  async onMsg(topic,pl){
    if(!this.on||!topic.startsWith(this.base+'/'))return;
    const parts=topic.slice(this.base.length+1).split('/'),kind=parts[0],id=parts[1];
    if(kind==='s'||!id)return;
    let o=null;if(pl.length){try{o=await unseal(this.key,pl)}catch(e){return}}
    if(!this.on)return;
    if(kind==='route'){
      if(this.isOrg)return;
      if(!o){if(this.routes[id]){delete this.routes[id];this.routesChanged()}return}
      const r=decRoute(o);if(r){r.id=id;this.routes[id]=r;this.routesChanged()}return}
    if(id===this.pid)return;
    const R=this.rider(id);
    if(kind==='p'){
      if(!o||!o.pid)return;if(R.st&&R.st.upd>o.upd)return;
      const prev=R.st;R.st=o;
      if(o.pos&&o.status==='on'){const tr=R.trail,l=tr[tr.length-1];if(!l||l[2]!==o.pos.t){tr.push([o.pos.lat,o.pos.lon,o.pos.t,o.pos.alt]);if(tr.length>3000)tr.splice(0,500)}}
      const live=Date.now()-this.syncT>8000;
      if(!prev&&live&&o.status==='on')this.sysMsg(`${o.name} a rejoint la sortie`,Math.min(Date.now(),o.start||Date.now()));
      if(prev&&prev.status==='on'&&o.status==='left')this.sysMsg(`${o.name} a quitté la sortie`);
      if((o.sos||null)!==((prev&&prev.sos)||null)){this.renderHead();this.dirtyView(true)}
      this.dirtyView();return}
    if(kind==='t'){const k=+parts[2];if(!o)delete R.chunks[k];else R.chunks[k]=decTrack(o);R.ver++;this.dirtyView();return}
    if(kind==='r'){R.route=o?decRoute(o):null;this.routesChanged();return}
    if(kind==='m'){if(o&&Array.isArray(o.msgs))o.msgs.forEach(x=>{if(x&&x.id&&x.pid===id)this.addMsg(x)});return}
  },
  rider(pid){return this.riders[pid]||(this.riders[pid]={pid,st:null,trail:[],chunks:{},route:null,ver:0,cache:null,cacheKey:''})},
  /* trace complète d'un participant : morceaux reçus + positions en direct */
  fullTrack(R){
    const key=R.ver+':'+R.trail.length;if(R.cacheKey===key)return R.cache;
    /* les morceaux font foi ; les positions en direct prolongent la trace au-delà du dernier morceau reçu */
    const ch=Object.values(R.chunks).flat().sort((x,y)=>x[2]-y[2]),last=ch.length?ch[ch.length-1][2]:-Infinity;
    const o=ch.concat(R.trail.filter(q=>q[2]>last+1000));
    R.cache=o;R.cacheKey=key;return o;
  },
  onSession(s){
    if(!this.on||!s)return;
    if(s.status==='closed'||s.status==='deleted'){if(!this.isOrg||s.status==='deleted')this.stop('closed');return}
    if(!this.ready){this.ready=true;setTimeout(()=>this.publishAll(),50)}
    if(this.isOrg)return;
    const old=this.session;this.session=s;this.sname=s.name;
    const ids=new Set((s.routes||[]).map(r=>r.id));let ch=false;
    Object.keys(this.routes).forEach(id=>{if(!ids.has(id)){delete this.routes[id];ch=true}});
    if(this.follow&&this.follow.k==='org'&&!ids.has(this.follow.id)){toast('Le tracé que tu suivais a été retiré par l\'organisateur.',true);this.setFollow(null)}
    if(old&&old.routes){const had=new Set(old.routes.map(r=>r.id));(s.routes||[]).forEach(r=>{if(!had.has(r.id))toast('🧭 Nouveau tracé proposé : '+r.name+' (bouton 🧭 sur la carte)')})}
    if(ch)this.routesChanged();
    this.renderHead();this.save();
  },
  routesChanged(){
    if(this.follow){const r=this.followRoute();if(r&&GPS.last&&(!this.prog||this.prog.rid!==r.id))this.updateProgress(GPS.last)}
    RideMap.routesDirty=true;this.dirtyView(true);if(Routes.isOpen())Routes.render();
  },
  /* ---------- GPS et statistiques ---------- */
  onFix(f){
    if(!this.on)return;
    const S=this.stats;
    this.fixes.push(f);while(this.fixes.length>20)this.fixes.shift();
    S.spd=f.speed!=null?f.speed:this.derivedSpeed(f);
    if(f.speed!=null&&f.acc<=20){const v=Math.min(f.speed,this.prevSpd==null?f.speed:this.prevSpd);if(v<25&&v>(S.vmax||0))S.vmax=v;this.prevSpd=f.speed}
    if(f.acc<=25){
      const p=[+f.lat.toFixed(6),+f.lon.toFixed(6),f.t,f.alt!=null?Math.round(f.alt):null],l=this.track[this.track.length-1];
      if(!l)this.pushPt(p);
      else{const d=dist(l,p),dt=Math.max(0.5,(p[2]-l[2])/1000),v=d/dt,drift=f.speed!=null&&f.speed<0.4&&v<1;
        if(!drift&&d>=Math.max(4,Math.min(15,f.acc*0.6))){if(v<25){S.dist+=d;if(dt<=30&&v>=0.8)S.mov+=dt*1000}this.pushPt(p)}}
      if(f.alt!=null&&(f.altAcc==null||f.altAcc<=30)){
        this.altS=this.altS==null?f.alt:this.altS*0.8+f.alt*0.2;S.alt=this.altS;
        if(this.altRef==null)this.altRef=this.altS;
        else if(this.altS-this.altRef>=5){S.gain+=this.altS-this.altRef;this.altRef=this.altS}
        else if(this.altRef-this.altS>=5){S.loss+=this.altRef-this.altS;this.altRef=this.altS}
      }
    }
    this.updateProgress(f);
    this.publish();this.saveSoon();this.dirtyView();
  },
  derivedSpeed(f){const F=this.fixes;for(let i=F.length-2;i>=0;i--){const dt=(f.t-F[i].t)/1000;if(dt>=5)return dt<=15?dist(F[i],f)/dt:null}return null},
  pushPt(p){this.track.push(p);if(this.track.length>40000)this.track.splice(0,5000);this.addShared(p)},
  addShared(p){const sh=this.shared,l=sh[sh.length-1];if(!l||dist(l,p)>=12||p[2]-l[2]>=60000){sh.push(p);this.dirty.add(Math.floor((sh.length-1)/CHUNK))}},
  followRoute(){const fw=this.follow;if(!fw)return null;return fw.k==='own'?this.own:(this.routes[fw.id]||null)},
  setFollow(fw){this.follow=fw;this.prog=null;this.offSince=null;this.offAlerted=false;this.armed=false;this.endReached=false;
    if(GPS.last)this.updateProgress(GPS.last);this.publish(true);this.save();RideMap.routesDirty=true;this.dirtyView(true)},
  updateProgress(f){
    const r=this.followRoute();if(!r){this.prog=null;return}
    if(!f||f.acc>50)return;
    const loc=routeLocate(r,f,this.prog&&this.prog.rid===r.id?this.prog.along:null);if(!loc)return;
    const lim=settings.offDist||50;
    if(loc.off<=lim)this.armed=true;
    /* tant qu'on n'est jamais passé sur le tracé (trajet d'approche), pas d'avancement ni d'alerte */
    this.prog={rid:r.id,along:this.armed?loc.along:0,L:r.L,off:loc.off,gainLeft:this.armed?loc.gainLeft:r.gain,ele:loc.ele,wait:!this.armed};
    if(loc.off>lim){if(!this.offSince)this.offSince=Date.now();
      if(settings.offAlert&&this.armed&&!this.offAlerted&&Date.now()-this.offSince>=8000){this.offAlerted=true;Snd.warn();vib([400,150,400]);toast('⚠ Hors tracé : '+fmtDist(loc.off),true)}}
    else if(loc.off<lim*0.7){if(this.offAlerted){Snd.ok();toast('✔ De retour sur le tracé')}this.offSince=null;this.offAlerted=false}
    if(!this.endReached&&r.L>500&&r.L-loc.along<80&&loc.off<60&&this.stats.dist>r.L*0.5){this.endReached=true;Snd.ok();toast('🏁 Fin du tracé « '+r.name+' »')}
  },
  tick(){
    if(!this.on)return;this.publish();this.saveSoon();
    if(this.m&&!this.m.connected&&document.visibilityState==='visible'&&Date.now()-(this.kickT||0)>20000){this.kickT=Date.now();this.m.kick()}
    if(Date.now()-(this.headT||0)>2000){this.headT=Date.now();this.renderHead();if(this.tab==='stats'&&!Stats.busy)Stats.render()}
  },
  /* ---------- messages ---------- */
  addMsg(m,mine){
    if(this.msgs.has(m.id))return;
    m=Object.assign({},m,{rt:Date.now()});this.msgs.set(m.id,m);
    if(this.msgs.size>400){const old=[...this.msgs.values()].sort((a,b)=>a.t-b.t).slice(0,this.msgs.size-400);old.forEach(x=>this.msgs.delete(x.id))}
    if(!mine&&!m.sys&&m.t>this.syncT-10000)this.notify(m);
    if(this.tab==='chat'&&document.visibilityState==='visible')this.lastRead=Date.now();
    Chat.render();this.renderHead();this.save();
  },
  sysMsg(text,t){this.addMsg({id:'sys-'+uid(),t:t||Date.now(),sys:true,text},true)},
  notify(m){
    const sos=m.k==='sos';
    if(document.visibilityState==='hidden'&&NATIVE&&settings.notif){
      try{P.notif.schedule({notifications:[{id:Math.floor(Math.random()*2e9),title:(sos?'🆘 ':'💬 ')+m.name,body:m.text,smallIcon:'ic_stat_groupride',iconColor:'#A3E635'}]}).catch(()=>{})}catch(e){}}
    if(sos){Snd.sos();vib([600,200,600,200,900])}else{if(settings.msgSound)Snd.msg();vib([80,60,80])}
    if(this.tab!=='chat'||sos)toast((sos?'':'💬 ')+m.name+' : '+m.text,sos);
  },
  unread(){let n=0;this.msgs.forEach(m=>{if(!m.sys&&m.pid!==this.pid&&m.rt>this.lastRead)n++});return n},
  send(text,q){
    text=String(text||'').trim().slice(0,500);if(!text||!this.on)return false;
    const f=GPS.last,m={id:uid(),t:Date.now(),pid:this.pid,name:this.name,text};
    if(q){m.k=q.k;if(q.pos&&f)m.pos={lat:+f.lat.toFixed(5),lon:+f.lon.toFixed(5)}}
    if(q&&q.k==='sos')this.sos=Date.now();
    if(q&&q.k==='ok')this.sos=null;
    this.myMsgs.push(m);if(this.myMsgs.length>40)this.myMsgs.shift();
    this.addMsg(m,true);this.publishMsgs();this.publish(true);
    return true;
  },
  /* ---------- sauvegarde (reprise si l'appli est fermée) ---------- */
  saveSoon(){if(Date.now()-this.lastSave>20000)this.save()},
  save(){
    if(!this.on)return;this.lastSave=Date.now();
    const o={code:this.code,pid:this.pid,name:this.name,isOrg:this.isOrg,session:this.isOrg?this.session:null,sname:this.sname,start:this.start,
      stats:this.stats,altS:this.altS,altRef:this.altRef,follow:this.follow,own:this.own?encRoute(this.own):null,
      myMsgs:this.myMsgs,msgs:[...this.msgs.values()].sort((a,b)=>a.t-b.t).slice(-200),lastRead:this.lastRead,sos:this.sos,
      orgRoutes:this.isOrg?Object.values(this.routes).map(encRoute):null};
    for(const n of[40000,10000,2000,0]){o.track=n?encTrack(this.track.slice(-n)):null;if(store.set(K.active,o))return}
  },
  summary(){return{name:this.sname||'Sortie',me:this.name,start:this.start,end:Date.now(),stats:Object.assign({},this.stats),code:this.code,track:encTrack(this.track)}},
  archive(a){const sm=a.track?{name:a.sname||'Sortie',me:a.name,start:a.start,end:a.track?decTrack(a.track).slice(-1).map(q=>q[2])[0]||Date.now():Date.now(),stats:a.stats,track:a.track}:null;if(sm)store.set(K.last,sm)},
  /* ---------- fin ---------- */
  stop(reason){
    if(!this.on)return;
    const silent=reason==='closed';
    if(!silent){this.status='left';this.publish(true);this.publishChunks()}
    this.on=false;this.ended=true;clearInterval(this.tickI);if(this.unsub)this.unsub();this.unsub=null;
    GPS.stop();Wake.off();
    const sm=this.summary();if(!store.set(K.last,sm)){sm.track=null;store.set(K.last,sm)}
    store.del(K.active);
    const m=this.m;this.m=null;if(!this.keepLink)setTimeout(()=>{try{m.close()}catch(e){}},silent?300:3000);
    Sheet.hide();show('home');
    if(reason==='closed')toast('L\'organisateur a terminé la sortie.');
    Summary.open(sm);
  },
  async askLeave(){
    const v=await modal({title:'Quitter la sortie ?',body:this.isOrg?'<p>La sortie continue pour les autres, mais tu ne pourras plus gérer les tracés. Pour arrêter la sortie pour tout le monde, choisis plutôt « Terminer la sortie pour tous ».</p>':'<p>Ta position ne sera plus partagée avec le groupe.</p>',
      buttons:[{label:'Continuer la sortie',value:false,primary:true},{label:'🚪 Quitter',value:true,danger:true}]});
    if(v)this.stop('left');
  },
  async endForAll(){
    if(!this.isOrg)return;
    const v=await modal({title:'Terminer la sortie pour tous ?',body:'<p>Le partage de position s\'arrête sur tous les téléphones. Positions, traces et messages sont ensuite effacés du relais. Chacun garde son bilan et sa trace GPX.</p>',
      buttons:[{label:'Continuer la sortie',value:false,primary:true},{label:'⏹ Terminer pour tous',value:true,danger:true}]});
    if(!v)return;
    this.session.status='closed';this.publishSession();this.status='left';this.publish(true);
    const m=this.m,base=this.base,pids=Object.keys(this.riders).concat([this.pid]),chunks={};
    Object.values(this.riders).forEach(R=>chunks[R.pid]=Object.keys(R.chunks));chunks[this.pid]=[...Array(Math.ceil(this.shared.length/CHUNK)).keys()];
    const routes=Object.keys(this.routes);this.keepLink=true;
    setTimeout(()=>{const e=new Uint8Array(0);
      pids.forEach(pid=>{['p','r','m'].forEach(k=>m.publish(base+'/'+k+'/'+pid,e,true));(chunks[pid]||[]).forEach(k=>m.publish(base+'/t/'+pid+'/'+k,e,true))});
      routes.forEach(id=>m.publish(base+'/route/'+id,e,true));m.publish(base+'/s',e,true);
      setTimeout(()=>{try{m.close()}catch(err){}},4000)},6000);
    this.stop('closed');this.keepLink=false;
    toast('Sortie terminée pour tous');
  },
  /* ---------- affichage ---------- */
  onShow(){if(this.tab==='map')setTimeout(()=>{RideMap.invalidate()},60)},
  setTab(t){
    this.tab=t;$$('#ride .tabs [data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===t)));
    $$('#ride .pane').forEach(p=>p.classList.toggle('active',p.id==='p'+t[0].toUpperCase()+t.slice(1)));
    if(t==='map')setTimeout(()=>RideMap.invalidate(),30);
    if(t==='stats')Stats.render();
    if(t==='chat'){this.lastRead=Date.now();Chat.render(true);this.renderHead()}
  },
  dirtyView(now){
    if(this._rv)return;const run=()=>{this._rv=null;this._rvT=Date.now();if(!this.on||current!=='ride')return;
      RideMap.update()};
    const wait=now?0:Math.max(0,900-(Date.now()-(this._rvT||0)));this._rv=setTimeout(run,wait);
  },
  others(){return Object.values(this.riders).filter(R=>R.st)},
  renderHead(){
    if(!this.on)return;
    $('#rTitle').textContent=this.sname||'Sortie';
    const n=1+this.others().filter(R=>R.st.status==='on').length;$('#rCount').textContent='👥 '+n;
    const net=this.m&&this.m.connected;$('#rNet').textContent=net?'📡':'📡✖';$('#rNet').title=net?'Connecté au relais':'Hors ligne : nouvel essai…';$('#rNet').classList.toggle('off',!net);
    gpsBadge($('#rGps'),GPS.last);
    const u=this.unread(),b=$('#rBadge');b.hidden=!u;b.textContent=u>99?'99+':String(u);
    /* alertes « besoin d'aide » */
    const now=Date.now(),sos=this.others().filter(R=>R.st.sos&&now-R.st.sos<SOS_MS&&R.st.status==='on');
    const el=$('#rSos');el.hidden=!sos.length&&!(this.sos&&now-this.sos<SOS_MS);
    if(!el.hidden){
      el.innerHTML=sos.map(R=>`<button type="button" data-sos="${R.pid}">🆘 <b>${esc(R.st.name)}</b> a besoin d'aide · ${R.st.pos&&GPS.last?'à '+fmtDist(dist(GPS.last,R.st.pos)):'position inconnue'} · ${fmtAgo(now-R.st.sos)}</button>`).join('')
        +(this.sos&&now-this.sos<SOS_MS?`<button type="button" id="sosCancel">✔ Tu as demandé de l'aide : appuie ici quand tout va bien</button>`:'');
    }
  }
};
$('#rSos').addEventListener('click',e=>{
  if(e.target.closest('#sosCancel')){Ride.send('👍 Tout va bien',QUICK[0]);Ride.renderHead();return}
  const b=e.target.closest('[data-sos]');if(b){Ride.setTab('map');RideMap.focus(b.dataset.sos)}
});
$$('#ride .tabs [data-tab]').forEach(b=>b.onclick=()=>Ride.setTab(b.dataset.tab));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(Wake.want&&!NATIVE)Wake.on();if(Ride.on){if(Ride.m)Ride.m.kick();Ride.publish(true);Ride.renderHead();if(Ride.tab==='chat'){Ride.lastRead=Date.now();Ride.renderHead()}}}});
window.addEventListener('online',()=>{if(Ride.on&&Ride.m)Ride.m.kick()});
