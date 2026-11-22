// Outil de maquette (pas du code d'app). Genere frames/src/*.html. Usage: node shared/gen.mjs
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','frames','src');
const I=(n,f,st)=>`<i class="ic" data-n="${n}"${f?' data-f':''}${st?` style="${st}"`:''}></i>`;
const frame=(id,t,inner,cls='')=>`<div class="fr" data-id="${id}"><h2>${id} ${t}</h2><div class="phone ${cls}"><!--SB-->${inner}</div></div>\n`;

// ---------- carte "Crée ton premier entraînement" ----------
const bal=(n,z)=>`<span class="cr${z?' z':''}" aria-label="Solde : ${n}">${I('flash',1)}${n}</span>`;
const head=(chip)=>`<div class="ftc-h"><div class="ftc-top"><span class="ov">Premier entraînement</span>${chip}</div><div class="ftc-t">Crée ton premier entraînement</div><div class="ftc-s">Trois façons de commencer.</div></div>`;
const row=({ico,icoCls='pr',name,tag,desc,meta,state=''})=>`<div class="pth ${state}" data-tap><div class="ico ${icoCls}">${I(ico)}</div><div class="tx"><div class="nm">${name} <span class="bdg gy">${tag}</span></div><div class="ds">${desc}</div>${meta}</div>${I('chevron-forward',0,'')}</div>`.replace('<i class="ic" data-n="chevron-forward"></i>','<i class="ic ch" data-n="chevron-forward"></i>');
const mFree=`<div class="mt free">${I('checkmark-circle',1)}Gratuit</div>`;
const mCost=(t)=>`<div class="mt cost">${I('flash',1)}${t}</div>`;
const mOut=`<div class="mt warnt">${I('lock-closed',1)}Crédits épuisés</div>`;
const MAN=(s='',m=mFree,ic='pr')=>row({ico:'list',icoCls:ic,name:'Manuel',tag:'Programme',desc:'Tu construis ton programme en 4 étapes.',meta:m,state:s});
const SIM=(s='',m=mCost('4 crédits'),ic='pr',st='')=>row({ico:'sparkles',icoCls:ic,name:'IA simple',tag:'Séance',desc:'L’IA prépare une séance unique en quelques secondes.',meta:m,state:s});
const ATE=(s='',m=mCost('4 crédits par message'),ic='pr')=>row({ico:'chatbubbles',icoCls:ic,name:'Atelier IA',tag:'Programme',desc:'Tu discutes, l’IA construit un programme complet.',meta:m,state:s});
const card=(h,rows,extra='')=>`<div class="card ftc" role="group" aria-label="Crée ton premier entraînement">${h}${extra}${rows}</div>`;
const home=(cardHtml,cls='',note='')=>`<div class="scr pb vgap"><!--INC:greet-->${cardHtml}<!--INC:ph--></div><div class="fade"></div><!--TB:0-->`;

