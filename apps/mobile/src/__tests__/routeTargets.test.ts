import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// UAT run 6 : `router.replace('/(app)/(tabs)/workout')` pointait vers un groupe `(tabs)` qui n'existe
// pas -> "Unmatched Route". Ce test statique liste les routes expo-router reelles (fichiers de
// `apps/mobile/app`) et echoue si un litteral de route passe a `router.*`, `<Redirect href>`,
// `<Link href>`, `pathname:` ou toute chaine "/(app)/..." "/(plugins)/..." "/(auth)/..." ne
// correspond a aucune route.
//
// Regles de correspondance :
// - les segments de groupe `(x)` ecrits explicitement doivent exister, dans l'ordre, dans la chaine
//   de groupes du fichier de route (omettre un groupe est tolere, ex. `/(plugins)/sleep/log`) ;
// - les segments `${...}` (template) valent un segment dynamique `[param]` ;
// - la query string (`?a=b`) est ignoree.
// Limites documentees (EXCEPTIONS) : routes construites par variable/concatenation (non
// analysables statiquement) ; ce test ne les voit pas.

const root = resolve(__dirname, '../../../..');
const appDir = resolve(root, 'apps/mobile/app');

interface RouteDef {
  groups: string[]; // groupes dans l'ordre, ex. ['(app)', '(plugins)']
  segs: string[]; // segments d'URL (sans groupes), '[x]' = dynamique, '[...x]' = catch-all
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function routeFromFile(file: string): RouteDef | null {
  let rel = file.slice(appDir.length + 1).replace(/\\/g, '/');
  if (!/\.(tsx|ts|jsx|js)$/.test(rel)) return null;
  rel = rel.replace(/\.(tsx|ts|jsx|js)$/, '');
  const parts = rel.split('/');
  const last = parts[parts.length - 1];
  if (last === '_layout' || last.startsWith('+') || rel.endsWith('.d')) return null;
  if (last === 'index') parts.pop();
  const groups = parts.filter((s) => /^\(.+\)$/.test(s));
  const segs = parts.filter((s) => !/^\(.+\)$/.test(s));
  return { groups, segs };
}

export const ROUTES: RouteDef[] = walk(appDir)
  .map(routeFromFile)
  .filter((r): r is RouteDef => r !== null);

function isSubsequence(want: string[], have: string[]): boolean {
  let i = 0;
  for (const h of have) if (i < want.length && want[i] === h) i++;
  return i === want.length;
}

export function matchesRoute(target: string): boolean {
  const path = target.split('?')[0].split('#')[0];
  const parts = path.split('/').filter((s) => s.length > 0);
  const groups = parts.filter((s) => /^\(.+\)$/.test(s));
  const segs = parts.filter((s) => !/^\(.+\)$/.test(s));
  return ROUTES.some((r) => {
    if (!isSubsequence(groups, r.groups)) return false;
    const catchAll = r.segs.findIndex((s) => s.startsWith('[...'));
    const fixed = catchAll === -1 ? r.segs : r.segs.slice(0, catchAll);
    if (catchAll === -1 && fixed.length !== segs.length) return false;
    if (catchAll !== -1 && segs.length < fixed.length) return false;
    return fixed.every((s, i) => {
      const t = segs[i];
      if (s.startsWith('[')) return true; // segment dynamique : tout segment convient
      return s === t;
    });
  });
}

// --- collecte des litteraux de route dans le code mobile + plugins ---------------------------
const SCAN_DIRS = ['apps/mobile/app', 'apps/mobile/src', 'plugins', 'packages/plugin-sdk/src', 'packages/ui/src'];
const SKIP = /node_modules|[\\/]\.expo|[\\/]dist[\\/]|[\\/]__tests__[\\/]|\.test\.|\.d\.ts$/;

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const d of SCAN_DIRS) {
    const abs = resolve(root, d);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    for (const f of walk(abs)) {
      if (/\.(tsx|ts)$/.test(f) && !SKIP.test(f)) out.push(f);
    }
  }
  return out;
}

const LIT = String.raw`(['"\`])((?:\\.|(?!\1)[^\\\n])*)\1`;
const NAV_RE = new RegExp(String.raw`(?:router|navigation)\s*\.\s*(?:push|replace|navigate)\s*\(\s*` + LIT, 'g');
const HREF_RE = new RegExp(String.raw`(?:href\s*=\s*\{?|href:\s*|pathname:\s*)` + LIT, 'g');
const GROUP_STR_RE = new RegExp(String.raw`(['"\`])(/\((?:app|plugins|auth)\)(?:/[^'"\`\n]*)?)\1`, 'g');

// Exceptions documentees : litteraux qui ne sont PAS des routes expo-router.
const EXCEPTIONS: RegExp[] = [
  /^https?:\/\//, // liens externes
  /^mailto:|^tel:/,
];

function isCandidate(s: string): boolean {
  if (EXCEPTIONS.some((e) => e.test(s))) return false;
  if (!s.startsWith('/')) return false; // chemins relatifs / variables : non analysables
  return true;
}

interface Hit {
  file: string;
  line: number;
  target: string;
}

// Fichiers dont les litteraux sont des PREFIXES (pas des routes) : verifies a part.
const PREFIX_FILES = /notificationRoutes\.ts$/;

export function prefixMatchesRoute(prefix: string): boolean {
  const parts = prefix.split('/').filter((s) => s.length > 0);
  const groups = parts.filter((s) => /^\(.+\)$/.test(s));
  const segs = parts.filter((s) => !/^\(.+\)$/.test(s));
  return ROUTES.some(
    (r) => isSubsequence(groups, r.groups) && segs.every((s, i) => r.segs[i] === s),
  );
}

