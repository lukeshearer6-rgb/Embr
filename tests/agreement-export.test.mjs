// Checks docs/dev/booking-agreement.md still matches the _agreement SQL function.
// Plain node, no database. Run: npm run test:agreement
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase/migrations');
const docPath = join(root, 'docs/dev/booking-agreement.md');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '\n       ' + detail : '')); }
};

// The latest migration (by file name) that defines _agreement.
const defining = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  .filter((f) => /create or replace function public\._agreement\s*\(/.test(readFileSync(join(migDir, f), 'utf8')));
check('a migration defines _agreement', defining.length > 0);
const migFile = defining.at(-1);
const sql = readFileSync(join(migDir, migFile), 'utf8');
const fnStart = sql.search(/create or replace function public\._agreement\s*\(/);
const m = sql.slice(fnStart).match(/return format\(\s*\n'((?:[^']|'')*)',/);
check('format string found in ' + migFile, !!m);
const template = m[1].replace(/''/g, "'");

const doc = readFileSync(docPath, 'utf8');
check('doc names the source migration', doc.includes(migFile));
const lineOf = (i) => sql.slice(0, i).split('\n').length;
const fnLine = lineOf(fnStart);
const textLine = lineOf(fnStart + sql.slice(fnStart).indexOf(m[0])) + 1;
check(`doc gives the function line (${fnLine})`, doc.includes(`line ${fnLine}`));
check(`doc gives the text start line (${textLine})`, doc.includes(`lines ${textLine} to`));

const block = doc.match(/<!-- agreement:start -->\s*```text\n([\s\S]*?)\n```\s*<!-- agreement:end -->/);
check('doc has the agreement block', !!block);
const docText = block ? block[1] : '';

// Every literal fragment of the function's text appears in the doc's block.
const fragments = template.split('%s').flatMap((f) => f.split('\n')).map((f) => f.trim()).filter(Boolean);
const missing = fragments.filter((f) => !docText.includes(f));
check(`all ${fragments.length} literal fragments appear in the doc`, missing.length === 0, missing.slice(0, 5).join(' | '));

// Exact match: the block with each {placeholder} turned back into %s is the function's text.
const placeholders = docText.match(/\{[a-z_]+\}/g) || [];
const slots = (template.match(/%s/g) || []).length;
check(`placeholder count matches (${placeholders.length} of ${slots})`, placeholders.length === slots);
const back = docText.replace(/\{[a-z_]+\}/g, '%s');
check('doc block matches the function text exactly', back === template,
  back === template ? '' : 'first difference at character ' + [...back].findIndex((c, i) => c !== template[i]));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
