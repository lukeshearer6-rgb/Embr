// Checks the office view's data: every walk must come from a real line in workflow-state.md.
// Run: npm run test:office
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { officeData } from '../scripts/office-data.mjs';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

const sample = `# Embr workflow state

Last updated: 2026-01-01

## Current focus

Ship it.

## Agents now

| Agent | Working on | Status |
|---|---|---|
| researcher | R1 Look into hosting | doing |
| marketer | M1 Positioning | done |

## Waiting on Luke

| ID | What Luke needs to do | Why |
|---|---|---|
| B2 | Create accounts | Only Luke can |

## Backlog

### Research

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| R1 | Look into hosting | researcher | doing | Cited | Write brief |
| R2 | Domain costs | researcher | todo | Cited | Write brief for Luke to approve spend |
| R4 | Competitors | researcher | todo | Cited | Write brief; hand to marketer |
| R9 | Old work | researcher | done | Cited | None |

### Development

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| D2 | Server tests | developer | blocked | Works | Waits on B3 |
| D9 | Uses old work | developer | blocked | Works | Waits on R9 |

### App build

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| B2 | Luke makes accounts | luke | todo | Values | Luke follows SETUP |
| B3 | Deploy | app-builder | blocked | Log | Waits on B2; needs approval |

### Marketing

| ID | Task | Agent | Status | Verify by | Next action |
|---|---|---|---|---|---|
| M3 | Landing copy | marketer | todo | Claims checked against R2 | Draft |

## Session log

- 2026-01-01 orchestrator: test.
`;

const d = officeData(sample);
const has = (kind, from, to, item) => d.trips.some((t) => t.kind === kind && t.from === from && t.to === to && t.item === item);

check('waits-on makes a handoff from the owner of the earlier task', () => assert.ok(has('handoff', 'app-builder', 'developer', 'B3')));
check('"hand to" in the next action makes a handoff', () => assert.ok(has('handoff', 'researcher', 'marketer', 'R4')));
check('verify-by that names another task makes a handoff', () => assert.ok(has('handoff', 'researcher', 'marketer', 'R2')));
check('the same handoff is not repeated', () => assert.equal(d.trips.filter((t) => t.kind === 'handoff' && t.item === 'R4' && t.to === 'marketer').length, 1));
check('waiting on a task Luke owns sends the agent to Luke to check', () => assert.ok(has('pickup', 'app-builder', 'luke', 'B2')));
check('"needs approval" sends the task to Luke', () => assert.ok(has('approval', 'app-builder', 'luke', 'B3')));
check('"Luke to approve spend" sends the task to Luke', () => assert.ok(has('approval', 'researcher', 'luke', 'R2')));
check('a task that is already done is not carried again', () => assert.ok(!d.trips.some((t) => t.item === 'R9')));
check('orchestrator assigns only unfinished "Agents now" tasks', () => {
  assert.ok(has('assign', 'orchestrator', 'researcher', 'R1'));
  assert.ok(!d.trips.some((t) => t.kind === 'assign' && t.to === 'marketer'));
});
check('Luke never walks', () => assert.ok(!d.trips.some((t) => t.from === 'luke')));
check('a task with no links makes no walk', () => assert.ok(!d.trips.some((t) => t.item === 'R1' && t.kind !== 'assign')));
check('waiting on Luke and desk counts come through', () => {
  assert.deepEqual(d.waiting.map((w) => w.id), ['B2']);
  assert.equal(d.desks.developer.counts.blocked, 2);
  assert.equal(d.desks.researcher.current.status, 'doing');
});

// The real state file builds a page with its data inlined and safe to embed.
check('docs/office.html builds from the real state file', () => {
  execFileSync('node', ['scripts/office.mjs'], { stdio: 'pipe' });
  const html = fs.readFileSync('docs/office.html', 'utf8');
  assert.ok(!html.includes('/*__DATA__*/'));
  const json = html.match(/const DATA = (.+);\n/)[1];
  const real = JSON.parse(json);
  assert.ok(real.trips.length > 0);
  assert.ok(!json.includes('</'), 'no raw closing tags inside the inline script');
});

console.log(`\n${passed} office checks passed`);
