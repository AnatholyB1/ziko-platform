// Outil de maquette (pas du code d'app). Usage: node shared/build.mjs lot-A [ICONS_DIR]
// - inline les icones Ionicons (<i class="ic" data-n="flame" [data-f]>), ecrit lot-X/*.html
// - rend chaque .fr[data-id] .phone en PNG 390x844 DPR2 avec un seul chromium headless.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const lot=process.argv[2];const iconsSrc=process.argv[3]||process.env.IONICONS_SVG;
const iconsLocal=path.join(here,'icons');const src=path.join(root,lot,'src');
function svg(n,filled){const f=filled?n:`${n}-outline`;const loc=path.join(iconsLocal,f+'.svg');
  if(!fs.existsSync(loc)){if(!iconsSrc)throw new Error('icone manquante '+f);fs.copyFileSync(path.join(iconsSrc,f+'.svg'),loc);}
  return fs.readFileSync(loc,'utf8').replace(/<title>.*?<\/title>/,'').replace('<svg ','<svg aria-hidden="true" ');}
const pages=[];
for(const f of fs.readdirSync(src).filter(x=>x.endsWith('.html')).sort()){
  let h=fs.readFileSync(path.join(src,f),'utf8');
  h=h.replace(/<!--INC:(\w+)-->/g,(_,n)=>fs.readFileSync(path.join(src,n+".frag"),"utf8"));
  const I=(n,f)=>`<i class="ic" data-n="${n}"${f?' data-f':''}></i>`;
  h=h.replace(/<!--SB-->/g,`<div class="sb"><span>9:41</span><span class="r">${I('cellular',1)}${I('wifi',1)}${I('battery-full',1)}</span></div>`);
  h=h.replace(/<!--TB:(\d)-->/g,(_,k)=>{const t=[['home','Accueil'],['barbell','Séances'],['sparkles','Coach IA'],['apps','Modules'],['person','Profil']];
    return `<div class="tb">${t.map((x,i)=>`<div${i==k?' class="on"':''}>${I(x[0],i==k)}<span>${x[1]}</span></div>`).join('')}</div>`;});
  h=h.replace(/<i class="ic([^"]*)" data-n="([^"]+)"( data-f)?( style="[^"]*")?><\/i>/g,(_,c,n,fl,st)=>`<i class="ic${c}"${st||""}>${svg(n,!!fl)}</i>`);
  const title=(h.match(/<!--\s*title:(.*?)-->/)||[])[1]||f;
  const out=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.trim()}</title><link rel="stylesheet" href="../shared/tokens.css"><style>${fs.existsSync(path.join(src,'extra.css'))?fs.readFileSync(path.join(src,'extra.css'),'utf8'):''}</style></head><body>${h}</body></html>`;
  fs.writeFileSync(path.join(root,lot,f),out);pages.push(f);}
const require=(await import('node:module')).createRequire(import.meta.url);
const pwPath=process.env.PW_CORE;const {chromium}=require(pwPath);
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1700,height:1000},deviceScaleFactor:2,isMobile:false});
const meta=[];
for(const f of pages){const p=await ctx.newPage();await p.goto('file:///'+path.join(root,lot,f).replace(/\\/g,'/'));await p.evaluate(()=>document.fonts.ready);
  const frs=await p.$$('.fr[data-id]');
  for(const fr of frs){const id=await fr.getAttribute('data-id');const ph=await fr.$('.phone');
    await ph.screenshot({path:path.join(root,lot,'png',id+'.png')});
    const m=await p.evaluate(el=>{const ph=el.querySelector('.phone');const r=ph.getBoundingClientRect();const bad=[];
      ph.querySelectorAll('button,.btn,.ib,.chip.tap,.seg>*,.tabs>*,.act,.li[data-tap],[data-tap]').forEach(e=>{const q=e.getBoundingClientRect();if(q.height&&(q.height<43.5||q.width<43.5))bad.push((e.className||e.tagName)+':'+Math.round(q.width)+'x'+Math.round(q.height));});
      const small=[];ph.querySelectorAll('*').forEach(e=>{if(e.children.length===0&&e.textContent.trim()){const fs=parseFloat(getComputedStyle(e).fontSize);if(fs<12)small.push(e.textContent.trim().slice(0,20)+':'+fs);}});
      return {w:r.width,h:r.height,bad,small,title:el.querySelector('h2')?.textContent};},fr);
    meta.push({id,file:f,...m});}
  await p.close();}
await b.close();fs.writeFileSync(path.join(root,lot,'frames.json'),JSON.stringify(meta,null,1));
console.log(meta.map(m=>`${m.id} ${m.w}x${m.h} tap<44:${m.bad.length} font<12:${m.small.length}`).join('\n'));