let h='<!-- title: P2 Accueil, carte premier entrainement -->\n';
h+=frame('h01-defaut','Accueil, compte neuf, crédits disponibles (avec contenu)',home(card(head(bal('6 crédits')),MAN()+SIM()+ATE())));
h+=frame('h02-credits-epuises','Crédits épuisés : les chemins IA le disent avant l’ouverture, Manuel reste offert',home(card(head(bal('0 crédit',1)),MAN('hl')+SIM('off',mOut,'')+ATE('off',mOut,''),`<div class="banner wn" style="margin:0 16px 14px">${I('alert-circle',1)}<div>Tes crédits IA sont épuisés. Le parcours manuel reste gratuit.</div></div>`)));
h+=frame('h03-chargement','Chargement (sans contenu) : squelette après 400 ms seulement',home(`<div class="card ftc" aria-busy="true" aria-label="Chargement de ton premier entraînement"><div class="ftc-h"><div class="sk" style="height:12px;width:120px;margin-bottom:12px"></div><div class="sk" style="height:24px;width:250px"></div><div class="sk" style="height:14px;width:300px;margin-top:10px"></div></div>${[0,1,2].map(()=>`<div class="pth" style="min-height:100px"><div class="sk" style="width:44px;height:44px;border-radius:12px;flex:none"></div><div class="tx"><div class="sk" style="height:16px;width:140px"></div><div class="sk" style="height:14px;width:90%;margin-top:10px"></div><div class="sk" style="height:14px;width:60px;margin-top:10px"></div></div></div>`).join('')}</div>`));
h+=frame('h04-disparue','Carte disparue (sans contenu) : programme actif ou séance terminée, l’accueil ne montre que Mission + Quêtes',`<div class="scr pb vgap"><!--INC:greet--><!--INC:ph--></div><div class="fade"></div><!--TB:0-->`);
h+=frame('h05-appui-focus','Rangée pressée (fond #F0EFE9) et anneau de focus clavier/lecteur d’écran',home(card(head(bal('6 crédits')),MAN()+SIM('press')+`<div class="pth" data-tap style="outline:3px solid #FF5C1A55;outline-offset:-3px;border-radius:0 0 16px 16px"><div class="ico pr">${I('chatbubbles')}</div><div class="tx"><div class="nm">Atelier IA <span class="bdg gy">Programme</span></div><div class="ds">Tu discutes, l’IA construit un programme complet.</div>${mCost('4 crédits par message')}</div><i class="ic ch" data-n="chevron-forward"></i></div>`)));
h+=frame('h06-texte-130','Taille de texte système 130 % : rien n’est coupé, les lignes se replient',home(card(head(bal('6 crédits')),MAN()+SIM()+ATE())),'fs130');
h+=frame('h07-solde-inconnu','Solde ou coût non disponible (hors ligne / lecture échouée) : libellé générique, jamais un chiffre inventé',home(card(head(`<span class="cr" aria-label="Solde indisponible">${I('flash',1)}—</span>`),MAN()+SIM('',mCost('Consomme des crédits IA'))+ATE('',mCost('Consomme des crédits IA')))));
h+=frame('h08-quota-gratuit','Quota gratuit restant (nouveau compte) : le coût devient « gratuit », lu sur le serveur',home(card(head(bal('1 crédit')),MAN()+SIM('',`<div class="mt free">${I('checkmark-circle',1)}1 gratuite ce mois-ci</div>`)+ATE('',`<div class="mt free">${I('checkmark-circle',1)}1 message gratuit aujourd’hui</div>`))));
fs.writeFileSync(path.join(src,'01-home.html'),h);

// ---------- onglet Entrainement ----------
const tvh=`<div class="tvh"><div class="ttl">Entraînement</div><div class="ib bd" data-tap aria-label="Calendrier">${I('calendar')}</div><div class="ib bd" data-tap aria-label="Créer">${I('add')}</div></div>`;
const empty=(ex)=>`<div class="scr pb">${tvh}<div class="card tve"><div class="ico">${I('barbell')}</div><h3>Aucun programme actif</h3><p>Un programme organise tes séances sur plusieurs semaines. Tu préfères une seule séance ? Lance-la avec l’IA.</p><div class="btns"><div class="btn p full" data-tap>${I('add')}Créer un programme</div>${ex.btn}${ex.hint}</div><div class="btn t" data-tap style="margin-top:4px">Mes programmes</div></div></div><div class="fade"></div><!--TB:1-->`;
const btnOk=`<div class="btn full" data-tap>${I('sparkles')}Générer une séance IA <span class="cr" style="height:24px;margin-left:2px">4 crédits</span></div>`;
const btnOut=`<div class="btn full" data-tap>${I('lock-closed')}Séance IA, crédits épuisés</div>`;
const sheetRows=(out)=>row({ico:'list',name:'Assistant en 4 étapes',tag:'Programme',desc:'Objectif, durée, jours, exercices. Environ 2 minutes.',meta:mFree})+
  (out?row({ico:'chatbubbles',icoCls:'',name:'Atelier IA',tag:'Programme',desc:'Discute avec l’IA pour un programme très précis.',meta:mOut,state:'off'}):row({ico:'chatbubbles',name:'Atelier IA',tag:'Programme',desc:'Discute avec l’IA pour un programme très précis.',meta:mCost('4 crédits par message')}));
