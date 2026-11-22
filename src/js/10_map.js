/* ---------------- Carte ---------------- */
const IGN=l=>`https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${l}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
const LAYERS={
  ign:{name:'IGN Plan',url:IGN('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2')+'&FORMAT=image/png',o:{maxNativeZoom:19,maxZoom:20,attribution:'© IGN Géoplateforme'}},
  topo:{name:'Relief (OpenTopoMap)',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',o:{subdomains:'abc',maxNativeZoom:17,maxZoom:20,attribution:'© OpenStreetMap, SRTM | OpenTopoMap (CC-BY-SA)'}},
  cyclosm:{name:'Vélo / VTT (CyclOSM)',url:'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',o:{subdomains:'abc',maxNativeZoom:20,maxZoom:20,attribution:'© OpenStreetMap | CyclOSM'}},
  osm:{name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',o:{maxNativeZoom:19,maxZoom:20,attribution:'© OpenStreetMap'}},
  photo:{name:'Photo aérienne (IGN)',url:IGN('ORTHOIMAGERY.ORTHOPHOTOS')+'&FORMAT=image/jpeg',o:{maxNativeZoom:19,maxZoom:20,attribution:'© IGN Géoplateforme'}}
};
const allMaps=[];
function makeMap(el){const m=L.map(el,{zoomControl:true,attributionControl:true,maxZoom:20,preferCanvas:true});
  m.attributionControl.setPrefix(false);m.setView([43.9493,4.8055],14);setMapStyle(m);allMaps.push(m);return m}
function setMapStyle(m){
  if(m._base){m.removeLayer(m._base);m._base=null}
  const ly=LAYERS[settings.layer]||LAYERS.ign;m._base=L.tileLayer(ly.url,ly.o).addTo(m);
}
function setLayer(k){if(!LAYERS[k])return;settings.layer=k;saveSettings();allMaps.forEach(setMapStyle)}
function meIcon(h){
  const arrow=h!=null?`<polygon points="35,1 46,24 24,24" fill="#00E5FF" stroke="#000" stroke-width="3" stroke-linejoin="round"/>`:'';
  return L.divIcon({className:'me',html:`<svg width="70" height="70" viewBox="0 0 70 70" style="transform:rotate(${h||0}deg)">${arrow}<circle cx="35" cy="35" r="12" fill="#00E5FF" stroke="#000" stroke-width="5"/><circle cx="35" cy="35" r="16" fill="none" stroke="#fff" stroke-width="3"/></svg>`,iconSize:[70,70],iconAnchor:[35,35]});
}
function riderIcon(name,col,cls){
  return L.divIcon({className:'rmk '+(cls||''),html:`<span style="background:${col}">${esc(initials(name))}</span><em>${esc(name)}</em>`,iconSize:[36,36],iconAnchor:[18,18]});
}
function flagIcon(kind){
  const svg=kind==='start'?'<svg viewBox="0 0 30 30" width="30" height="30"><circle cx="15" cy="15" r="11" fill="#2BD96B" stroke="#000" stroke-width="3"/><polygon points="12,9 21,15 12,21" fill="#000"/></svg>'
    :'<svg viewBox="0 0 30 30" width="30" height="30"><circle cx="15" cy="15" r="11" fill="#fff" stroke="#000" stroke-width="3"/><rect x="9" y="9" width="6" height="6" fill="#000"/><rect x="15" y="15" width="6" height="6" fill="#000"/></svg>';
  return L.divIcon({className:'flag',html:svg,iconSize:[30,30],iconAnchor:[15,15]});
}
/* couleur stable par participant */
const PALETTE=['#E6194B','#3CB44B','#4363D8','#F58231','#911EB4','#F032E6','#9A6324','#008080','#DC143C','#2E8B57','#8B008B','#FF4500','#1E90FF','#B8860B','#C71585','#006400'];
function colorOf(pid){let h=0;for(const ch of String(pid))h=(h*31+ch.charCodeAt(0))>>>0;return PALETTE[h%PALETTE.length]}
function simPad(el,extra){
  el.innerHTML='';const mk=(lbl,fn,aria)=>{const b=document.createElement('button');b.type='button';b.textContent=lbl;if(aria)b.setAttribute('aria-label',aria);b.onclick=fn;el.appendChild(b)};
  mk('↑',()=>GPS.simMove(0,25),'Simulation : 25 m vers le nord');mk('←',()=>GPS.simMove(270,25),'25 m vers l\'ouest');mk('→',()=>GPS.simMove(90,25),'25 m vers l\'est');mk('↓',()=>GPS.simMove(180,25),'25 m vers le sud');
  (extra||[]).forEach(x=>mk(x[0],x[1]));
}
