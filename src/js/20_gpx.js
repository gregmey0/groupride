/* ---------------- Tracés (GPX) ----------------
   Un tracé : {id,name,pts:[[lat,lon,ele|null]],cum:[distance cumulée],L,gain,loss,gc:[D+ cumulé],hasEle,owner} */
function parseRouteGPX(text,fileName){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length||!doc.documentElement||doc.documentElement.localName!=='gpx')throw new Error('ce fichier n\'est pas un GPX lisible.');
  const q=(el,tag)=>[...el.getElementsByTagNameNS('*',tag)];
  const kid=(el,tag)=>{for(const n of el.children)if(n.localName===tag)return n.textContent.trim();return''};
  const read=n=>{const e=parseFloat(kid(n,'ele'));return[parseFloat(n.getAttribute('lat')),parseFloat(n.getAttribute('lon')),isFinite(e)?e:null]};
  const ok=p=>isFinite(p[0])&&isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
  let pts=q(doc,'trkpt').map(read).filter(ok);
  if(pts.length<2)pts=q(doc,'rtept').map(read).filter(ok);
  if(pts.length<2)pts=q(doc,'wpt').map(read).filter(ok);
  if(pts.length<2)throw new Error('aucun tracé trouvé (il faut une trace ou une route dans le GPX).');
  const trk=q(doc,'trk')[0],meta=q(doc,'metadata')[0],rte=q(doc,'rte')[0];
  const name=(trk&&kid(trk,'name'))||(meta&&kid(meta,'name'))||(rte&&kid(rte,'name'))||String(fileName||'Tracé').replace(/\.gpx$/i,'');
  return makeRoute({name:name.slice(0,80),pts});
}
/* Douglas-Peucker en mètres (projection locale) */
function simplifyPts(pts,tol){
  if(pts.length<3)return pts.slice();
  const lat0=pts[0][0]*RAD,kx=Math.cos(lat0)*RAD*RE,ky=RAD*RE;
  const X=pts.map(p=>p[1]*kx),Y=pts.map(p=>p[0]*ky),keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]];
  while(st.length){const[a,b]=st.pop();let md=-1,mi=-1;const dx=X[b]-X[a],dy=Y[b]-Y[a],L2=dx*dx+dy*dy;
    for(let i=a+1;i<b;i++){let t=L2?((X[i]-X[a])*dx+(Y[i]-Y[a])*dy)/L2:0;t=Math.max(0,Math.min(1,t));const ex=X[a]+t*dx-X[i],ey=Y[a]+t*dy-Y[i],d=ex*ex+ey*ey;if(d>md){md=d;mi=i}}
    if(mi>0&&md>tol*tol){keep[mi]=1;st.push([a,mi],[mi,b])}}
  return pts.filter((p,i)=>keep[i]);
}
function makeRoute({id,name,pts,owner,raw}){
  pts=pts.map(p=>[+(+p[0]).toFixed(6),+(+p[1]).toFixed(6),p[2]==null?null:Math.round(p[2])]);
  if(!raw){let tol=2,s=simplifyPts(pts,tol);while(s.length>3000){tol*=1.6;s=simplifyPts(pts,tol)}pts=s}
  const r=routeStats({id:id||uid(),name:name||'Tracé',pts,owner:owner||null});
  /* le relais le plus strict refuse les messages de plus de 100 Ko : on garde de la marge */
  if(!raw){let tol=4;while(JSON.stringify(encRoute(r)).length>50000&&tol<200){r.pts=simplifyPts(pts,tol);routeStats(r);tol*=1.5}}
  return r;
}
function routeStats(r){
  const p=r.pts,cum=[0];for(let i=1;i<p.length;i++)cum.push(cum[i-1]+dist(p[i-1],p[i]));
  r.cum=cum;r.L=cum[cum.length-1]||0;
  const hasEle=p.filter(q=>q[2]!=null).length>p.length*0.8;r.hasEle=hasEle;
  /* D+ / D− avec seuil de 3 m (évite de compter le bruit) */
  let gain=0,loss=0,ref=null;const gc=[];
  for(let i=0;i<p.length;i++){const e=p[i][2];if(hasEle&&e!=null){if(ref==null)ref=e;else if(e-ref>=3){gain+=e-ref;ref=e}else if(ref-e>=3){loss+=ref-e;ref=e}}gc.push(gain)}
  r.gain=hasEle?Math.round(gain):null;r.loss=hasEle?Math.round(loss):null;r.gc=gc;
  return r;
}
/* position sur le tracé : distance parcourue le long du tracé et écart au tracé.
   hint = dernière position connue le long du tracé (gère les boucles et les allers-retours) */