// Objets `{ pathname: ... }` (router.push / <Link href={{ pathname }}>) : l'expression peut etre un ternaire
// (`pathname: ok ? '/a' : '/b'`) ; on en extrait tous les litteraux commencant par `/`.
const PATHNAME_EXPR_RE = /pathname\s*:\s*([^,}\n]+)/g;
const SLASH_LIT_RE = /(['"`])(\/(?:\\.|(?!\1)[^\\\n])*)\1/g;

/** Litteraux de route d'un source (forme chaine ET forme objet `{pathname}`), avec leur position. */
export function scanRouteLiterals(src: string): Array<{ index: number; target: string }> {
  const out: Array<{ index: number; target: string }> = [];
  const seen = new Set<string>();
  const push = (index: number, target: string) => {
    const key = `${index}:${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ index, target });
  };
  for (const re of [NAV_RE, HREF_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) if (isCandidate(m[2])) push(m.index, m[2]);
  }
  PATHNAME_EXPR_RE.lastIndex = 0;
  let p: RegExpExecArray | null;
  while ((p = PATHNAME_EXPR_RE.exec(src))) {
    SLASH_LIT_RE.lastIndex = 0;
    let l: RegExpExecArray | null;
    while ((l = SLASH_LIT_RE.exec(p[1]))) if (isCandidate(l[2])) push(p.index, l[2]);
  }
  return out;
}

function collect(): Hit[] {
  const hits: Hit[] = [];
  for (const f of sourceFiles()) {
    if (PREFIX_FILES.test(f)) continue;
    const src = readFileSync(f, 'utf8');
    const seen = new Set<string>();
    for (const h of scanRouteLiterals(src)) {
      const key = `${h.index}:${h.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ file: f, line: src.slice(0, h.index).split('\n').length, target: h.target });
    }
    GROUP_STR_RE.lastIndex = 0;
    let g: RegExpExecArray | null;
    while ((g = GROUP_STR_RE.exec(src))) {
      hits.push({ file: f, line: src.slice(0, g.index).split('\n').length, target: g[2] });
    }
  }
  return hits;
}

describe('routes expo-router reelles', () => {
  it('detecte les routes attendues (garde-fou du test lui-meme)', () => {
    expect(ROUTES.length).toBeGreaterThan(80);
    expect(matchesRoute('/(app)/workout/session')).toBe(true);
    expect(matchesRoute('/(app)/workout/')).toBe(true);
    expect(matchesRoute('/(app)')).toBe(true);
    expect(matchesRoute('/(plugins)/sleep/log')).toBe(true);
    expect(matchesRoute('/(app)/profile/${u.id}')).toBe(true);
    expect(matchesRoute('/(app)/(plugins)/community/conversation?id=${x}')).toBe(true);
  });

  it('rejette les routes inexistantes (regression du bug (tabs))', () => {
    expect(matchesRoute('/(app)/(tabs)/workout')).toBe(false);
    expect(matchesRoute('/(app)/(workout)/session')).toBe(false);
    expect(matchesRoute('/(app)/store/a/b')).toBe(false);
  });

  it('le scanner couvre aussi les formes objet { pathname } de Link href et router.push (run7)', () => {
    const t = (s: string) => scanRouteLiterals(s).map((h) => h.target);
    expect(t(`router.push({ pathname: '/(app)/(tabs)/x', params: { a: 1 } })`)).toContain('/(app)/(tabs)/x');
    expect(t(`<Link href={{ pathname: "/(app)/nope/zz" }}>x</Link>`)).toContain('/(app)/nope/zz');
    expect(t(`router.replace({\n  pathname: '/(app)/workout/summary',\n})`)).toContain('/(app)/workout/summary');
    expect(t(`router.push({ pathname: ok ? '/(app)/a/one' : '/(app)/b/two' })`)).toEqual(['/(app)/a/one', '/(app)/b/two']);
    expect(t('<Link href={`/(app)/profile/${id}`} />')).toContain('/(app)/profile/${id}');
    // une route objet inexistante est bien detectee comme invalide
    expect(t(`router.push({ pathname: '/(app)/(tabs)/workout' })`).some((x) => !matchesRoute(x))).toBe(true);
  });

  it('tout litteral de navigation correspond a une route existante', () => {
    const bad = collect()
      .filter((h) => !matchesRoute(h.target))
      .map((h) => `${h.file.slice(root.length + 1).replace(/\\/g, '/')}:${h.line} -> ${h.target}`);
    expect(bad).toEqual([]);
  });

  it('les prefixes de notificationRoutes.ts correspondent a de vraies routes', () => {
    const src = readFileSync(resolve(root, 'apps/mobile/src/lib/notificationRoutes.ts'), 'utf8');
    const block = src.match(/ALLOWED_ROUTE_PREFIXES\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    const prefixes = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(prefixes.length).toBeGreaterThan(3);
    expect(prefixes.filter((p) => !prefixMatchesRoute(p))).toEqual([]);
  });

  it('summary.tsx ne navigue pas pendant le rendu', () => {
    const src = readFileSync(resolve(appDir, '(app)/workout/summary.tsx'), 'utf8');
    // Le early-return `if (!session)` ne doit plus appeler router.replace directement.
    expect(src).not.toMatch(/if \(!session\)[^\n]*\n?[^\n]*router\./);
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(!hasSession\) router\.replace\(/);
    expect(src).not.toMatch(/\(tabs\)/);
  });
});
