// Outil de maquette (pas du code d'app). Usage: PW_CORE=<chemin playwright-core> node build.mjs
// Genere with-content.html / without-content.html (7 etats chacun), rend chaque cadre en PNG 390x844 DPR2,
// ecrit frames.json (mesures : cibles <44, textes <12, emoji) et index.html (galerie).
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const svg=(n,f)=>{const file=path.join(here,'icons',(f?n:n+'-outline')+'.svg');
  return fs.readFileSync(file,'utf8').replace(/<title>.*?<\/title>/,'').replace('<svg ','<svg aria-hidden="true" ');};
const I=(n,f,st)=>`<i class="ic"${st?` style="${st}"`:''}>${svg(n,f)}</i>`;

// ---- donnees (alignees sur ziko_quest_templates + parseQuestSync) ----
const Q={
 water:{icon:'water',tone:'in',title:"Bois 2 litres d'eau",action:"Ajoute chaque verre dans Hydratation.",cta:'Boire',coins:15,txt:p=>`${p} / 2 L`,ratio:p=>p/2,a11yCta:"Boire de l'eau, ouvrir Hydratation"},
 meal:{icon:'restaurant',tone:'pr',title:'Ajoute un repas',action:'Note ton premier repas dans Nutrition.',cta:'Ajouter',coins:15,txt:()=>null,ratio:()=>0,a11yCta:'Ajouter un repas, ouvrir Nutrition'},
 workout:{icon:'barbell',tone:'pr',title:'Termine une séance',action:"Lance une séance depuis l'onglet Séance.",cta:'Séance',coins:25,txt:()=>null,ratio:()=>0,a11yCta:"Lancer une séance, ouvrir l'onglet Séance"},
};
const rowActive=(q,p=0,extra='')=>`<div class="qrow" data-tap role="button" aria-label="${q.title}. ${q.txt(p)??'En cours'}. Récompense ${q.coins} pièces. ${q.action}">
  <div class="ico ${q.tone}">${I(q.icon,1)}</div>
  <div class="sp stack g4"><div class="b qt">${q.title}</div><div class="sm mu">${q.action}</div>
   <div class="row" style="gap:8px"><div class="bar sp" style="height:6px"><i style="width:${Math.round(q.ratio(p)*100)}%"></i></div>${q.txt(p)?`<span class="sm mu num">${q.txt(p)}</span>`:''}<span class="coin num">${I('disc',1)}${q.coins}</span></div></div>
  <div class="go" data-tap>${q.cta}${I('chevron-forward',0)}</div></div>`;
const rowDone=(q,hl)=>`<div class="qrow done${hl?' just':''}" aria-label="${q.title}. Terminé, plus ${q.coins} pièces récupérées">
  <div class="ico ok">${I('checkmark-circle',1)}</div>
  <div class="sp stack g4"><div class="b qt">${q.title}</div><div class="sm" style="color:var(--success)">Terminé · +${q.coins} pièces récupérées</div></div>${hl?`<span class="pop num">+${q.coins}</span>`:''}</div>`;
const head=(r)=>`<div class="qhead"><h3 class="ov" role="heading" aria-level="2">Quêtes du jour</h3><span class="sm mu num">${r}</span></div>`;
const skRow=`<div class="qrow"><div class="sk" style="width:44px;height:44px;border-radius:12px"></div><div class="sp stack g8"><div class="sk" style="height:14px;width:62%"></div><div class="sk" style="height:12px;width:88%"></div><div class="sk" style="height:6px;width:100%"></div></div></div>`;

const STATES={
 trois:{title:"1 · Trois quêtes actives (compte neuf)",body:head('3 en cours')+`<div class="card np">${rowActive(Q.water,0)}${rowActive(Q.meal)}${rowActive(Q.workout)}</div>`},
 deux:{title:"2 · Deux quêtes actives, une terminée plus tôt (1 / 3 faite)",body:head('2 en cours')+`<div class="card np">${rowActive(Q.water,1.2)}${rowActive(Q.workout)}${rowDone(Q.meal,false)}</div>`},
 terminee:{title:"3 · Quête qui vient d'être terminée (célébration sobre + toast)",body:head('2 en cours')+`<div class="card np">${rowDone(Q.water,true)}${rowActive(Q.meal)}${rowActive(Q.workout)}</div>`,toast:"Quête terminée : Bois 2 litres d'eau (+15 pièces)"},
 toutes:{title:"4 · Toutes les quêtes terminées",body:head('3 sur 3')+`<div class="card all"><div class="ico ok" style="width:56px;height:56px;font-size:28px">${I('checkmark-circle',1)}</div><div class="sp stack g4"><div class="h3">Bravo, tout est fait</div><div class="sm mu">De nouvelles quêtes arrivent bientôt.</div><div class="row sm b" style="gap:6px;color:#7A5800;margin-top:4px">${I('disc',1)}<span class="num">+55 pièces gagnées</span></div></div></div>`},
 chargement:{title:"5 · Chargement (première lecture)",body:head('')+`<div class="card np" aria-busy="true" aria-label="Chargement des quêtes">${skRow}${skRow}${skRow}</div>`},
 creation:{title:"6 · Quêtes en cours de création (liste vide, synchro lancée)",body:head('')+`<div class="card empty2"><div class="ico pr">${I('sync',0)}</div><div class="sp stack g4"><div class="h3">Tes quêtes se préparent</div><div class="sm mu">Elles s'affichent ici dans un instant.</div></div></div>`},
 erreur:{title:"7 · Erreur avec réessai (le reste de l'accueil reste utilisable)",body:head('')+`<div class="card err"><div class="row" style="align-items:flex-start"><div class="ico" style="background:var(--danger-tint);color:var(--danger)">${I('alert-circle',1)}</div><div class="sp stack g4"><div class="h3">Quêtes indisponibles</div><div class="sm mu">Impossible de charger tes quêtes. Vérifie ta connexion puis réessaie.</div></div></div><div class="btn full" data-tap role="button" aria-label="Réessayer de charger les quêtes">${I('refresh',0)}Réessayer</div></div>`},
};

