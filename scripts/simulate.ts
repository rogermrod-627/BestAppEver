// Quick sanity check for the generator: `npx tsx scripts/simulate.ts`
import { SEED_EMPLOYEES, SEED_REQUIREMENTS, SEED_TEMPLATES } from '../src/data/seed';
import { generateSchedule } from '../src/lib/scheduler';
import { computeWarnings, hardConflicts, shiftHours, weeklyHours } from '../src/lib/constraints';

const t0 = performance.now();
const shifts = generateSchedule(SEED_EMPLOYEES, SEED_TEMPLATES, SEED_REQUIREMENTS);
const ms = performance.now() - t0;
const open = shifts.filter((s) => !s.employeeId);
const demand = shifts.reduce((a, s) => a + shiftHours(s), 0);
const target = SEED_EMPLOYEES.reduce((a, e) => a + e.targetHours, 0);
console.log(`employees=${SEED_EMPLOYEES.length} shifts=${shifts.length} demand=${demand}h target=${target}h time=${ms.toFixed(0)}ms`);
console.log(`unassigned=${open.length}`);
for (const s of open) console.log('  ', s.day, s.templateId, s.role, '→', s.unassignedReason);
let violations = 0;
for (const s of shifts.filter((x) => x.employeeId)) {
  const e = SEED_EMPLOYEES.find((x) => x.id === s.employeeId)!;
  if (hardConflicts(e, s, shifts).length) violations++;
}
console.log('hard violations', violations);
const w = computeWarnings(SEED_EMPLOYEES, shifts);
console.log('warnings', w.length, w.map((x) => x.kind).join(','));
for (const e of SEED_EMPLOYEES) console.log(e.name.padEnd(18), String(weeklyHours(e.id, shifts)).padStart(5), '/', e.targetHours);

// Weekly report roll-up must reconcile: per-day and per-role costs sum to the total.
import { buildWeekReport } from '../src/lib/report';
const r = buildWeekReport('demo', shifts, SEED_EMPLOYEES);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ok = (a: number, b: number) => Math.abs(a - b) < 0.01;
console.log('report', { hours: r.totals.hours, cost: r.totals.cost.toFixed(2), ot: r.totals.overtimeHours, open: r.totals.open });
if (!ok(sum(r.days.map((d) => d.cost)), r.totals.cost) || !ok(sum(r.roles.map((x) => x.cost)), r.totals.cost) || !ok(sum(r.days.map((d) => d.hours)), r.totals.hours)) {
  console.error('report totals do not reconcile');
  process.exit(1);
}
console.log('report totals reconcile');
