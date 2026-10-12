/* ================= lectores de planillas (navegador y node) ================= */
const POS={PL:{n:'Pilar',g:'F'},HK:{n:'Hooker',g:'F'},SL:{n:'2ª línea',g:'F'},BR:{n:'3ª línea',g:'F'},SH:{n:'Medio scrum',g:'B'},FH:{n:'Apertura',g:'B'},CE:{n:'Centro',g:'B'},WG:{n:'Wing',g:'B'},FB:{n:'Fullback',g:'B'}};
const POSK=Object.keys(POS);
const normTxt=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const hKey=s=>normTxt(s).replace(/\s+/g,'_');
const nameKey=s=>normTxt(s).replace(/[^a-z ]/g,' ').split(' ').filter(Boolean).sort().join(' ');
const cleanName=s=>String(s??'').replace(/\s+/g,' ').trim();
const POSMAP={pilar:'PL',pl:'PL',hooker:'HK',hk:'HK',segundalinea:'SL','2dalinea':'SL','2alinea':'SL',sl:'SL',lock:'SL',terceralinea:'BR','3ralinea':'BR','3alinea':'BR',br:'BR',ala:'BR',octavo:'BR',medioscrum:'SH',sh:'SH',apertura:'FH',fh:'FH',centro:'CE',ce:'CE',wing:'WG',wg:'WG',fullback:'FB',fb:'FB',ob:'WG'};
const mapPos=v=>POSMAP[normTxt(v).replace(/[^a-z0-9]/g,'')]||null;
const toNum=v=>{if(v==null||v==='')return NaN;if(typeof v==='number')return v;const s=String(v).trim();return +(s.includes(',')&&!s.includes('.')?s.replace(',','.'):s.replace(/,/g,''))};
const sum0=a=>a.reduce((x,y)=>x+y,0);
const r1=v=>isFinite(v)?Math.round(v*10)/10:null, r2=v=>isFinite(v)?Math.round(v*100)/100:null;
function dIso(v){if(v==null||v==='')return'';if(v instanceof Date){if(isNaN(v))return'';return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`}
 if(typeof v==='number'){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}
 const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}return''}
function tableOf(ws,XL){const a=XL.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});let i=0;while(i<a.length&&!(a[i]||[]).some(x=>x!=null&&String(x).trim()))i++;const hdr=(a[i]||[]).map(hKey);return{hdr,rows:a.slice(i+1).filter(r=>r&&r.some(x=>x!=null&&String(x).trim()!==''))}}
function detectKind(t){const h=new Set(t.hdr);const has=k=>h.has(k),some=re=>t.hdr.some(x=>re.test(x));
 if(has('jugador')&&has('periodo')&&has('actividad')&&has('distancia'))return'carga';
 if(has('secuencia')&&has('total_duration'))return'bip';
 if(has('masa_adiposa')||some(/sumatoria_pliegues/))return'nutri';
 if(some(/dolorido/)&&some(/recuperado/))return'well';
 if(has('region')&&some(/^dias/))return'les';
 if(has('resultado')&&(has('fecha')||has('partido')||has('rival')))return'res';
 return null}
const col=(t,...keys)=>{for(const k of keys){const i=typeof k==='string'?t.hdr.indexOf(k):t.hdr.findIndex(x=>k.test(x));if(i>=0)return i}return -1};
function parseAct(act){const name=String(act).replace(/^\s*sic\s+vs\.?\s*/i,'').trim();const team=/\(int\)/i.test(name)?'INT':'PRI';
 const phase=/final/i.test(name)?'Final':/semi/i.test(name)?'Semi':/\bpo\b|play.?off/i.test(name)?'PO':/\s2\s*$/.test(name)?'R2':'R1';
 const rival=name.replace(/\(int\)|\(semi\)|\bsemi\b|\bfinal\b|\bpo\b|\(amistoso\)/gi,'').replace(/\s2\s*$/,'').replace(/\s+/g,' ').trim();return{team,phase,rival}}

function parseCarga(t){
 const c={jug:col(t,'jugador'),per:col(t,'periodo'),act:col(t,'actividad'),fecha:col(t,'fecha'),pue:col(t,'puesto'),dmin:col(t,'duracion_(min)'),ds:col(t,'duracion_(s)'),dist:col(t,'distancia'),mpm:col(t,'mts/min'),acc:col(t,'max_acel'),acdc:col(t,'#_acdc'),dexp:col(t,'dist_exp'),eexp:col(t,'esf_expl'),hsr:col(t,/^hsr_\(/),rhie:col(t,'rhie_total_bouts'),big:col(t,'#_big'),bl:col(t,'big_(largo)'),bm:col(t,'big_(medio)'),bc:col(t,'big_(corto)'),cont:col(t,'contactos'),vmax:col(t,'max_vel'),etq:col(t,'etiqueta_de_actividad'),temp:col(t,'temporada')};
 const miss=['jug','per','act','fecha','dist'].filter(k=>c[k]<0);if(miss.length)throw new Error('La planilla de carga no tiene las columnas: '+miss.join(', '));
 const players={},ppos={},matches={},gps=[],tr={};const g=(r,k)=>c[k]<0?NaN:toNum(r[c[k]]);
 const qa={filas:t.rows.length,duplicadas:0,ficticias:0,sinFechaONombre:0,partidoSinDatos:0,periodosOtros:0,sesionRepetida:0,bigSinEventos:0};const seen=new Set();
 for(const r of t.rows){const sig=r.map(x=>x instanceof Date?x.getTime():x).join('\u0001');if(seen.has(sig)){qa.duplicadas++;continue}seen.add(sig);
  const name=cleanName(r[c.jug]);const date=dIso(r[c.fecha]);if(!name||!date){qa.sinFechaONombre++;continue}
  const dist=g(r,'dist'),mpm=g(r,'mpm');if(dist===1500&&mpm===12.5){qa.ficticias++;continue}
  const pos=c.pue>=0?mapPos(r[c.pue]):null;const key=nameKey(name);if(!players[key])players[key]={id:name};const pid=players[key].id;
  if(pos){const pp=ppos[pid]||(ppos[pid]={});pp[pos]=pp[pos]||{n:0,last:''};pp[pos].n++;if(date>pp[pos].last)pp[pos].last=date}
  const act=cleanName(r[c.act]);const per=normTxt(r[c.per]);const etq=c.etq>=0?normTxt(r[c.etq]):'';
  const isMatch=(etq==='partido'||/^sic\s+vs/i.test(act))&&!/amistoso/i.test(act);
  let min=g(r,'dmin');if(!isFinite(min)&&c.ds>=0)min=g(r,'ds')/60;
  if(isMatch){const P=per==='session'?'S':per==='primer tiempo'?'1':per==='segundo tiempo'?'2':null;if(!P){qa.periodosOtros++;continue}if(!(dist>0)||!(min>0)){qa.partidoSinDatos++;continue}if(P==='S'&&!(g(r,'big')>0))qa.bigSinEventos++;
   const mid=date+'|'+act;if(!matches[mid]){const pa=parseAct(act);const temp=c.temp>=0?toNum(r[c.temp]):NaN;matches[mid]={id:mid,date,season:isFinite(temp)?temp:+date.slice(0,4),act,...pa}}
   const nb=[g(r,'bl'),g(r,'bm'),g(r,'bc')].filter(isFinite);
   gps.push({mid,pid,per:P,pos,min:r2(min),dist:r1(dist),hsr:r1(g(r,'hsr')),dexp:r1(g(r,'dexp')),eexp:g(r,'eexp'),rhie:g(r,'rhie'),acdc:g(r,'acdc'),acc:g(r,'acc')>0?r2(g(r,'acc')):null,vmax:g(r,'vmax')>0?r2(g(r,'vmax')):null,cont:g(r,'cont'),nbig:nb.length?nb.reduce((a,b)=>a+b,0):null,big:g(r,'big')>0?r2(g(r,'big')):null});
  }else if(per==='session'){if(!(min>0))continue;const k=date+'|'+act+'|'+pid;if(tr[k]){qa.sesionRepetida++;continue}const nb=[g(r,'bl'),g(r,'bm'),g(r,'bc')].filter(isFinite);
   tr[k]={date,act,pid,pos,min:r1(min),dist:r1(g(r,'dist')||0),hsr:r1(g(r,'hsr')||0),dexp:r1(g(r,'dexp')||0),eexp:g(r,'eexp')||0,rhie:g(r,'rhie')||0,cont:g(r,'cont')||0,acdc:g(r,'acdc')||0,nbig:nb.length?nb.reduce((a,b)=>a+b,0):null,big:g(r,'big')>0?r2(g(r,'big')):null}}
 }
 // completar sesión de partido faltante con la suma de los tiempos
 const S=new Set(gps.filter(x=>x.per==='S').map(x=>x.mid+'|'+x.pid));const halves={};for(const x of gps)if(x.per!=='S'){const k=x.mid+'|'+x.pid;if(!S.has(k))(halves[k]=halves[k]||[]).push(x)}
 const sDay=new Set(gps.filter(x=>x.per==='S').map(x=>matches[x.mid].date+'|'+matches[x.mid].team+'|'+x.pid));qa.tiemposHuerfanos=[];
 for(const [k,hs] of Object.entries(halves)){const m0=matches[hs[0].mid];if(sDay.has(m0.date+'|'+m0.team+'|'+hs[0].pid)){qa.tiemposHuerfanos.push(`${hs[0].pid} · ${m0.date} · “${m0.act}”`);for(const h of hs)h._drop=1;continue}const s={...hs[0],per:'S'};for(const f of ['min','dist','hsr','dexp','eexp','rhie','acdc','cont','nbig'])s[f]=hs.reduce((a,b)=>a+(+b[f]||0),0);for(const f of ['acc','vmax'])s[f]=Math.max(...hs.map(h=>+h[f]||0));s.big=hs.reduce((a,b)=>a+(+b.big||0),0)/hs.length;gps.push(s)}
 for(const x of gps)for(const k in x)if(typeof x[k]==='number'&&!isFinite(x[k]))x[k]=null;
 const plist=Object.values(players).map(p=>{const pp=ppos[p.id]||{};const best=Object.entries(pp).sort((a,b)=>(b[1].last.slice(0,4)-a[1].last.slice(0,4))||b[1].n-a[1].n)[0];return{id:p.id,pos:best?best[0]:null}});
 const train=Object.values(tr);
 // sesión de partido repetida para el mismo jugador
 const seenS=new Set();const gps2=[];for(const x of gps){if(x._drop)continue;const k=x.mid+'|'+x.pid+'|'+x.per;if(seenS.has(k)){qa.sesionRepetida++;continue}seenS.add(k);gps2.push(x)}
 const withS=new Set(gps2.filter(x=>x.per==='S').map(x=>x.mid));for(const id of Object.keys(matches))if(!withS.has(id)){delete matches[id];qa.partidosSinSesion=(qa.partidosSinSesion||0)+1}
 qa.registrosPartido=gps2.filter(x=>x.per==='S').length;qa.sesionesEntrenamiento=train.length;qa.partidos=Object.keys(matches).length;qa.jugadoresSinPuesto=plist.filter(p=>!p.pos).map(p=>p.id);
 return{players:plist,matches:Object.values(matches).sort((a,b)=>a.date<b.date?-1:1),gps:gps2,train,qa};
}
function makeResolver(players){const m={};for(const p of players)m[nameKey(p.id)]=p.id;return(name,pos)=>{const n=cleanName(name);if(!n)return null;const k=nameKey(n);if(m[k])return m[k];
 // nombre con un apellido de más o de menos (al menos 2 palabras en común)
 const toks=k.split(' ');const sub=players.filter(p=>{const pk=nameKey(p.id).split(' ');const common=toks.filter(t=>pk.includes(t)).length;return common>=2&&(common===toks.length||common===pk.length)});if(sub.length===1){m[k]=sub[0].id;return sub[0].id}
 // error de tipeo (hasta 2 letras)
 const lev=(a,b)=>{const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]};
 if(k.length>8){const ty=players.filter(p=>lev(nameKey(p.id),k)<=2);if(ty.length===1){m[k]=ty[0].id;return ty[0].id}}
 players.push({id:n,pos:pos||null});m[k]=n;return n}}
const BIP_ALIAS={aa:'alumni',lt:'los tilos',hin:'hindu',cha:'champagnat',new:'newman',pla:'plaza'};
function parseBiP(t,ctx,sheetName){
 const c={par:col(t,'partido'),jug:col(t,'jugador'),seq:col(t,'secuencia'),pos:col(t,'position_name'),dur:col(t,'total_duration'),dist:col(t,'total_distance_(m)',/^total_distance/),acc:col(t,'acels_alta'),hsr:col(t,/^hsr/),big:col(t,'big_(s)'),cont:col(t,/contactos/)};
 const miss=['par','jug','seq','dur'].filter(k=>c[k]<0);if(miss.length)throw new Error('La planilla de Ball in Play no tiene las columnas: '+miss.join(', '));
 const ys=String(sheetName||'').match(/20\d\d/);const resolve=makeResolver(ctx.players);const seqs={},rows=[],unk=new Set();const qa={filas:t.rows.length,duplicadas:0,duracionInconsistente:0,nombresNuevos:[]};const seenB=new Set();const np0=ctx.players.length;
 const findMatch=code=>{const p=String(code).trim().replace(/^sic[_\s-]*/i,'');const m=p.match(/^(.*?)(?:[_\s-]+(\d))?$/);const base=normTxt(m[1].replace(/_/g,' '));const rnd=m[2]==='2'?'R2':'R1';const riv=BIP_ALIAS[base]||base;
  let c2=ctx.matches.filter(x=>x.team==='PRI'&&normTxt(x.rival)===riv&&(ys?x.season===+ys[0]:true));if(!c2.length)c2=ctx.matches.filter(x=>x.team==='PRI'&&normTxt(x.rival).startsWith(riv)&&(ys?x.season===+ys[0]:true));
  const byR=c2.filter(x=>x.phase===rnd);const pick=(byR.length?byR:c2.filter(x=>rnd==='R1'?x.phase==='R1':x.phase!=='R1')).sort((a,b)=>a.date<b.date?1:-1)[0];return pick?pick.id:null};
 const mm={};
 for(const r of t.rows){const code=String(r[c.par]??'').trim();if(!code)continue;if(!(code in mm)){mm[code]=findMatch(code);if(!mm[code])unk.add(code)}const mid=mm[code]||('BIP|'+code);
  const n=parseInt(String(r[c.seq]).replace(/\D+/g,''),10);const dur=toNum(r[c.dur]);if(!isFinite(n)||!(dur>0))continue;const k=mid+'|'+n;if(seqs[k]&&Math.abs(seqs[k].dur-dur)>1)qa.duracionInconsistente++;if(!seqs[k]||dur>seqs[k].dur)seqs[k]={mid,n,dur};
  const bk=k+'|'+nameKey(r[c.jug]);if(seenB.has(bk)){qa.duplicadas++;continue}seenB.add(bk);
  const pos=c.pos>=0?mapPos(r[c.pos]):null;const pid=resolve(r[c.jug],pos);if(!pid)continue;const v=k2=>c[k2]<0?null:toNum(r[c[k2]]);
  rows.push({mid,pid,n,pos,dur,dist:r1(v('dist')),acc:v('acc'),hsr:r1(v('hsr')),big:isFinite(v('big'))?r2(v('big')):null,cont:v('cont')})}
 // secuencias repetidas: mismo partido, mismos jugadores y mismos valores con otro número de secuencia
 qa.secuenciasRepetidas=[];const sig={},drop=new Set();const bySeq={};for(const r of rows)(bySeq[r.mid+'|'+r.n]=bySeq[r.mid+'|'+r.n]||[]).push(r);
 for(const [k,rs] of Object.entries(bySeq).sort((a,b)=>{const [ma,na]=[a[0].split('|').slice(0,-1).join('|'),+a[0].split('|').pop()],[mb,nb]=[b[0].split('|').slice(0,-1).join('|'),+b[0].split('|').pop()];return ma<mb?-1:ma>mb?1:na-nb})){const mid=rs[0].mid;if(sum0(rs.map(r=>r.dist||0))<=0)continue;const sg=mid+'#'+rs.map(r=>[nameKey(r.pid),r.dur,r.dist,r.hsr,r.cont,r.acc].join(':')).sort().join(';');if(sig[sg]!=null){drop.add(k);qa.secuenciasRepetidas.push(`${mid.split('|').pop()} · secuencia ${rs[0].n} = ${sig[sg]}`)}else sig[sg]=rs[0].n}
 if(drop.size){for(let i=rows.length-1;i>=0;i--)if(drop.has(rows[i].mid+'|'+rows[i].n))rows.splice(i,1);for(const k of drop)delete seqs[k]}
 for(const code of unk)if(!ctx.matches.some(m=>m.id==='BIP|'+code))ctx.matches.push({id:'BIP|'+code,date:'',season:ys?+ys[0]:null,act:code,team:'PRI',phase:/_2$/.test(code)?'R2':'R1',rival:code.replace(/^sic_/i,'')});
 qa.nombresNuevos=ctx.players.slice(np0).map(p=>p.id);qa.secuencias=Object.keys(seqs).length;return{seq:Object.values(seqs),bipP:rows,unmatched:[...unk],qa};
}
function parseNutri(t,ctx){
 const c={jug:col(t,'jugador'),pue:col(t,'puesto'),fecha:col(t,'fecha'),adip:col(t,'masa_adiposa'),musc:col(t,'masa_muscular'),resid:col(t,'masa_residual'),osea:col(t,'masa_osea'),piel:col(t,'masa_de_la_piel'),peso:col(t,/^peso/),talla:col(t,/^talla/),zad:col(t,/score_z/),sum:col(t,/sumatoria_pliegues/),imo:col(t,'im/o'),obs:col(t,'observaciones')};
 const miss=['jug','fecha'].filter(k=>c[k]<0);if(miss.length)throw new Error('La planilla de nutrición no tiene las columnas: '+miss.join(', '));
 const resolve=makeResolver(ctx.players);const out=[];const v=(r,k)=>c[k]<0?null:toNum(r[c[k]]);const qa={filas:t.rows.length,pesoInvalido:0,nombresNuevos:[]};const np0=ctx.players.length;
 for(const r of t.rows){const date=dIso(r[c.fecha]);const pos=c.pue>=0?mapPos(r[c.pue]):null;const pid=resolve(r[c.jug],pos);if(!pid||!date)continue;let peso=v(r,'peso');if(!(peso>40)){qa.pesoInvalido++;peso=null}
  const o={date,pid,pos,adip:r2(v(r,'adip')),musc:r2(v(r,'musc')),resid:r2(v(r,'resid')),osea:r2(v(r,'osea')),piel:r2(v(r,'piel')),peso,talla:v(r,'talla'),zad:r2(v(r,'zad')),sum:r1(v(r,'sum')),imo:r2(v(r,'imo')),obs:c.obs>=0&&r[c.obs]?String(r[c.obs]):''};
  for(const k in o)if(typeof o[k]==='number'&&!isFinite(o[k]))o[k]=null;out.push(o)}
 qa.nombresNuevos=ctx.players.slice(np0).map(p=>p.id);return{antro:out,qa};
}
const WIT=[['c','Cansancio post esfuerzo'],['r','Recuperación'],['s','Sueño'],['d','Dolor muscular'],['m','Cansancio mental']];
function parseWell(t,ctx){
 const c={ts:col(t,'timestamp','fecha','marca_temporal'),jug:col(t,'apellido_y_nombre','jugador','nombre'),c:col(t,/cansado_terminaste/,/cansancio/),r:col(t,/recuperado/),s:col(t,/sueno/),d:col(t,/^que_tan_dolorido|^dolor/),m:col(t,/mental/),z:col(t,/parte_del_cuerpo/),sy:col(t,/sintomas/),co:col(t,/comentarios/)};
 const miss=['ts','jug','c','r','s','d','m'].filter(k=>c[k]<0);if(miss.length)throw new Error('La planilla de bienestar no tiene las columnas: '+miss.join(', '));
 const qa={filas:t.rows.length,incompletas:0,nombresNuevos:[]};const np0=ctx.players.length;const resolve=makeResolver(ctx.players);const out=[];const split=v=>v==null?[]:String(v).split(/\s*,\s*/).map(s=>s.trim()).filter(s=>s&&!/^nada$/i.test(s));
 for(const r of t.rows){const raw=r[c.ts];const date=dIso(raw);const pid=resolve(r[c.jug]);if(!pid||!date)continue;const it=WIT.map(([k])=>{const x=toNum(r[c[k]]);return x>=1&&x<=5?x:null});if(it.filter(x=>x!=null).length<4){qa.incompletas++;continue}
  const ts=raw instanceof Date?`${date}T${String(raw.getHours()).padStart(2,'0')}:${String(raw.getMinutes()).padStart(2,'0')}`:date;
  out.push({date,ts,pid,it,zones:c.z>=0?split(r[c.z]):[],sym:c.sy>=0?split(r[c.sy]):[],com:c.co>=0&&r[c.co]?String(r[c.co]).replace(/\s+/g,' ').trim():''})}
 qa.nombresNuevos=ctx.players.slice(np0).map(p=>p.id);return{well:out,qa};
}
function parseLes(t,ctx){
 const c={jug:col(t,'jugador'),fecha:col(t,'fecha'),reg:col(t,'region'),tipo:col(t,'tipo'),mec:col(t,'mecanismo'),ctx:col(t,'contexto'),dias:col(t,/^dias/),alta:col(t,/alta|retorno/)};
 const resolve=makeResolver(ctx.players);const out=[];
 for(const r of t.rows){const pid=resolve(r[c.jug]);const d=dIso(r[c.fecha]);if(!pid||!d)continue;let days=toNum(r[c.dias]);const alta=c.alta>=0?dIso(r[c.alta]):'';if(!isFinite(days)&&alta)days=Math.round((new Date(alta)-new Date(d))/864e5);
  out.push({pid,date:d,season:+d.slice(0,4),region:String(r[c.reg]??'–'),tipo:c.tipo>=0?String(r[c.tipo]??'–'):'–',mec:c.mec>=0?String(r[c.mec]??'–'):'–',ctx:c.ctx>=0&&/part/i.test(String(r[c.ctx]))?'Partido':'Entrenamiento',days:isFinite(days)?days:0,mid:''})}
 return{inj:out};
}
function parseRes(t,ctx){
 const c={fecha:col(t,'fecha'),riv:col(t,'rival','partido'),eq:col(t,'equipo'),res:col(t,'resultado'),pf:col(t,'pts_favor','puntos_favor','pf'),pa:col(t,'pts_contra','puntos_contra','pc','pa')};const out={};let n=0;
 for(const r of t.rows){const d=dIso(r[c.fecha]);const team=c.eq>=0&&/int/i.test(String(r[c.eq]))?'INT':'PRI';const riv=c.riv>=0?normTxt(String(r[c.riv]).replace(/^sic\s+vs\.?\s*/i,'')):'';
  const m=ctx.matches.find(x=>x.team===team&&(d?x.date===d:true)&&(!riv||normTxt(x.rival).startsWith(riv.split(' (')[0])||riv.startsWith(normTxt(x.rival))));if(!m)continue;
  const R=String(r[c.res]??'').trim().toUpperCase()[0];if(!'GPE'.includes(R)||!R)continue;out[m.id]={r:R,pf:toNum(r[c.pf]),pa:toNum(r[c.pa])};n++}
 return{res:out,n};
}
/* lee un libro (objeto SheetJS) y devuelve lo que encontró por tipo */
function readWorkbook(wb,XL){const found=[];for(const sn of wb.SheetNames){const t=tableOf(wb.Sheets[sn],XL);if(!t.hdr.length||!t.rows.length)continue;const k=detectKind(t);if(k)found.push({kind:k,sheet:sn,t})}
 if(found.some(f=>f.kind==='carga'))return found.filter(f=>f.kind!=='carga'||f.sheet===found.find(x=>x.kind==='carga').sheet);return found}
function applyFound(DB,found){const msgs=[];const order=['carga','bip','nutri','well','les','res'];found.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
 for(const f of found){
  if(f.kind==='carga'){const r=parseCarga(f.t);const keep={players:DB.players||[]};
   // conservar jugadores agregados por otras planillas
   const ids=new Set(r.players.map(p=>p.id));for(const p of keep.players)if(!ids.has(p.id)&&!r.players.some(q=>nameKey(q.id)===nameKey(p.id)))r.players.push(p);
   const bipM=(DB.matches||[]).filter(m=>m.id.startsWith('BIP|'));DB._qa=DB._qa||{};DB._qa.carga=r.qa;delete r.qa;Object.assign(DB,r);DB.matches.push(...bipM);msgs.push(`Carga: ${r.gps.filter(x=>x.per==='S').length} registros de partido en ${r.matches.length} partidos y ${r.train.length} sesiones de entrenamiento.`)}
  else{const ctx={players:DB.players||(DB.players=[]),matches:DB.matches||(DB.matches=[])};
   DB._qa=DB._qa||{};if(f.kind==='bip'){const r=parseBiP(f.t,ctx,f.sheet);DB._qa.bip={...r.qa,sinVincular:r.unmatched};DB.seq=r.seq;DB.bipP=r.bipP;msgs.push(`Ball in Play: ${r.seq.length} secuencias en ${new Set(r.seq.map(s=>s.mid)).size} partidos${r.unmatched.length?` (sin vincular a GPS: ${r.unmatched.join(', ')})`:''}.`)}
   if(f.kind==='nutri'){const r=parseNutri(f.t,ctx);DB._qa.nutri=r.qa;DB.antro=r.antro;msgs.push(`Nutrición: ${r.antro.length} mediciones de ${new Set(r.antro.map(a=>a.pid)).size} jugadores.`)}
   if(f.kind==='well'){const r=parseWell(f.t,ctx);DB._qa.well=r.qa;DB.well=r.well;msgs.push(`Bienestar: ${r.well.length} respuestas de ${new Set(r.well.map(a=>a.pid)).size} jugadores.`)}
   if(f.kind==='les'){const r=parseLes(f.t,ctx);DB.inj=r.inj;msgs.push(`Lesiones: ${r.inj.length} registros.`)}
   if(f.kind==='res'){const r=parseRes(f.t,ctx);DB._res=r.res;msgs.push(`Resultados: ${r.n} partidos.`)}
  }}
 return msgs}
if(typeof module!=='undefined')module.exports={readWorkbook,applyFound,detectKind,POS};
