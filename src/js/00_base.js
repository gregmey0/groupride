const VERSION='1.0.0';
const CAP=window.capacitorExports||null;
const NATIVE=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
const P=NATIVE&&CAP?{geo:CAP.registerPlugin('BackgroundGeolocation'),fs:CAP.registerPlugin('Filesystem'),share:CAP.registerPlugin('Share'),awake:CAP.registerPlugin('KeepAwake'),notif:CAP.registerPlugin('LocalNotifications'),app:CAP.registerPlugin('App')}:{};
const ANDROID=/Android/i.test(navigator.userAgent);
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const STANDALONE=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
document.documentElement.classList.add(NATIVE?'native':'web');if(IOS)document.documentElement.classList.add('ios');
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';

/* ---------------- Stockage ---------------- */
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const K={settings:'grr.settings.v1',active:'grr.active.v1',last:'grr.last.v1',me:'grr.me.v1'};
const DEFAULTS={layer:'ign',showTrails:true,showOthersRoutes:true,offAlert:true,offDist:50,vibrate:true,notif:true,msgSound:true,sim:false};
let settings=Object.assign({},DEFAULTS,store.get(K.settings,{}));
const saveSettings=()=>store.set(K.settings,settings);

/* ---------------- Géographie et formats ---------------- */
const RAD=Math.PI/180,RE=6371008.8;
const ll=p=>Array.isArray(p)?{lat:p[0],lon:p[1]}:p;
function dist(a,b){a=ll(a);b=ll(b);const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLon/2)**2;return 2*RE*Math.asin(Math.min(1,Math.sqrt(x)))}
function bearing(a,b){a=ll(a);b=ll(b);const p1=a.lat*RAD,p2=b.lat*RAD,dl=(b.lon-a.lon)*RAD;const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(Math.atan2(y,x)/RAD+360)%360}
function dest(p,brg,d){const dd=d/RE,t=brg*RAD,p1=p.lat*RAD,l1=p.lon*RAD;const p2=Math.asin(Math.sin(p1)*Math.cos(dd)+Math.cos(p1)*Math.sin(dd)*Math.cos(t));const l2=l1+Math.atan2(Math.sin(t)*Math.sin(dd)*Math.cos(p1),Math.cos(dd)-Math.sin(p1)*Math.sin(p2));return{lat:p2/RAD,lon:((l2/RAD+540)%360)-180}}
const CARDS=['N','NE','E','SE','S','SO','O','NO'],cardS=b=>CARDS[Math.round(b/45)%8];
const dec=(x,n)=>x.toFixed(n).replace('.',',');
const fmtDist=d=>d==null?'—':d<1000?Math.round(d)+' m':dec(d/1000,d<10000?2:1)+' km';
const fmtKm=d=>dec((d||0)/1000,(d||0)<100000?1:0);
const kmh=v=>v==null||!isFinite(v)?'—':dec(v*3.6,1);
function fmtTime(ms){const s=Math.max(0,Math.round(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(ss).padStart(2,'0')}
function fmtDur(ms){const m=Math.max(0,Math.round(ms/60000)),h=Math.floor(m/60);return h?h+' h '+String(m%60).padStart(2,'0'):m+' min'}
function fmtAgo(ms){if(ms==null||!isFinite(ms))return'—';const s=Math.round(ms/1000);if(s<15)return'à l\'instant';if(s<60)return'il y a '+s+' s';if(s<3600)return'il y a '+Math.round(s/60)+' min';return'il y a '+fmtDur(ms)}
const hhmm=t=>new Date(t).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
function slug(s){return(String(s||'sortie').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,60))||'sortie'}

/* ---------------- Interface : toast, modale, appui long ---------------- */
let toastT;
function toast(msg,warn){const t=$('#toast');t.textContent=msg;t.className='show'+(warn?' warn':'');clearTimeout(toastT);toastT=setTimeout(()=>t.className='',warn?5000:3200)}
function modal({title,body='',buttons=[{label:'OK',value:true,primary:true}],input=null}){
  return new Promise(res=>{
    const m=$('#modal');$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;
    const inp=$('#modalInput');
    if(input){inp.hidden=false;inp.value=input.value||'';inp.placeholder=input.placeholder||''}else inp.hidden=true;
    const bx=$('#modalBtns');bx.innerHTML='';
    buttons.forEach(b=>{const el=document.createElement('button');el.type='button';el.textContent=b.label;if(b.primary)el.className='primary';if(b.danger)el.className='danger';
      el.onclick=()=>{m.classList.remove('show');res(input?{value:b.value,text:inp.value.trim()}:b.value)};bx.appendChild(el)});
    m.classList.add('show');
    setTimeout(()=>{if(input)inp.focus();else $('#modalTitle').focus()},60);
  });
}
function holdButton(el,ms,fn){
  let t=null,start=0,raf=0;
  const reset=()=>{clearTimeout(t);t=null;cancelAnimationFrame(raf);el.style.setProperty('--p','0%')};
  const prog=()=>{el.style.setProperty('--p',Math.min(100,(Date.now()-start)/ms*100)+'%');if(t)raf=requestAnimationFrame(prog)};
  el.addEventListener('pointerdown',e=>{if(e.button>0)return;start=Date.now();clearTimeout(t);t=setTimeout(()=>{reset();vib(60);fn()},ms);prog()});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{if(t)reset()}));
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}});
}

