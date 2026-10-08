import type { Employee, ScheduleWarning, Shift, ShiftTemplate } from '../types';
import { BLOCK_REASON, RESTRICTION_LABEL, SITUATION } from './meta';
import { DAY_SHORT, fmtHours, hours, overlaps } from './time';

export const OVERTIME_HOURS = 40;
export const MIN_REST_HOURS = 10;

export interface Tag {
  label: string;
  cls: string;
}

/** Dynamic tags derived from the employee's situation and constraints. */
export function employeeTags(e: Employee): Tag[] {
  const tags: Tag[] = e.situations.map((s) => ({ label: SITUATION[s].label, cls: SITUATION[s].cls }));
  if (e.restriction !== 'none') {
    tags.push({ label: RESTRICTION_LABEL[e.restriction], cls: 'bg-amber-100 text-amber-800' });
  }
  if (e.maxShiftHours) tags.push({ label: `Max ${e.maxShiftHours}h shift`, cls: 'bg-fuchsia-100 text-fuchsia-800' });
  const days = new Set(e.unavailable.filter((b) => b.end - b.start >= 1440).map((b) => b.day));
  if (days.size) tags.push({ label: `Off ${[...days].sort().map((d) => DAY_SHORT[d]).join('/')}`, cls: 'bg-stone-200 text-stone-700' });
  for (const t of e.customTags) tags.push({ label: t, cls: 'bg-emerald-100 text-emerald-800' });
  return tags;
}

export const canWorkRole = (e: Employee, role: Shift['role']) => e.role === role || e.secondaryRoles.includes(role);

export const shiftHours = (s: Pick<Shift, 'start' | 'end'>) => hours(s.start, s.end);

/** Absolute minute in the week, used for rest-period checks across days. */
const absStart = (s: Pick<Shift, 'day' | 'start'>) => s.day * 1440 + s.start;
const absEnd = (s: Pick<Shift, 'day' | 'end'>) => s.day * 1440 + s.end;

export function weeklyHours(employeeId: string, shifts: Shift[], excludeId?: string) {
  let h = 0;
  for (const s of shifts) if (s.employeeId === employeeId && s.id !== excludeId) h += shiftHours(s);
  return h;
}

/**
 * Hard-constraint check: returns the list of reasons the employee may NOT
 * work this shift (empty list = eligible).
 */
export function hardConflicts(
  e: Employee,
  shift: Pick<Shift, 'id' | 'day' | 'start' | 'end' | 'role'>,
  shifts: Shift[],
  opts: { ignoreRole?: boolean } = {},
): string[] {
  const reasons: string[] = [];
  if (!opts.ignoreRole && !canWorkRole(e, shift.role)) reasons.push(`Not trained: ${shift.role}`);

  switch (e.restriction) {
    case 'morning-only':
      if (shift.start >= 12 * 60 || shift.end > 16 * 60) reasons.push('Conflict: Morning Only');
      break;
    case 'evening-only':
      if (shift.start < 15 * 60) reasons.push('Conflict: Evening Only');
      break;
    case 'no-late-nights':
      if (shift.end > 22 * 60) reasons.push('Conflict: No Late Nights');
      break;
  }

  // Recurring unavailability. A block on day D also covers the overflow of the
  // previous day's late shift (e.g. Sunday close running past midnight into Monday).
  for (const b of e.unavailable) {
    const hit =
      (b.day === shift.day && overlaps(shift.start, shift.end, b.start, b.end)) ||
      (b.day === (shift.day + 1) % 7 && shift.end > 1440 && overlaps(shift.start - 1440, shift.end - 1440, b.start, b.end));
    if (hit) {
      const label = `Conflict: ${BLOCK_REASON[b.reason].conflict}`;
      if (!reasons.includes(label)) reasons.push(label);
    }
  }

  const len = shiftHours(shift);
  if (e.maxShiftHours && len > e.maxShiftHours) reasons.push(`Conflict: Max ${e.maxShiftHours}h Shift`);

  const mine = shifts.filter((s) => s.employeeId === e.id && s.id !== shift.id);
  if (mine.some((s) => overlaps(absStart(s), absEnd(s), absStart(shift), absEnd(shift)))) {
    reasons.push('Conflict: Overlapping Shift');
  }

  const total = mine.reduce((acc, s) => acc + shiftHours(s), 0) + len;
  if (total > e.maxHours) reasons.push(`Unassigned: Exceeds Max Hours (${e.maxHours}h)`);

  if (e.maxDaysPerWeek) {
    const days = new Set(mine.map((s) => s.day));
    days.add(shift.day);
    if (days.size > e.maxDaysPerWeek) reasons.push(`Exceeds ${e.maxDaysPerWeek} Days/Week`);
  }
  return reasons;
}

