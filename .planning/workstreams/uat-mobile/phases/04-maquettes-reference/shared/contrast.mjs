// Verifie les ratios WCAG des paires texte/fond utilisees par les contrats. node shared/contrast.mjs
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05))};
const pairs=[['texte','#1C1A17','#F7F6F3',4.5],['texte/surface','#1C1A17','#FFFFFF',4.5],['muted/fond','#6B6963','#F7F6F3',4.5],['muted/surface','#6B6963','#FFFFFF',4.5],['muted/surface-2','#6B6963','#F0EFE9',4.5],
['blanc/primaire (bouton)','#FFFFFF','#FF5C1A',4.5],['texte/primaire (option B bouton)','#1C1A17','#FF5C1A',4.5],['lien orange fonce/fond','#B53D05','#F7F6F3',4.5],['orange fonce/primary-tint','#B53D05','#FFF0E8',4.5],['primaire/fond (icone)','#FF5C1A','#F7F6F3',3],
['succes/tint','#17703D','#E6F4EC',4.5],['warn/tint','#8A5700','#FDF3DC',4.5],['info/tint','#2563C9','#E8F0FD',4.5],['danger/tint','#B5301F','#FBE9E7',4.5],['or texte/tint','#7A5800','#FBF1D3',4.5],['or icone/tint','#9A6F00','#FBF1D3',3],['blanc/noir (bulle, chip on)','#FFFFFF','#1C1A17',4.5],['gris verrou icone/surface-2','#8A877F','#F0EFE9',3]];
for(const [n,f,b,min] of pairs){const r=R(f,b);console.log(`${r>=min?'OK  ':'FAIL'} ${r.toFixed(2)} (min ${min}) ${n}`);}