/* ---------------- Son, vibration, veille ---------------- */
const Snd={ctx:null,out:null,
  unlock(){
    try{if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.out=this.ctx.createGain();this.out.gain.value=0.9;this.out.connect(this.ctx.destination)}
      if(this.ctx.state!=='running')this.ctx.resume()}catch(e){}
  },
  tone(f,dur=0.09,{vol=0.45,type='sine',at=0}={}){
    const c=this.ctx;if(!c)return;
    try{const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.connect(g);g.connect(this.out);o.start(t);o.stop(t+dur+0.03)}catch(e){}
  },
  msg(){this.tone(880,0.12,{vol:0.35,type:'triangle'});this.tone(1320,0.16,{at:0.12,vol:0.35,type:'triangle'})},
  warn(){this.tone(392,0.22,{vol:0.4,type:'square'});this.tone(262,0.3,{at:0.25,vol:0.4,type:'square'})},
  sos(){for(let i=0;i<6;i++)this.tone(i%2?660:990,0.22,{at:i*0.25,vol:0.55,type:'square'})},
  ok(){this.tone(1046,0.12,{vol:0.4,type:'triangle'})}
};
function vib(p){if(settings.vibrate&&navigator.vibrate)try{navigator.vibrate(p)}catch(e){}}
const Wake={lock:null,want:false,
  async on(){this.want=true;if(NATIVE){P.awake.keepAwake().catch(()=>{});return}try{if('wakeLock' in navigator&&!this.lock){this.lock=await navigator.wakeLock.request('screen');this.lock.addEventListener('release',()=>{this.lock=null})}}catch(e){}},
  off(){this.want=false;if(NATIVE){P.awake.allowSleep().catch(()=>{});return}try{if(this.lock)this.lock.release()}catch(e){}this.lock=null}
};
const Battery={level:null,
  async init(){try{if(navigator.getBattery){const b=await navigator.getBattery();const u=()=>{this.level=Math.round(b.level*100)};u();b.addEventListener('levelchange',u)}}catch(e){}}
};
Battery.init();

/* ---------------- GPS ----------------
   Android donne l'altitude au-dessus de l'ellipsoïde WGS84 : en France le géoïde est environ 50 m plus haut,
   on retranche donc 50 m pour approcher l'altitude des cartes (iPhone donne déjà l'altitude « niveau de la mer »). */
