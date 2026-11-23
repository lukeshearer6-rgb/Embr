// Builds docs/dashboard.html from docs/workflow-state.md (the single source of truth).
// No dependencies. Run: npm run dashboard
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'docs/workflow-state.md');
const out = path.join(root, 'docs/dashboard.html');
const md = fs.readFileSync(src, 'utf8');

// Split into sections by ## / ### headings, and parse any markdown table inside each.
const sections = {};
let h2 = '', h3 = '';
for (const line of md.split('\n')) {
  const m2 = line.match(/^## (.+)/), m3 = line.match(/^### (.+)/);
  if (m2) { h2 = m2[1].trim(); h3 = ''; continue; }
  if (m3) { h3 = m3[1].trim(); continue; }
  const key = h3 ? `${h2}/${h3}` : h2;
  (sections[key] ??= []).push(line);
}
function table(key) {
  const rows = (sections[key] || []).filter((l) => l.trim().startsWith('|'));
  if (rows.length < 2) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]).map((h) => h.toLowerCase());
  return rows.slice(2).map((r) => Object.fromEntries(cells(r).map((c, i) => [head[i], c])));
}
const text = (key) => (sections[key] || []).join('\n').trim();

const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inline = (s = '') => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const STATUSES = ['todo', 'doing', 'blocked', 'needs-approval', 'done'];
const LABEL = { todo: 'To do', doing: 'Doing', blocked: 'Blocked', 'needs-approval': 'Needs approval', done: 'Done' };
const pill = (s) => {
  const k = (s || '').toLowerCase();
  return `<span class="pill ${STATUSES.includes(k) ? k : 'todo'}">${esc(LABEL[k] || s)}</span>`;
};

const updated = (md.match(/Last updated:\s*(.+)/) || [])[1] || '';
const focus = text('Current focus');
const agents = table('Agents now');
const waiting = table('Waiting on Luke');
const stages = ['Research', 'Development', 'App build', 'Marketing'].map((name) => ({ name, rows: table(`Backlog/${name}`) }));
const all = stages.flatMap((s) => s.rows);
const count = (st) => all.filter((r) => (r.status || '').toLowerCase() === st).length;
const log = (sections['Session log'] || []).filter((l) => l.startsWith('- ')).slice(0, 8).map((l) => l.slice(2));

const ROLE = {
  researcher: 'Market, competitor and user research',
  developer: 'Features, fixes and tests',
  'app-builder': 'Builds, runbooks and release readiness',
  marketer: 'Positioning, copy and launch drafts',
};

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Embr Workspace</title>
<style>
:root{--paper:#fff;--bg:#f5f5f6;--ink:#000;--graphite:#5e6168;--line:#dcdde0;--embr:#ff3b00;--embr-text:#c42d00;--tint:#fff1ec;
--ok:#0f7b3f;--ok-bg:#e8f5ed;--warn:#a15c00;--warn-bg:#fdf3e2;--bad:#c0281b;--bad-bg:#fbeceb;--todo-bg:#ecedee}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#141416;--bg:#0b0b0c;--ink:#f4f4f5;--graphite:#a2a5ab;--line:#2c2d31;--embr-text:#ff7a4d;--tint:#2a1610;
--ok:#5cd08d;--ok-bg:#12271b;--warn:#f0b35a;--warn-bg:#2b2010;--bad:#ff8a7f;--bad-bg:#2d1513;--todo-bg:#232428}}
:root[data-theme=dark]{--paper:#141416;--bg:#0b0b0c;--ink:#f4f4f5;--graphite:#a2a5ab;--line:#2c2d31;--embr-text:#ff7a4d;--tint:#2a1610;
--ok:#5cd08d;--ok-bg:#12271b;--warn:#f0b35a;--warn-bg:#2b2010;--bad:#ff8a7f;--bad-bg:#2d1513;--todo-bg:#232428}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px 16px 48px}
main{max-width:1180px;margin:0 auto;display:grid;gap:20px}
header{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:end;justify-content:space-between}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em}h1 span{color:var(--embr)}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--graphite);margin-bottom:10px;font-weight:600}
.muted{color:var(--graphite);font-size:13px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:16px}
.focus{border-left:4px solid var(--embr)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.stat b{display:block;font-size:28px;font-weight:800}
.agent h3{font-size:16px;margin-bottom:2px}.agent p{margin:8px 0}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;white-space:nowrap}
.pill.todo{background:var(--todo-bg);color:var(--graphite)}.pill.doing{background:var(--tint);color:var(--embr-text)}
.pill.blocked{background:var(--bad-bg);color:var(--bad)}.pill.needs-approval{background:var(--warn-bg);color:var(--warn)}.pill.done{background:var(--ok-bg);color:var(--ok)}
.wait{border:1px solid var(--warn);background:var(--warn-bg)}
.wait li{margin:6px 0 6px 18px}
.board{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.task{border-top:1px solid var(--line);padding:10px 0}.task:first-of-type{border-top:0}
.task .top{display:flex;gap:8px;justify-content:space-between;align-items:start}
.task .id{font-weight:700;color:var(--embr-text);margin-right:4px}
.task small{display:block;color:var(--graphite);margin-top:4px}
code{font-size:12px;background:var(--todo-bg);padding:1px 4px;border-radius:3px}
ul.log{list-style:none;padding:0}ul.log li{padding:6px 0;border-top:1px solid var(--line);font-size:14px}ul.log li:first-child{border-top:0}
</style></head><body><main>
<header><div><h1>Embr<span>.</span> workspace</h1><p class="muted">Generated from docs/workflow-state.md. Last updated ${esc(updated)}.</p></div>
<p class="muted">Rebuild: <code>npm run dashboard</code></p></header>

<section class="card focus"><h2>Current focus</h2><p>${inline(focus)}</p></section>

<section class="stats">${STATUSES.map((s) => `<div class="card stat"><b>${count(s)}</b>${pill(s)}</div>`).join('')}</section>

${waiting.length ? `<section class="card wait"><h2>Waiting on Luke (${waiting.length})</h2><ul>${waiting.map((w) => `<li><b>${esc(w.id)}</b> ${inline(w['what luke needs to do'])}<br><span class="muted">${inline(w.why)}</span></li>`).join('')}</ul></section>` : ''}

<section><h2>Agents</h2><div class="grid">${agents.map((a) => `<div class="card agent"><h3>${esc(a.agent)}</h3><span class="muted">${esc(ROLE[a.agent] || '')}</span><p>${inline(a['working on'])}</p>${pill(a.status)}</div>`).join('')}</div></section>

<section><h2>Backlog</h2><div class="board">${stages.map((s) => `<div class="card"><h2>${esc(s.name)} · ${s.rows.filter((r) => r.status === 'done').length}/${s.rows.length} done</h2>${s.rows.map((r) => `<div class="task"><div class="top"><div><span class="id">${esc(r.id)}</span>${inline(r.task)}</div>${pill(r.status)}</div><small>${esc(r.agent)} · Next: ${inline(r['next action'])}</small></div>`).join('')}</div>`).join('')}</div></section>

<section class="card"><h2>Recent sessions</h2><ul class="log">${log.map((l) => `<li>${inline(l)}</li>`).join('')}</ul></section>
</main></body></html>
`;
fs.writeFileSync(out, html);
console.log(`dashboard: ${all.length} tasks, ${waiting.length} waiting on Luke -> ${path.relative(root, out)}`);