const mission=`<div class="mission"><div class="mo">Mission du jour</div><div class="mt">Bois ton premier verre d'eau</div><div class="mb" data-tap>C'est parti</div></div>`;
const p2=`<div class="p2"><span class="bdg in">PHASE 2</span><div class="b" style="margin-top:6px">Crée ton premier entraînement</div><div class="sm mu">Emplacement réservé : carte à 3 chemins (hauteur de réserve 176 dp). Maquette dans la phase 2.</div></div>`;
const tb=`<div class="tb">${[['home','Accueil',1],['barbell','Séance',0],['person','Profil',0]].map(t=>`<div${t[2]?' class="on"':''}>${I(t[0],t[2])}<span>${t[1]}</span></div>`).join('')}</div>`;
const sb=`<div class="sb"><span>9:41</span><span class="r">${I('cellular',1)}${I('wifi',1)}${I('battery-full',1)}</span></div>`;

const CSS=`
.stackhome{display:flex;flex-direction:column;padding-top:12px}.scr.scrolled{padding-bottom:0}.scr.scrolled .stackhome{position:absolute;left:16px;right:16px;bottom:96px;padding-top:0}
.qhead{display:flex;align-items:baseline;justify-content:space-between;margin:20px 0 8px;min-height:20px}
.qrow{display:flex;align-items:center;gap:12px;min-height:84px;padding:12px 14px;position:relative}.qrow+.qrow{border-top:1px solid var(--border)}
.qt{font:700 15px/1.3 var(--font-d)}
.coin{display:inline-flex;align-items:center;gap:3px;font:700 13px var(--font-b);color:#7A5800;flex:none}
.go{display:inline-flex;align-items:center;gap:2px;height:44px;min-width:44px;padding:0 10px 0 14px;border-radius:12px;background:var(--primary-tint);border:1px solid #FFD2BC;color:#B53D05;font:600 14px var(--font-b);flex:none}
.go .ic{font-size:16px}
.qrow.done{background:var(--surface)}.qrow.just{background:var(--success-tint);animation:tint 250ms var(--ease)}
.pop{position:absolute;right:14px;top:10px;font:800 14px var(--font-b);color:#7A5800;background:var(--gold-tint);border-radius:999px;padding:2px 10px;animation:rise 600ms var(--ease)}
.toast{bottom:auto;top:52px;z-index:5}
@keyframes tint{from{background:var(--surface)}}@keyframes rise{from{transform:translateY(8px);opacity:0}}
.card.all{display:flex;gap:14px;align-items:center;background:var(--success-tint);border-color:#BFE1CC}
.card.empty2{display:flex;gap:14px;align-items:center}.card.err{display:flex;flex-direction:column;gap:14px;border-color:#F0C9C5}
.mission{background:#1C1A17;border-radius:12px;padding:18px;position:relative;overflow:hidden}.mo{font:700 11px var(--font-b);letter-spacing:.1em;text-transform:uppercase;color:rgba(255,250,246,.65)}
.mt{font:800 22px/1.15 var(--font-d);color:#FFFAF6;margin-top:6px;max-width:85%}.mb{margin-top:14px;height:48px;border-radius:999px;background:#FF5C1A;color:#fff;display:flex;align-items:center;justify-content:center;font:700 14px var(--font-b)}
.p2{height:176px;border:2px dashed #2563C9;border-radius:16px;padding:16px;background:rgba(232,240,253,.5);margin-bottom:12px}
.fr>h2{max-width:390px}.gal{display:flex;flex-wrap:wrap;gap:24px}
@media (prefers-reduced-motion:reduce){.sk,.qrow.just,.pop{animation:none}}
`;
function frame(id,st,variant){const s=STATES[st];const wc=variant==='with';
  return `<div class="fr" data-id="${id}"><h2>${s.title} — ${wc?'avec carte Phase 2 + Mission du jour':'bloc Quêtes seul (ni carte Phase 2, ni Mission)'}</h2><div class="phone">${sb}<div class="scr ${wc?'scrolled':'pb'}"><div class="stackhome">${wc?p2+`<div style="margin-bottom:0">${mission}</div>`:''}<div style="${wc?'':'margin-top:-8px'}">${s.body}</div></div></div>${s.toast?`<div class="toast">${I('checkmark-circle',1,'font-size:20px;color:#7FD6A0')}<span>${s.toast}</span></div>`:''}${tb}</div></div>`;}
