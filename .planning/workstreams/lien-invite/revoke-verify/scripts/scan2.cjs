// AST scan: every .insert/.update/.upsert/.delete whose receiver chain contains .from(<arg>)
const ts = require('C:/ziko-platform/node_modules/typescript');
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const dirs = ['apps', 'plugins', 'packages', 'backend/api/src'];
const skipNames = new Set(['node_modules', '.next', 'dist', 'build', '.expo', 'coverage', '.turbo']);
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skipNames.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) files.push(p);
  }
}
for (const d of dirs) { const f = path.join(root, d); if (fs.existsSync(f)) walk(f); }
const WR = new Set(['insert', 'update', 'upsert', 'delete']);
const out = [], unresolved = [];
function lit(n, consts) {
  if (!n) return null;
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isIdentifier(n) && consts[n.text]) return consts[n.text];
  return null;
}
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/\.from\(/.test(src)) continue;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, /x$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const consts = {};
  (function c(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name) && ts.isStringLiteralLike(n.initializer)) consts[n.name.text] = n.initializer.text;
    ts.forEachChild(n, c);
  })(sf);
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && WR.has(n.expression.name.text)) {
      let r = n.expression.expression, fromArg = null, rootNode = null;
      while (r) {
        if (ts.isCallExpression(r) && ts.isPropertyAccessExpression(r.expression)) {
          if (r.expression.name.text === 'from') { fromArg = r.arguments[0]; rootNode = r.expression.expression; break; }
          r = r.expression.expression; continue;
        }
        if (ts.isPropertyAccessExpression(r) || ts.isAwaitExpression(r) || ts.isParenthesizedExpression(r) || ts.isNonNullExpression(r)) { r = r.expression; continue; }
        break;
      }
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      const rel = path.relative(root, f).split(path.sep).join('/');
      if (fromArg) {
        const t = lit(fromArg, consts);
        out.push({ file: rel, line, cmd: n.expression.name.text, table: t ?? 'DYN:' + fromArg.getText(), client: rootNode ? rootNode.getText().slice(0, 60) : '?' });
      } else if (r && ts.isIdentifier(r)) unresolved.push({ file: rel, line, cmd: n.expression.name.text, recv: r.text });
    }
    ts.forEachChild(n, v);
  })(sf);
}
fs.writeFileSync(process.argv[3], JSON.stringify({ out, unresolved }, null, 1));
console.log('files', files.length, 'writes', out.length, 'unresolved', unresolved.length);
