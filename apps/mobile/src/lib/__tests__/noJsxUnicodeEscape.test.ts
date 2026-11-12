// SOC-08 / AM-7 : en JSX, une sequence \uXXXX ecrite dans du TEXTE ou dans un attribut entre guillemets
// n'est pas interpretee et s'affiche brute ("Envoyé"). Les chaines JS ({'...'}, `...`, "..." hors
// JSX) restent correctes. Ce test echoue si une telle sequence reapparait dans le JSX de
// plugins/community/** et apps/mobile/src/components/**.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../../..');
const ESC = String.raw`\\u[0-9a-fA-F]{4}`;

/** Retire les commentaires (bloc, ligne, JSX) pour ne pas signaler du texte de documentation. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

/** Occurrences d'echappements unicode litteraux dans du texte JSX ou des attributs JSX entre guillemets. */
export function findJsxUnicodeEscapes(source: string): string[] {
  const src = stripComments(source);
  const hits: string[] = [];
  // texte entre deux balises, sans accolade (donc pas une expression JS)
  const textRe = new RegExp(`>([^<>'"\`(=;\\n]*${ESC}[^<>\\n]*)<`, 'g');
  // attribut JSX a guillemets doubles : title="Envoy\\u00e9"
  const attrRe = new RegExp(`\\b[A-Za-z][\\w-]*="[^"\\n]*${ESC}[^"\\n]*"`, 'g');
  // texte JSX qui commence/finit une ligne (retour a la ligne dans l'element)
  const lineRe = new RegExp(`^\\s*[^<>{}()=;'"\`\\n]*${ESC}[^<>{}()=;'"\`\\n]*$`, 'gm');
  for (const m of src.matchAll(textRe)) hits.push(m[1].trim());
  for (const m of src.matchAll(attrRe)) hits.push(m[0]);
  for (const m of src.matchAll(lineRe)) hits.push(m[0].trim());
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('findJsxUnicodeEscapes (detecteur)', () => {
  it('detecte le cas historique FriendsScreen / SearchOverlay', () => {
    expect(findJsxUnicodeEscapes('<Text>Envoy\\u00e9</Text>')).toHaveLength(1);
    expect(findJsxUnicodeEscapes('<Text style={s}>Demande envoy\\u00e9e</Text>')).toHaveLength(1);
    expect(findJsxUnicodeEscapes('<Text>Aucun r\\u00e9sultat pour "{query}"</Text>')).toHaveLength(1);
    expect(findJsxUnicodeEscapes('<Text>\n  Demande envoy\\u00e9e\n</Text>').length).toBeGreaterThan(0);
    expect(findJsxUnicodeEscapes('<Foo title="Envoy\\u00e9" />')).toHaveLength(1);
  });
  it('ignore les chaines JS (interpretees) et les commentaires', () => {
    expect(findJsxUnicodeEscapes("showAlert('Envoy\\u00e9 !', 'ok');")).toHaveLength(0);
    expect(findJsxUnicodeEscapes("const t = 'Pi\\u00e8ces';")).toHaveLength(0);
    expect(findJsxUnicodeEscapes('<Text>{\'Envoy\\u00e9\'}</Text>')).toHaveLength(0);
    expect(findJsxUnicodeEscapes('// Envoy\\u00e9 : doc\n<Text>ok</Text>')).toHaveLength(0);
  });
});

describe('aucun \\uXXXX litteral dans le JSX (SOC-08, AM-7)', () => {
  const dirs = [join(ROOT, 'plugins/community'), join(ROOT, 'apps/mobile/src/components')];
  const files = dirs.flatMap((d) => walk(d));

  it('le scan couvre bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => f.endsWith('FriendsScreen.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('SearchOverlay.tsx'))).toBe(true);
  });

  it.each(files.map((f) => [f.replace(ROOT, '').replace(/\\/g, '/'), f]))('%s', (_label, file) => {
    expect(findJsxUnicodeEscapes(readFileSync(file as string, 'utf8'))).toEqual([]);
  });
});