function altFix(alt,lat,lon){if(alt==null||!isFinite(alt))return null;if(ANDROID&&lat>41&&lat<51.5&&lon>-5.5&&lon<10)return alt-50;return alt}
const GPS={id:null,last:null,lastErrT:0,subs:new Set(),simPos:null,simTimer:null,simHead:null,simMoveT:0,simSpeed:0,simAlt:null,
  nid:null,active:false,
  start(){
    if(settings.sim){this._startSim();return}
    if(NATIVE){this.active=true;if(this.nid===null&&!this.starting)this._nativeStart();return}
    if(this.id!==null)return;
    if(!('geolocation' in navigator)){toast('Pas de GPS disponible dans ce navigateur',true);return}
    this.id=navigator.geolocation.watchPosition(p=>{const c=p.coords;
      this._emit({lat:c.latitude,lon:c.longitude,acc:c.accuracy||99,alt:altFix(c.altitude,c.latitude,c.longitude),altAcc:c.altitudeAccuracy,heading:(c.heading==null||isNaN(c.heading))?null:c.heading,speed:(c.speed==null||isNaN(c.speed))?null:c.speed,t:Date.now()})},
      e=>{if(e.code!==1)this.lastErrT=Date.now();if(e.code===1)toast('Accès à la position refusé : autorise la localisation pour ce site dans le navigateur.',true)},
      {enableHighAccuracy:true,maximumAge:0,timeout:30000});
  },
  async _nativeStart(){
    this.starting=true;
    try{
      await ensureNotifPermission();
      const id=await P.geo.addWatcher({backgroundTitle:'Group Ride – position partagée',backgroundMessage:'Ta position est partagée avec le groupe. Touche pour revenir à l\'appli.',requestPermissions:true,stale:false,distanceFilter:0},
        (loc,err)=>{
          if(err){if(err.code==='NOT_AUTHORIZED')askLocationSettings();else this.lastErrT=Date.now();return}
          if(!loc)return;
          this._emit({lat:loc.latitude,lon:loc.longitude,acc:loc.accuracy||99,alt:altFix(loc.altitude,loc.latitude,loc.longitude),altAcc:loc.altitudeAccuracy,heading:(loc.bearing==null||isNaN(loc.bearing))?null:loc.bearing,speed:(loc.speed==null||isNaN(loc.speed))?null:loc.speed,t:Date.now()});
        });
      if(this.active)this.nid=id;else P.geo.removeWatcher({id}).catch(()=>{});
    }catch(e){toast('GPS indisponible : '+((e&&e.message)||e),true)}
    finally{this.starting=false}
  },
  stop(){
    this.active=false;
    if(this.nid!==null){P.geo.removeWatcher({id:this.nid}).catch(()=>{});this.nid=null}
    if(this.id!==null){try{navigator.geolocation.clearWatch(this.id)}catch(e){}this.id=null}clearInterval(this.simTimer);this.simTimer=null},
  restart(){this.stop();this.start()},
  /* simulation : déplacement avec les flèches, ou à vitesse constante (bouton « rouler ») */
  _startSim(){if(this.simTimer)return;if(!this.simPos)this.simPos=this.last?{lat:this.last.lat,lon:this.last.lon}:{lat:43.9493,lon:4.8055};this.simTimer=setInterval(()=>this._tickSim(),1000);this._emitSim()},
  _tickSim(){if(this.simSpeed>0&&this.simHead!=null){const p=dest(this.simPos,this.simHead,this.simSpeed);this.simPos=p;this.simMoveT=Date.now()}this._emitSim()},
  _emitSim(){const moving=Date.now()-this.simMoveT<4000;this._emit({lat:this.simPos.lat,lon:this.simPos.lon,acc:3,alt:this.simAlt,heading:moving?this.simHead:null,speed:moving?(this.simSpeed||1.5):0,t:Date.now(),sim:true})},
  simSet(lat,lon,alt){if(this.simPos)this.simHead=bearing(this.simPos,{lat,lon});this.simMoveT=Date.now();this.simPos={lat,lon};if(alt!=null)this.simAlt=alt;if(this.simTimer)this._emitSim()},
  simMove(brg,d){if(!this.simPos)return;const p=dest(this.simPos,brg,d);this.simSet(p.lat,p.lon)},
  simRide(brg,speed){this.simHead=brg;this.simSpeed=speed||0},
  _emit(f){this.last=f;this.subs.forEach(fn=>{try{fn(f)}catch(e){console.error(e)}})},
  on(fn){this.subs.add(fn);return()=>this.subs.delete(fn)}
};
async function ensureNotifPermission(){
  if(!NATIVE||ensureNotifPermission.done)return;ensureNotifPermission.done=true;
  try{const s=await P.notif.checkPermissions();if(s.display!=='granted')await P.notif.requestPermissions()}catch(e){}
}
let locAsked=false;
async function askLocationSettings(){
  if(locAsked)return;locAsked=true;
  const v=await modal({title:'Localisation refusée',body:"<p>Group Ride a besoin de la position GPS pour la partager avec le groupe. Autorise la localisation « précise », et « toujours » si Android le propose.</p>",buttons:[{label:'Ouvrir les réglages',value:true,primary:true},{label:'Plus tard',value:false}]});
  if(v)P.geo.openSettings().catch(()=>{});setTimeout(()=>locAsked=false,30000);
}
function gpsBadge(el,f){
  if(!f||Date.now()-f.t>30000){el.className='gps none';el.textContent='GPS…';return}
  const a=Math.round(f.acc);el.className='gps '+(a<=10?'good':a<=25?'mid':'bad');el.textContent=(f.sim?'SIMU ':'')+'±'+a+' m';
}

