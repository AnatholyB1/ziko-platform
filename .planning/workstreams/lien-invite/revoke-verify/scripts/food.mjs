import fs from 'node:fs';
const TEMP=process.env.TEMP, ROOT=`${TEMP}/ziko-uat-rv`, GW='http://127.0.0.1:3220';
const keys=Object.fromEntries(fs.readFileSync(`${ROOT}/keys.env`,'utf8').trim().split(/\r?\n/).map(l=>l.split('=')));
const su=await (await fetch(`${GW}/auth/v1/signup`,{method:'POST',headers:{apikey:keys.UAT_ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:`food-${Date.now()}@example.com`,password:'Passw0rd!uat1'})})).json();
const post=async(body,prefer,q='')=>{const r=await fetch(`${GW}/rest/v1/ziko_food_products${q}`,{method:'POST',headers:{apikey:keys.UAT_ANON_KEY,Authorization:`Bearer ${su.access_token}`,'content-type':'application/json',Prefer:prefer},body:JSON.stringify(body)});return r.status+' '+(await r.text()).slice(0,120);};
const bc=()=>'rv'+Math.random().toString(36).slice(2,10);
const p=(b)=>({barcode:b,name:'x',energy_kcal:1,proteins_g:1,carbs_g:1,fat_g:1});
// exactly what offApi.ts does: upsert onConflict barcode, return=representation (select())
console.log('upsert NEW barcode (offApi path):', await post(p(bc()),'resolution=merge-duplicates,return=representation','?on_conflict=barcode'));
console.log('plain INSERT new barcode      :', await post(p(bc()),'return=minimal'));
