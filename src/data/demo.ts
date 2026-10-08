import { generateSchedule } from '../lib/scheduler';
import { addDays, weekKey } from '../lib/time';
import type { Day, Requirements, Role, Shift } from '../types';
import { SEED_EMPLOYEES, SEED_REQUIREMENTS, SEED_TEMPLATES } from './seed';

function tweak(base: Requirements, changes: [Day, string, Role, number][]): Requirements {
  const r: Requirements = structuredClone(base);
  for (const [day, tpl, role, delta] of changes) {
    r[day][tpl] = { ...(r[day][tpl] ?? {}), [role]: Math.max(0, (r[day][tpl]?.[role] ?? 0) + delta) };
  }
  return r;
}

/** Staffing needs for the demo's past weeks, so reports have some history to compare. */
const PAST_WEEKS: Requirements[] = [
  // 3 weeks ago: quiet week
  tweak(SEED_REQUIREMENTS, [[4, 'closing', 'Busser', -1], [5, 'dinner', 'Server', -1], [5, 'closing', 'Dishwasher', -1], [6, 'morning', 'Server', -1]]),
  // 2 weeks ago: private event on Saturday
  tweak(SEED_REQUIREMENTS, [[5, 'mid', 'Server', 2], [5, 'mid', 'Bartender', 1], [5, 'dinner', 'Busser', 1]]),
  // last week: normal week, one fewer Sunday brunch server
  tweak(SEED_REQUIREMENTS, [[6, 'morning', 'Server', -1]]),
];

/** Demo schedules: three weeks of history plus the current week. */
export function demoSchedules(current: Date): Record<string, Shift[]> {
  const out: Record<string, Shift[]> = {};
  PAST_WEEKS.forEach((reqs, i) => {
    out[weekKey(addDays(current, -7 * (PAST_WEEKS.length - i)))] = generateSchedule(SEED_EMPLOYEES, SEED_TEMPLATES, reqs);
  });
  out[weekKey(current)] = generateSchedule(SEED_EMPLOYEES, SEED_TEMPLATES, SEED_REQUIREMENTS);
  return out;
}