/** Soft-constraint warnings across the whole schedule. */
export function computeWarnings(employees: Employee[], shifts: Shift[]): ScheduleWarning[] {
  const out: ScheduleWarning[] = [];
  const byEmp = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const list = byEmp.get(s.employeeId) ?? [];
    list.push(s);
    byEmp.set(s.employeeId, list);
  }

  for (const e of employees) {
    const mine = (byEmp.get(e.id) ?? []).slice().sort((a, b) => absStart(a) - absStart(b));
    if (!mine.length) continue;
    const total = mine.reduce((acc, s) => acc + shiftHours(s), 0);
    const ids = mine.map((s) => s.id);

    if (total > e.maxHours) {
      out.push({ kind: 'over-max', employeeId: e.id, shiftIds: [], severity: 'hard', message: `${fmtHours(total)} exceeds max of ${e.maxHours}h` });
    }
    if (total > OVERTIME_HOURS) {
      // Flag only the shifts that push the employee past the overtime line.
      let run = 0;
      const otIds = mine.filter((s) => (run += shiftHours(s)) > OVERTIME_HOURS).map((s) => s.id);
      out.push({ kind: 'overtime', employeeId: e.id, shiftIds: otIds, severity: 'soft', message: `Overtime: ${fmtHours(total)} scheduled (>${OVERTIME_HOURS}h)` });
    } else if (total > e.targetHours + 4) {
      out.push({ kind: 'over-target', employeeId: e.id, shiftIds: [], severity: 'soft', message: `${fmtHours(total - e.targetHours)} over target of ${e.targetHours}h` });
    }

    for (const d of new Set(mine.map((s) => s.day))) {
      const sameDay = mine.filter((s) => s.day === d);
      if (sameDay.length > 1) {
        out.push({ kind: 'double', employeeId: e.id, shiftIds: sameDay.map((s) => s.id), severity: 'soft', message: `Double shift on ${DAY_SHORT[d]}` });
      }
    }

    for (let i = 1; i < mine.length; i++) {
      const prev = mine[i - 1];
      const cur = mine[i];
      if (prev.day === cur.day) continue;
      const rest = (absStart(cur) - absEnd(prev)) / 60;
      if (rest >= 0 && rest < MIN_REST_HOURS) {
        out.push({ kind: 'clopen', employeeId: e.id, shiftIds: [prev.id, cur.id], severity: 'soft', message: `Clopening: only ${fmtHours(rest)} rest ${DAY_SHORT[prev.day]}→${DAY_SHORT[cur.day]}` });
      }
    }

    if (e.maxDaysPerWeek) {
      const days = new Set(mine.map((s) => s.day)).size;
      if (days > e.maxDaysPerWeek) {
        out.push({ kind: 'too-many-days', employeeId: e.id, shiftIds: ids, severity: 'hard', message: `${days} days scheduled (max ${e.maxDaysPerWeek})` });
      }
    }

    for (const s of mine) {
      const conflicts = hardConflicts(e, s, shifts).filter((r) => !r.includes('Exceeds'));
      if (conflicts.length) {
        out.push({ kind: 'hard-conflict', employeeId: e.id, shiftIds: [s.id], severity: 'hard', message: conflicts.join(' · ') });
      }
    }
  }
  return out;
}

export function templateFor(templates: ShiftTemplate[], id: string) {
  return templates.find((t) => t.id === id);
}
