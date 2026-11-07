// Renders every prototype in the design dir (390x844, DPR2, headless chromium) and measures it.
// Usage: node measure.js <designDir> [shot]  (needs playwright-core + a chromium)
const {chromium}=require('playwright-core');const fs=require('fs');const path=require('path');
const dir=process.argv[2];const shot=process.argv[3]!=='noshot';
const exe=process.env.CHROMIUM_PATH||'C:/Users/Anatholy/AppData/Local/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe';
(async()=>{
 const b=await chromium.launch({executablePath:exe});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const out=[];
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.html')).sort()){
  const pg=await ctx.newPage();await pg.goto('file:///'+path.resolve(dir,f).replace(/\\/g,'/'));await pg.waitForTimeout(150);
  const r=await pg.evaluate(()=>{
   const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return[0,0,0,0];const a=m[1].split(/[ ,\/]+/).map(Number);return[a[0],a[1],a[2],a[3]===undefined?1:a[3]]};
   const over=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3])).concat(1);
   const lum=c=>{const t=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*t[0]+.7152*t[1]+.0722*t[2]};
   const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   const bgOf=el=>{const chain=[];for(let e=el;e;e=e.parentElement){chain.push(parse(getComputedStyle(e).backgroundColor))}let base=[255,255,255,1];for(let i=chain.length-1;i>=0;i--){if(chain[i][3]>0)base=over(chain[i],base)}return base};
   const res={overflowX:document.documentElement.scrollWidth>390,small:[],tap:[],contrast:[],texts:0};
   const screen=document.querySelector('.screen');
   const sr=screen.getBoundingClientRect();
   const walker=document.createTreeWalker(screen,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode()){if(!n.textContent.trim())continue;const el=n.parentElement;const cs=getComputedStyle(el);res.texts++;
    const fs=parseFloat(cs.fontSize);const allow=el.closest('.cell')&&!el.closest('.lvl')&&el.classList.contains('nm')?10:el.classList.contains('lvl')?11:14;
    if(fs<allow)res.small.push([n.textContent.trim().slice(0,30),fs]);
    if(fs<14&&allow>=14)res.small.push(['!',n.textContent.trim(),fs]);
    const fg=parse(cs.color);const bg=bgOf(el);const fgc=over(fg,bg);const ratio=cr(fgc,bg);const big=fs>=24||(fs>=18.66&&parseInt(cs.fontWeight)>=700);
    const need=big?3:4.5;if(ratio<need)res.contrast.push([n.textContent.trim().slice(0,30),+ratio.toFixed(2),need]);
    const r=el.getBoundingClientRect();if(r.right>sr.right+0.5||r.left<sr.left-0.5)res.small.push(['OUT_OF_BOUNDS',n.textContent.trim().slice(0,20)]);
   }
   document.querySelectorAll('[data-tap]').forEach(e=>{const r=e.getBoundingClientRect();if(r.width<44||r.height<44)res.tap.push([e.textContent.trim().slice(0,20)||e.getAttribute('aria-label'),Math.round(r.width),Math.round(r.height)])});
   res.tapCount=document.querySelectorAll('[data-tap]').length;
   // non-text contrast: lock glyph, progress fill
   const nt=[];const chk=(sel,label)=>{const e=document.querySelector(sel);if(!e)return;const bg=bgOf(e.parentElement);const fg=over(parse(getComputedStyle(e).color==='rgba(0, 0, 0, 0)'?getComputedStyle(e).backgroundColor:getComputedStyle(e).color),bg);nt.push([label,+cr(fg,bg).toFixed(2)])};
   chk('.cell.locked .tile','locked icon vs tile (>=3)');chk('.lockdot','lock glyph vs chip (>=3)');
   const b=document.querySelector('.bar b');if(b){const bg=bgOf(b.parentElement);nt.push(['progress fill vs track',+cr(over(parse(getComputedStyle(b).backgroundColor),bg),bg).toFixed(2)])}
   res.nonText=nt;return res});
  if(shot){await pg.locator('.screen').screenshot({path:path.join(dir,f.replace('.html','.png'))})}
  out.push({file:f,...r});await pg.close();
 }
 await b.close();
 fs.writeFileSync(path.join(dir,'measure-results.json'),JSON.stringify(out,null,1));
 for(const o of out)console.log(o.file,'overflowX='+o.overflowX,'texts='+o.texts,'small='+JSON.stringify(o.small),'tap='+JSON.stringify(o.tap)+'/'+o.tapCount,'contrast='+JSON.stringify(o.contrast),'nonText='+JSON.stringify(o.nonText));
})();
