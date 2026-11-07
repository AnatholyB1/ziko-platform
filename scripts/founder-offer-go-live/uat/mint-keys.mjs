// Mints anon / service_role HS256 JWTs signed with the DISPOSABLE secret. Prints KEY=VALUE lines.
import { createHmac } from 'node:crypto';

const secret = process.env.UAT_JWT_SECRET;
if (!secret) throw new Error('UAT_JWT_SECRET missing (source 00-env.sh)');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const mint = (role) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ role, iss: 'ziko-uat', iat: 1700000000, exp: 4102444800 });
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};
console.log(`UAT_ANON_KEY=${mint('anon')}`);
console.log(`UAT_SERVICE_KEY=${mint('service_role')}`);
