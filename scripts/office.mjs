// Builds docs/office.html, the animated office view, from docs/workflow-state.md.
// No dependencies. Run: npm run office (npm run dashboard builds it too).
// Pass --artifact <file> to also write a page body for publishing as a claude.ai artifact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { officeData } from './office-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const md = fs.readFileSync(path.join(root, 'docs/workflow-state.md'), 'utf8');
const data = officeData(md);
// Keep "</script>" in task text from closing the inline script.
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const body = fs.readFileSync(path.join(here, 'office-template.html'), 'utf8').replace('/*__DATA__*/', () => json);

const page = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
</head><body>
${body}
</body></html>
`;
const out = path.join(root, 'docs/office.html');
fs.writeFileSync(out, page);
const i = process.argv.indexOf('--artifact');
if (i > 0 && process.argv[i + 1]) fs.writeFileSync(process.argv[i + 1], body);
console.log(`office: ${data.trips.length} walks between rooms, ${data.waiting.length} waiting on Luke -> ${path.relative(root, out)}`);
