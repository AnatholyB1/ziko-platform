// Regenere legacy-functions.sql depuis un export JSON de pg_get_functiondef (branche de test, lecture seule).
// Usage : node scripts/uat/sec-sql/gen-legacy.mjs <defs.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const skip = /get_public_profile|with_status/;
let out = '-- Corps HISTORIQUES (avant 202612012701) des fonctions durcies, copies de la branche de test (pg_get_functiondef).\n'
  + '-- Prouve que les attaques de l\'audit REUSSISSENT avant la migration. Jamais applique hors du PG local jetable.\n\n';
for (const r of j.rows) {
  if (skip.test(r.proname)) continue;
  out += r.def.replace(/\r/g, '') + ';\n\n';
}
writeFileSync(resolve(here, 'legacy-functions.sql'), out);
console.log('legacy-functions.sql :', out.length, 'octets');