/* ---------------- Direction de la flèche : sens de déplacement, sinon boussole ---------------- */
function tiltHeading(a,b,g){
  a*=RAD;b*=RAD;g*=RAD;const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
  const E=-sa*cb-ca*sg-sa*sb*cg,N=ca*cb-sa*sg+ca*sb*cg;
  if(Math.hypot(E,N)<0.25)return null;return(Math.atan2(E,N)/RAD+360)%360;
}
const Compass={active:false,x:0,y:0,val:null,lastT:0,
  needsPerm:typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'&&!('ondeviceorientationabsolute' in window),
  async enable(){
    if(this.active)return true;
    try{
      if(this.needsPerm){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')return false}
      if('ondeviceorientationabsolute' in window)window.addEventListener('deviceorientationabsolute',this._abs,true);
      if('DeviceOrientationEvent' in window)window.addEventListener('deviceorientation',this._ios,true);
      this.active=true;return true;
    }catch(e){return false}
  },
  _scr(){try{return(screen.orientation&&screen.orientation.angle)||window.orientation||0}catch(e){return 0}},
  _ios(e){if(e.webkitCompassHeading!=null){Compass._set(e.webkitCompassHeading+Compass._scr());return}
    if(e.absolute&&!('ondeviceorientationabsolute' in window))Compass._abs(e)},
  _abs(e){if(e.alpha==null)return;if(e.type==='deviceorientation'&&!e.absolute)return;const h=tiltHeading(e.alpha,e.beta||0,e.gamma||0);if(h!=null)Compass._set(h+Compass._scr())},
  _set(h){h=((h%360)+360)%360;const now=Date.now(),dt=this.val==null?1:Math.min(1,Math.max(0.005,(now-this.lastT)/1000)),k=1-Math.exp(-dt/0.3);
    this.x=this.x*(1-k)+Math.cos(h*RAD)*k;this.y=this.y*(1-k)+Math.sin(h*RAD)*k;
    this.val=(Math.atan2(this.y,this.x)/RAD+360)%360;this.lastT=Date.now()},
  get(){return(this.active&&Date.now()-this.lastT<3000)?this.val:null}
};
const Walk={h:null,t:0,movT:0,hist:[],
  update(f){
    const H=this.hist;H.push(f);while(H.length>40)H.shift();
    let moving=f.speed!=null&&f.speed>0.8;
    if(!moving)for(let i=H.length-2;i>=0;i--){const dt=(f.t-H[i].t)/1000;if(dt>=5){const d=dist(H[i],f);moving=dt<=12&&d/dt>0.7&&d>Math.max(4,f.acc*0.7);break}}
    if(moving)this.movT=Date.now();
    if(f.heading!=null&&f.speed>0.8){this.h=f.heading;this.t=Date.now();return}
    for(let i=H.length-2;i>=0;i--){const d=dist(H[i],f);if(d>=8){if(f.t-H[i].t<25000&&d>Math.max(6,f.acc*0.8)){this.h=bearing(H[i],f);this.t=Date.now()}break}}
  },
  moving(){return Date.now()-this.movT<3500},
  get(maxAge=15000){return this.h!=null&&Date.now()-this.t<maxAge?this.h:null}
};
GPS.on(f=>Walk.update(f));
function currentHeading(){
  if(document.visibilityState!=='hidden'&&!Walk.moving()){const c=Compass.get();if(c!=null)return c}
  return Walk.get(600000);
}