function routeLocate(r,pos,hint){
  const p=r.pts,n=p.length;if(n<2)return null;
  const kx=Math.cos(pos.lat*RAD)*RAD*RE,ky=RAD*RE;
  const at=i=>[(p[i][1]-pos.lon)*kx,(p[i][0]-pos.lat)*ky];
  let g=null,w=null;
  for(let i=0;i<n-1;i++){
    const[ax,ay]=at(i),[bx,by]=at(i+1),dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;
    let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));
    const cx=ax+t*dx,cy=ay+t*dy,off=Math.hypot(cx,cy),along=r.cum[i]+t*(r.cum[i+1]-r.cum[i]);
    const c={i,t,off,along};
    if(!g||off<g.off)g=c;
    if(hint!=null&&along>=hint-300&&along<=hint+3000&&(!w||off<w.off))w=c;
  }
  const b=w&&w.off<=Math.max(60,g.off+40)?w:g;
  const e1=p[b.i][2],e2=p[b.i+1][2];
  b.ele=e1!=null&&e2!=null?e1+(e2-e1)*b.t:null;
  b.gainLeft=r.gain!=null?Math.max(0,r.gain-(r.gc[b.i]+(r.gc[b.i+1]-r.gc[b.i])*b.t)):null;
  return b;
}
/* échange compact par le relais : différences entières (1e-5 degré, mètre) */
function encRoute(r){const d=[];let a0=0,b0=0,e0=0;
  for(const q of r.pts){const a=Math.round(q[0]*1e5),b=Math.round(q[1]*1e5),e=q[2]==null?e0:Math.round(q[2]);d.push(a-a0,b-b0,e-e0);a0=a;b0=b;e0=e}
  return{id:r.id,name:r.name,owner:r.owner,e:r.hasEle?1:0,d}}
function decRoute(o){if(!o||!o.d)return null;const pts=[];let a=0,b=0,e=0;
  for(let i=0;i+2<o.d.length;i+=3){a+=o.d[i];b+=o.d[i+1];e+=o.d[i+2];pts.push([a/1e5,b/1e5,o.e?e:null])}
  return pts.length>1?routeStats({id:o.id,name:o.name,owner:o.owner||null,pts}):null}
/* traces enregistrées [lat,lon,t,alt] : différences entières (1e-5 degré, seconde, mètre) */
function encTrack(tr){if(!tr||!tr.length)return null;const t0=tr[0][2];let a0=0,b0=0,c0=0,e0=0;const d=[];
  for(const q of tr){const a=Math.round(q[0]*1e5),b=Math.round(q[1]*1e5),c=Math.round((q[2]-t0)/1000),e=q[3]==null?e0:Math.round(q[3]);d.push(a-a0,b-b0,c-c0,e-e0);a0=a;b0=b;c0=c;e0=e}return{t0,d}}
function decTrack(o){const r=[];if(!o||!o.d)return r;let a=0,b=0,c=0,e=0;for(let i=0;i+3<o.d.length;i+=4){a+=o.d[i];b+=o.d[i+1];c+=o.d[i+2];e+=o.d[i+3];r.push([a/1e5,b/1e5,o.t0+c*1000,e])}return r}

function routeToGPX(r){
  const x=esc;let o=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Group Ride ${VERSION}" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x(r.name)}</name></metadata>\n<trk><name>${x(r.name)}</name><trkseg>\n`;
  r.pts.forEach(q=>{o+=`<trkpt lat="${q[0]}" lon="${q[1]}">${q[2]!=null?`<ele>${q[2]}</ele>`:''}</trkpt>\n`});
  return o+'</trkseg></trk>\n</gpx>\n';
}
function trackToGPX(name,tracks){
  const x=esc;let o=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Group Ride ${VERSION}" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x(name)}</name><time>${new Date().toISOString()}</time></metadata>\n`;
  tracks.forEach(t=>{if(!t.pts||t.pts.length<2)return;o+=`<trk><name>${x(t.name)}</name><type>cycling</type><trkseg>\n`;
    t.pts.forEach(q=>{o+=`<trkpt lat="${q[0].toFixed(6)}" lon="${q[1].toFixed(6)}">${q[3]!=null?`<ele>${Math.round(q[3])}</ele>`:''}<time>${new Date(q[2]).toISOString()}</time></trkpt>\n`});o+='</trkseg></trk>\n'});
  return o+'</gpx>\n';
}
function download(name,text,mime){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000);
}
async function nativeWrite(directory,path,text){const r=await P.fs.writeFile({path,data:text,directory,encoding:'utf8',recursive:true});return r.uri}
async function saveFile(name,text,mime='application/gpx+xml'){
  if(!NATIVE){download(name,text,mime);toast('Fichier téléchargé : '+name);return}
  try{await nativeWrite('DOCUMENTS','GroupRide/'+name,text);toast(IOS?'Enregistré dans Fichiers › Sur mon iPhone › Group Ride : '+name:'Enregistré dans Documents › GroupRide : '+name)}
  catch(e){toast('Enregistrement impossible ici : utilise « Partager ».',true)}
}
async function shareFile(name,text,mime='application/gpx+xml'){
  if(NATIVE){
    try{const uri=await nativeWrite('CACHE',name,text);await P.share.share({title:name,files:[uri],dialogTitle:'Envoyer '+name})}
    catch(e){if(!/cancel/i.test(String((e&&e.message)||e)))toast('Partage impossible : '+((e&&e.message)||e),true)}
    return;
  }
  for(const type of[mime,'text/plain']){
    try{const f=new File([text],name,{type});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}
    catch(e){if(e&&e.name==='AbortError')return}
  }
  download(name,text,mime);toast('Fichier enregistré dans Téléchargements : '+name);
}
/* sélection de fichiers GPX (le navigateur ne connaît pas toujours le type GPX : pas de filtre) */
function pickGPX(multiple){
  return new Promise(res=>{const inp=$('#gpxInput');inp.multiple=!!multiple;inp.value='';
    inp.onchange=async()=>{const out=[];for(const f of[...inp.files]){try{out.push(parseRouteGPX(await f.text(),f.name))}catch(e){toast(f.name+' : '+e.message,true)}}res(out)};
    inp.click()});
}
