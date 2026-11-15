// Non-regression UAT run2 P19: a plugin declaring `expo-notifications: "*"` let npm hoist v56 at the
// root while the dev-client binary ships 0.32 -> "Cannot find native module ExpoTopicSubscriptionModule".
// Every native Expo / react-native-* dependency declared by a plugin or package must use exactly the
// range declared by apps/mobile.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../..');
const isNative = (n: string) => /^(expo(-|$)|react-native(-|$))/.test(n);
// Known pre-existing divergence (app pins ^55 on an SDK 54 project): tracked in FIX-UAT-RUN2.md.
const ALLOWED_DIVERGENCE = new Set(['plugins/nutrition:expo-image-manipulator']);

function readPkg(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel, 'package.json'), 'utf8'));
}

const app = readPkg('apps/mobile');
const appDeps: Record<string, string> = { ...app.dependencies, ...app.devDependencies };

const dirs: string[] = [];
for (const group of ['plugins', 'packages']) {
  for (const d of fs.readdirSync(path.join(ROOT, group))) {
    if (fs.existsSync(path.join(ROOT, group, d, 'package.json'))) dirs.push(`${group}/${d}`);
  }
}

describe('native dependency alignment with apps/mobile', () => {
  it('finds plugin package manifests', () => {
    expect(dirs.length).toBeGreaterThan(15);
  });

  for (const dir of dirs) {
    it(`${dir}: native deps are not "*" and match apps/mobile`, () => {
      const pkg = readPkg(dir);
      const problems: string[] = [];
      for (const sec of ['dependencies', 'peerDependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries<string>(pkg[sec] ?? {})) {
          if (!isNative(name)) continue;
          if (ALLOWED_DIVERGENCE.has(`${dir}:${name}`)) continue;
          if (range === '*' || range === 'latest') problems.push(`${sec}.${name} = "${range}"`);
          else if (appDeps[name] && appDeps[name] !== range && !(dir.startsWith('packages/') && sec === 'peerDependencies')) {
            problems.push(`${sec}.${name} = "${range}" (apps/mobile: "${appDeps[name]}")`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }

  it('plugins importing expo-notifications declare it with the app range', () => {
    for (const dir of ['plugins/habits', 'plugins/hydration', 'plugins/sleep', 'plugins/supplements']) {
      const pkg = readPkg(dir);
      const range = pkg.dependencies?.['expo-notifications'] ?? pkg.peerDependencies?.['expo-notifications'];
      expect(range, dir).toBe(appDeps['expo-notifications']);
    }
  });
});