const sheet=(out)=>`<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Créer un programme"><div class="sh-t">Créer un programme</div><div class="sh-s">Plusieurs séances organisées sur des semaines.</div>${sheetRows(out)}<div class="btn t full" data-tap style="margin-top:8px">Annuler</div></div>`;
let t='<!-- title: P2 Entrainement, etat vide -->\n';
t+=frame('t01-vide','Onglet Entraînement vide : deux boutons qui disent ce qu’ils créent (avec contenu : textes, coût)',empty({btn:btnOk,hint:`<div class="hint">Un programme est choisi en 2 étapes ; une séance se lance tout de suite.</div>`}));
t+=frame('t02-choix-programme','« Créer un programme » ouvre le choix des deux façons de construire un programme',empty({btn:btnOk,hint:''})+sheet(false));
t+=frame('t03-vide-credits-epuises','Même écran, crédits épuisés : le bouton IA le dit, Manuel reste le bouton principal',empty({btn:btnOut,hint:`<div class="hint w">Reviens demain ou gagne des crédits en restant actif.</div>`}));
t+=frame('t04-choix-credits-epuises','Choix du programme, Atelier IA épuisé : l’Assistant en 4 étapes reste ouvert',empty({btn:btnOut,hint:''})+sheet(true));
fs.writeFileSync(path.join(src,'02-training.html'),t);

// ---------- fin d'onboarding ----------
const lp=(s,x)=>`<div class="lp ${s}"><span class="d">${s==='done'?I('checkmark',1):''}</span>${x}</div>`;
const ob=(body,cta,extra='')=>`<div class="scr" style="padding:0 20px"><div style="padding-top:40px">${body}</div></div><div class="obf"><div class="btn p full" data-tap>${cta}${I('arrow-forward')}</div></div>`;
let o='<!-- title: P2 Fin d onboarding -->\n';
o+=frame('o01-chargement','Écran de chargement corrigé : 4 étapes qui existent vraiment (plus de « Construction de ton programme »)',`<div class="scr" style="padding:0 20px"><div style="padding-top:40px"><div class="obt" style="width:64px;height:64px;border-radius:18px;font-size:28px">${I('sparkles',1)}</div><div class="h1" style="font-size:26px;line-height:1.15">On prépare ton<br>profil, <span class="pr">muscle</span>…</div><div class="stack" style="gap:6px;margin-top:24px">${lp('done','Enregistrement de ton objectif')}${lp('done','Réglage de ton niveau et de ton rythme')}${lp('cur','Choix de ton matériel')}${lp('nx','Préparation de Ziko')}</div></div></div>`);
const sum=`<div class="card np obc"><div class="ov" style="padding:14px 16px 4px">Ce qu’on a retenu</div><div class="kv"><span>Objectif</span><b>Prendre du muscle</b></div><div class="kv"><span>Rythme</span><b>4 séances par semaine</b></div><div class="kv"><span>Niveau</span><b>Intermédiaire</b></div><div class="kv"><span>Matériel</span><b>Salle complète</b></div></div>`;
o+=frame('o02-variante-a','Variante A, « Ce qu’on a retenu » : récapitule les réponses, annonce Ziko',ob(`<div class="obt">${I('checkmark')}</div><div class="obh">Ton profil<br>est prêt<i>.</i></div><div class="obs">Ziko va te poser quelques questions pour choisir ta première mission. Ton premier entraînement, tu le crées ensuite depuis l’accueil.</div>${sum}`,'Discuter avec Ziko'));
const suite=`<div class="card np obc"><div class="ov" style="padding:14px 16px 0">La suite</div><div class="stp2"><span class="n">1</span><div>Une courte discussion avec Ziko<small>Il règle ta première mission</small></div></div><div class="stp2"><span class="n">2</span><div>Ta première mission, sur l’accueil<small>Une action simple pour démarrer</small></div></div><div class="stp2"><span class="n">3</span><div>Ton premier entraînement<small>Manuel, séance IA ou atelier IA, à toi de choisir</small></div></div></div>`;
o+=frame('o03-variante-b','Variante B, « La suite » (recommandée) : 3 étapes, la dernière prépare la carte de l’accueil',ob(`<div class="obt">${I('checkmark')}</div><div class="obh">C’est noté<i>.</i></div><div class="obs">Objectif : prendre du muscle, 4 séances par semaine. Voici ce qui vient.</div>${suite}`,'Continuer'));
o+=frame('o04-variante-c','Variante C, minimale : une phrase, pas de carte',ob(`<div class="obt">${I('checkmark')}</div><div class="obh">Bienvenue<br>sur Ziko<i>.</i></div><div class="obs">Ton profil est enregistré. Ziko te pose quelques questions, puis tu choisis comment créer ton premier entraînement.</div>`,'Parler à Ziko'));
fs.writeFileSync(path.join(src,'03-onboarding.html'),o);
console.log('ok');
