#!/usr/bin/env node
// Simulate session expiry server-side: ban the athlete for a short time so the next token refresh fails,
// then lift the ban. The app must detect the expired session and redirect to login.
// Usage: node scripts/uat/sim-session-expiry.mjs [--dry-run] [--seconds=20]
import { loadEnv, resolveTarget, adminClient, identities } from './lib.mjs';

const dry = process.argv.includes('--dry-run');
const secs = Number((process.argv.find((a) => a.startsWith('--seconds=')) || '--seconds=20').split('=')[1]);
const env = loadEnv();
const t = resolveTarget(env, { requireKey: !dry });
if (dry) { console.log(`[uat] DRY-RUN: ban athlete ${secs}s (refresh fails), then unban`); process.exit(0); }
const db = await adminClient(t);
const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = data?.users.find((x) => x.email === identities(env).athlete.email);
if (!u) { console.error('[uat] athlete not found'); process.exit(1); }
await db.auth.admin.updateUserById(u.id, { ban_duration: `${secs}s` });
console.log(`[uat] athlete banned ${secs}s: trigger foreground/refresh now; unban is automatic.`);
