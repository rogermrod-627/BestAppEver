import type { Employee, Requirements, Shift, ShiftTemplate } from '../types';
import { DAYS, ROLES } from '../types';
import { canWorkRole, hardConflicts, MIN_REST_HOURS, shiftHours, weeklyHours } from './constraints';

let counter = 0;
export const newId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

interface Ctx {
  employees: Employee[];
  shifts: Shift[];
}

/**
 * Preference score for giving `shift` to `e` (higher is better). Only called
 * for employees who already passed every hard constraint.
 */
function score(e: Employee, shift: Shift, ctx: Ctx): number {
  const h = weeklyHours(e.id, ctx.shifts);
  const len = shiftHours(shift);
  const target = Math.max(e.targetHours, 1);

  // Fairness: whoever is furthest below their target (proportionally) goes first.
  let s = ((target - h) / target) * 100;
  const after = h + len;
  if (after > target) s -= 30 + (after - target) * 6;

  if (e.role === shift.role) s += 15;

  const mine = ctx.shifts.filter((x) => x.employeeId === e.id);
  if (mine.some((x) => x.day === shift.day)) s -= 45; // avoid doubles

  // Avoid clopens: short rest against neighbouring days.
  for (const x of mine) {
    const gap =
      x.day === shift.day - 1 ? (shift.day * 1440 + shift.start - (x.day * 1440 + x.end)) / 60
      : x.day === shift.day + 1 ? (x.day * 1440 + x.start - (shift.day * 1440 + shift.end)) / 60
      : Infinity;
    if (gap < MIN_REST_HOURS) s -= 35;
  }

  // Spread work across fewer, fuller days for consistency.
  const days = new Set(mine.map((x) => x.day)).size;
  s -= days * 2;
  return s;
}

function explainUnassigned(shift: Shift, ctx: Ctx): Pick<Shift, 'unassignedReason' | 'unassignedDetails'> {
  const trained = ctx.employees.filter((e) => canWorkRole(e, shift.role));
  if (!trained.length) {
    return { unassignedReason: `Unassigned: No trained ${shift.role}`, unassignedDetails: [] };
  }
  const tally = new Map<string, string[]>();
  for (const e of trained) {
    for (const r of hardConflicts(e, shift, ctx.shifts)) {
      const key = r.replace(/ \(\d+h\)$/, '');
      tally.set(key, [...(tally.get(key) ?? []), e.name.split(' ')[0]]);
    }
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
  return {
    unassignedReason: ranked[0]?.[0] ?? 'Unassigned: No eligible staff',
    unassignedDetails: ranked.map(([r, names]) => `${r} — ${names.length}/${trained.length} (${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''})`),
  };
}

export function buildSlots(templates: ShiftTemplate[], requirements: Requirements, pinned: Shift[]): Shift[] {
  const slots: Shift[] = [];
  for (const day of DAYS) {
    for (const t of templates) {
      const req = requirements[day]?.[t.id] ?? {};
      for (const role of ROLES) {
        const need = req[role] ?? 0;
        const already = pinned.filter((p) => p.day === day && p.templateId === t.id && p.role === role).length;
        for (let i = already; i < need; i++) {
          slots.push({ id: newId('sh'), day, templateId: t.id, role, start: t.start, end: t.end, employeeId: null });
        }
      }
    }
  }
  return slots;
}

/**
 * One-click generator: greedy most-constrained-first assignment with a
 * fairness score, followed by a swap-based repair pass for leftovers.
 */
export function generateSchedule(
  employees: Employee[],
  templates: ShiftTemplate[],
  requirements: Requirements,
  existing: Shift[] = [],
): Shift[] {
  const pinned = existing.filter((s) => s.pinned).map((s) => ({ ...s, unassignedReason: undefined, unassignedDetails: undefined }));
  const slots = buildSlots(templates, requirements, pinned);
  const ctx: Ctx = { employees, shifts: [...pinned] };

  // Most-constrained first: slots with the fewest statically-eligible people.
  const staticEligible = (s: Shift) => employees.filter((e) => hardConflicts(e, s, []).length === 0).length;
  const order = slots
    .map((s) => ({ s, n: staticEligible(s) }))
    .sort((a, b) => a.n - b.n || shiftHours(b.s) - shiftHours(a.s) || a.s.day - b.s.day || a.s.start - b.s.start)
    .map((x) => x.s);

  const open: Shift[] = [];
  for (const slot of order) {
    let best: Employee | null = null;
    let bestScore = -Infinity;
    for (const e of employees) {
      if (hardConflicts(e, slot, ctx.shifts).length) continue;
      const sc = score(e, slot, ctx);
      if (sc > bestScore) {
        bestScore = sc;
        best = e;
      }
    }
    if (best) ctx.shifts.push({ ...slot, employeeId: best.id });
    else open.push(slot);
  }

  // Repair: free up someone who could take an open slot by moving one of
  // their existing (unpinned) shifts to a different eligible employee.
  for (const slot of open.slice()) {
    let done = false;
    for (const a of employees) {
      if (done) break;
      for (const theirs of ctx.shifts.filter((x) => x.employeeId === a.id && !x.pinned)) {
        const without = ctx.shifts.filter((x) => x.id !== theirs.id);
        if (hardConflicts(a, slot, without).length) continue;
        const withSlot = [...without, { ...slot, employeeId: a.id }];
        const b = employees.find((e) => e.id !== a.id && hardConflicts(e, theirs, withSlot).length === 0);
        if (!b) continue;
        ctx.shifts = [...withSlot, { ...theirs, employeeId: b.id }];
        open.splice(open.indexOf(slot), 1);
        done = true;
        break;
      }
    }
  }

  for (const slot of open) ctx.shifts.push({ ...slot, ...explainUnassigned(slot, ctx) });
  return ctx.shifts.sort((a, b) => a.day - b.day || a.start - b.start);
}

/** Re-evaluate why open shifts are unfilled after manual edits. */
export function refreshUnassignedReasons(employees: Employee[], shifts: Shift[]): Shift[] {
  return shifts.map((s) => (s.employeeId ? { ...s, unassignedReason: undefined, unassignedDetails: undefined } : { ...s, ...explainUnassigned(s, { employees, shifts }) }));
}

/** Rank employees for a given shift: eligible ones first by score, then the rest with reasons. */
export function rankCandidates(employees: Employee[], shift: Shift, shifts: Shift[]) {
  const ctx: Ctx = { employees, shifts: shifts.filter((s) => s.id !== shift.id) };
  return employees
    .filter((e) => canWorkRole(e, shift.role))
    .map((e) => {
      const conflicts = hardConflicts(e, shift, ctx.shifts);
      return { employee: e, conflicts, score: conflicts.length ? -Infinity : score(e, shift, ctx), hours: weeklyHours(e.id, ctx.shifts) };
    })
    .sort((a, b) => b.score - a.score || a.conflicts.length - b.conflicts.length);
}

export function emptyRequirements(): Requirements {
  return Object.fromEntries(DAYS.map((d) => [d, {}])) as Requirements;
}
