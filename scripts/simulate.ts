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
