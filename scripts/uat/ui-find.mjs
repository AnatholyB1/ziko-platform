#!/usr/bin/env node
// v1.21 : dump uiautomator de l'emulateur et affiche les bounds [x1,y1][x2,y2] des noeuds dont text/content-desc matche chaque motif.
// Usage: node scripts/uat/ui-find.mjs "Crée ton premier" "Mission du jour" "Quêtes du jour" ...   (sortie JSON-ish, ordre des arguments)
import { execFileSync } from 'node:child_process';
const adb = process.env.ADB || 'adb';
const sh = (a) => execFileSync(adb, ['-s', 'emulator-5554', ...a], { encoding: 'utf8', maxBuffer: 64e6 });
sh(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml']);
const xml = sh(['exec-out', 'cat', '/sdcard/ui.xml']);
const nodes = [...xml.matchAll(/<node [^>]*>/g)].map((m) => m[0]);
const get = (n, k) => (n.match(new RegExp(`${k}="([^"]*)"`)) || [])[1] ?? '';
for (const pat of process.argv.slice(2)) {
  const re = new RegExp(pat, 'i');
  const hits = nodes.filter((n) => re.test(get(n, 'text')) || re.test(get(n, 'content-desc')));
  if (!hits.length) console.log(`${pat} => ABSENT`);
  for (const n of hits.slice(0, 3)) console.log(`${pat} => ${get(n, 'bounds')} text="${get(n, 'text').slice(0, 50)}" desc="${get(n, 'content-desc').slice(0, 60)}" clickable=${get(n, 'clickable')}`);
}
