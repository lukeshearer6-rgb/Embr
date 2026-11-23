// Parses docs/workflow-state.md into sections and tables.
// Shared by the dashboard (scripts/dashboard.mjs) and the office (scripts/office.mjs).
export function parseState(md) {
  const sections = {};
  let h2 = '', h3 = '';
  for (const line of md.split('\n')) {
    const m2 = line.match(/^## (.+)/), m3 = line.match(/^### (.+)/);
    if (m2) { h2 = m2[1].trim(); h3 = ''; continue; }
    if (m3) { h3 = m3[1].trim(); continue; }
    const key = h3 ? `${h2}/${h3}` : h2;
    (sections[key] ??= []).push(line);
  }
  const table = (key) => {
    const rows = (sections[key] || []).filter((l) => l.trim().startsWith('|'));
    if (rows.length < 2) return [];
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(rows[0]).map((h) => h.toLowerCase());
    return rows.slice(2).map((r) => Object.fromEntries(cells(r).map((c, i) => [head[i], c])));
  };
  const text = (key) => (sections[key] || []).join('\n').trim();
  const updated = (md.match(/Last updated:\s*(.+)/) || [])[1] || '';
  return { sections, table, text, updated };
}
