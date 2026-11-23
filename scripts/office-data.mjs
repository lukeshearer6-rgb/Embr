// Turns docs/workflow-state.md into the data the office view animates.
// Every walk in the office comes from a real line in the state file:
//   handoff  - task B waits on task A, or A's next action says "hand to <agent>":
//              A's owner carries the work to B's owner.
//   pickup   - a task waits on something Luke owns: its owner goes to Luke's desk to check.
//   approval - a task needs Luke's OK or choice: its owner takes it to Luke's desk.
//   assign   - the orchestrator takes each "Agents now" task to that agent.
import { parseState } from './workflow-state.mjs';

export const ROOMS = ['researcher', 'developer', 'app-builder', 'marketer', 'orchestrator', 'luke'];
const WALKERS = ['researcher', 'developer', 'app-builder', 'marketer', 'orchestrator'];
const STAGES = ['Research', 'Development', 'App build', 'Marketing'];
const ID = /\b([RDBM]\d+)\b/g;

// Phrases in a task's next action that mean Luke has to approve, choose or act.
const NEEDS_LUKE = /needs approval|luke (?:to approve|approves|chooses|picks|sends|posts|makes contact)|approve spend|partner choice/i;
const HAND_TO = /hand to (?:the )?(researcher|developer|app-builder|marketer)/i;

const short = (s = '', n = 46) => {
  const clean = s.replace(/`/g, '').replace(/\*\*/g, '');
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean;
};

export function officeData(md) {
  const { table, text, updated, sections } = parseState(md);
  const tasks = STAGES.flatMap((stage) =>
    table(`Backlog/${stage}`).map((r) => ({
      id: r.id, title: r.task, agent: (r.agent || '').toLowerCase(), status: (r.status || 'todo').toLowerCase(),
      verify: r['verify by'] || '', next: r['next action'] || '', stage,
    })));
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const now = table('Agents now').map((a) => ({ agent: a.agent.toLowerCase(), task: a['working on'], status: (a.status || 'todo').toLowerCase() }));
  const waiting = table('Waiting on Luke').map((w) => ({ id: w.id, what: w['what luke needs to do'], why: w.why }));

  const trips = [];
  const seen = new Set();
  const add = (trip) => {
    const key = `${trip.kind}:${trip.from}:${trip.to}:${trip.item}`;
    if (seen.has(key) || trip.from === trip.to || !WALKERS.includes(trip.from)) return;
    seen.add(key);
    trips.push(trip);
  };

  for (const t of tasks) {
    if (t.status === 'done') continue;
    const waitsOn = (t.next.match(/waits on (.+)/i) || [])[1] || '';
    for (const [, dep] of waitsOn.matchAll(ID)) {
      const src = byId[dep];
      if (!src || dep === t.id) continue;
      if (src.agent === 'luke') {
        add({ kind: 'pickup', from: t.agent, to: 'luke', item: dep, for: t.id,
          says: `${t.id} waits on ${dep}`, note: `${t.id} ${short(t.title, 40)} is waiting on Luke: ${short(src.title, 60)}` });
      } else if (src.status !== 'done') {
        add({ kind: 'handoff', from: src.agent, to: t.agent, item: dep, for: t.id,
          says: `${dep} for ${t.id}`, note: `${dep} ${short(src.title, 40)} goes to ${t.agent} for ${t.id} ${short(t.title, 40)}` });
      }
    }
    const hand = t.next.match(HAND_TO);
    if (hand) {
      const to = hand[1].toLowerCase();
      add({ kind: 'handoff', from: t.agent, to, item: t.id,
        says: `${t.id} brief`, note: `${t.id} ${short(t.title, 50)}: next action is to hand it to ${to}` });
    }
    // Tasks whose checks depend on research, e.g. "Claims checked against R6".
    for (const [, dep] of t.verify.matchAll(ID)) {
      const src = byId[dep];
      if (src && src.agent !== t.agent && src.status !== 'done' && src.agent !== 'luke') {
        add({ kind: 'handoff', from: src.agent, to: t.agent, item: dep, for: t.id,
          says: `${dep} for ${t.id}`, note: `${t.id} is checked against ${dep}, so ${src.agent} shares ${dep} with ${t.agent}` });
      }
    }
    if (t.status === 'needs-approval' || NEEDS_LUKE.test(t.next) || NEEDS_LUKE.test(t.title)) {
      add({ kind: 'approval', from: t.agent, to: 'luke', item: t.id,
        says: `${t.id} needs your OK`, note: `${t.id} ${short(t.title, 50)}: ${short(t.next, 70)}` });
    }
  }
  for (const a of now) {
    if (a.status === 'done') continue;
    const id = (a.task.match(ID) || [])[0] || '';
    add({ kind: 'assign', from: 'orchestrator', to: a.agent, item: id,
      says: `Over to you: ${id}`, note: `Orchestrator gives ${a.agent} ${short(a.task, 60)} (${a.status})` });
  }

  const desks = Object.fromEntries(ROOMS.map((r) => {
    const own = tasks.filter((t) => t.agent === r);
    const current = now.find((a) => a.agent === r);
    return [r, {
      current: current ? { task: current.task, status: current.status } : null,
      counts: Object.fromEntries(['todo', 'doing', 'blocked', 'needs-approval', 'done'].map((s) => [s, own.filter((t) => t.status === s).length])),
      tasks: own.map((t) => ({ id: t.id, title: t.title, status: t.status, next: t.next })),
    }];
  }));

  const log = (sections['Session log'] || []).filter((l) => l.startsWith('- ')).slice(0, 5).map((l) => l.slice(2));
  return { updated, focus: text('Current focus'), waiting, trips, desks, log };
}