const page=(v)=>`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quêtes accueil ${v==='with'?'avec contenu':'sans contenu'}</title><link rel="stylesheet" href="tokens.css"><style>${CSS}</style></head><body>${Object.keys(STATES).map(k=>frame(`${v}-${k}`,k,v)).join('')}</body></html>`;
fs.writeFileSync(path.join(here,'with-content.html'),page('with'));fs.writeFileSync(path.join(here,'without-content.html'),page('without'));

const require=createRequire(import.meta.url);const {chromium}=require(process.env.PW_CORE);
fs.mkdirSync(path.join(here,'png'),{recursive:true});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1700,height:1000},deviceScaleFactor:2});const meta=[];
for(const f of ['with-content.html','without-content.html']){const p=await ctx.newPage();await p.goto('file:///'+path.join(here,f).replace(/\\/g,'/'));await p.evaluate(()=>document.fonts.ready);
 for(const fr of await p.$$('.fr[data-id]')){const id=await fr.getAttribute('data-id');const ph=await fr.$('.phone');await ph.screenshot({path:path.join(here,'png',id+'.png'),animations:'disabled'});
  const m=await p.evaluate(el=>{const ph=el.querySelector('.phone');const r=ph.getBoundingClientRect();const bad=[];
   ph.querySelectorAll('[data-tap]').forEach(e=>{const q=e.getBoundingClientRect();if(q.height&&(q.height<43.5||q.width<43.5))bad.push((e.className||e.tagName)+':'+Math.round(q.width)+'x'+Math.round(q.height));});
   const small=[];ph.querySelectorAll('*').forEach(e=>{if(e.children.length===0&&e.textContent.trim()&&!e.closest('.mission')){const fs=parseFloat(getComputedStyle(e).fontSize);if(fs<12)small.push(e.textContent.trim().slice(0,20)+':'+fs);}});
   const sc=ph.querySelector('.scr'),tbar=ph.querySelector('.tb').getBoundingClientRect();let last=0;sc.querySelectorAll('.stackhome > *').forEach(e=>{last=Math.max(last,e.getBoundingClientRect().bottom);});
   const overflowX=[...ph.querySelectorAll('.scr *')].filter(e=>e.getBoundingClientRect().right>r.right-15.5).length;
   const q=ph.querySelector('.qhead');const qr=q?q.getBoundingClientRect():null;
   const emoji=/\p{Extended_Pictographic}/u.test(ph.innerText);
   return {w:r.width,h:r.height,bad,small,contentBottomToTabBar:Math.round(tbar.top-last),overflowX,quetesTop:qr?Math.round(qr.top-r.top):null,emoji,title:el.querySelector('h2').textContent};},fr);
  meta.push({id,file:f,...m});}
 await p.close();}
await b.close();fs.writeFileSync(path.join(here,'frames.json'),JSON.stringify(meta,null,1));
console.log(meta.map(m=>`${m.id} ${m.w}x${m.h} tap<44:${m.bad.length} font<12:${m.small.length} gapToTabBar:${m.contentBottomToTabBar} ovX:${m.overflowX} emoji:${m.emoji}`).join('\n'));
const gal=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Galerie P1 Quêtes</title><style>body{background:#E9E7E1;font-family:system-ui,sans-serif;color:#1C1A17;padding:24px;margin:0}h1{font-size:22px}h2{font-size:15px;margin:32px 0 12px}.g{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;width:390px}figcaption{font-size:13px;color:#6B6963;margin-top:6px}img{width:390px;height:844px;border-radius:12px;box-shadow:0 2px 12px rgba(28,26,23,.15);display:block}</style></head><body><h1>Phase 1 · Quêtes dès l'inscription : maquettes (390x844, DPR2)</h1><p>Contrat : <a href="01-DESIGN-CONTRACT.md">01-DESIGN-CONTRACT.md</a> · Critique : <a href="01-DESIGN-CRITIQUE.md">01-DESIGN-CRITIQUE.md</a></p>${['with','without'].map(v=>`<h2>${v==='with'?'Variante avec contenu (pile : carte Phase 2, Mission du jour, Quêtes)':'Variante sans contenu autour (bloc Quêtes seul)'}</h2><div class="g">${meta.filter(m=>m.id.startsWith(v+'-')).map(m=>`<figure><img src="png/${m.id}.png" alt="${m.title.replace(/"/g,'')}"><figcaption>${m.title}</figcaption></figure>`).join('')}</div>`).join('')}</body></html>`;
fs.writeFileSync(path.join(here,'index.html'),gal);
