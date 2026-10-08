import type { Day, Employee, Role, ScheduleWarning, Shift } from '../types';
import { DAYS, ROLES } from '../types';
import { computeWarnings, OVERTIME_HOURS, shiftHours } from './constraints';
import { DAY_NAMES, fmtTime } from './time';

/** Overtime is paid at 1.5× for hours past 40 in the week. */
export const OT_MULTIPLIER = 1.5;

export interface EmployeeLine {
  employeeId: string;
  name: string;
  role: Role | null;
  shifts: number;
  days: number;
  hours: number;
  target: number;
  variance: number;
  overtimeHours: number;
  cost: number;
  doubles: number;
  clopens: number;
  overrides: number;
}

export interface DayLine {
  day: Day;
  required: number;
  filled: number;
  hours: number;
  cost: number;
}

export interface RoleLine {
  role: Role;
  required: number;
  filled: number;
  hours: number;
  cost: number;
  people: number;
}

export interface WeekReport {
  weekKey: string;
  totals: {
    required: number;
    filled: number;
    open: number;
    hours: number;
    openHours: number;
    targetHours: number;
    regularCost: number;
    overtimeCost: number;
    cost: number;
    overtimeHours: number;
    avgRate: number;
    coverage: number;
    onTarget: number;
    staffScheduled: number;
  };
  employees: EmployeeLine[];
  days: DayLine[];
  roles: RoleLine[];
  openShifts: Shift[];
  overrides: Shift[];
  warnings: ScheduleWarning[];
}

/**
 * Roll a week's schedule up into labor, coverage and fairness numbers. Cost uses
 * each employee's hourly rate, with hours past 40 charged at 1.5×.
 */
export function buildWeekReport(weekKey: string, shifts: Shift[], employees: Employee[]): WeekReport {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const warnings = computeWarnings(employees, shifts);
  const filled = shifts.filter((s) => s.employeeId);

  // Per employee — includes anyone scheduled who has since left the team.
  const ids = new Set([...employees.map((e) => e.id), ...filled.map((s) => s.employeeId!)]);
  const lines: EmployeeLine[] = [...ids].map((id) => {
    const e = empById.get(id);
    const mine = filled.filter((s) => s.employeeId === id);
    const hours = mine.reduce((a, s) => a + shiftHours(s), 0);
    const rate = e?.hourlyRate ?? 0;
    const overtimeHours = Math.max(0, hours - OVERTIME_HOURS);
    const target = e?.targetHours ?? 0;
    const w = warnings.filter((x) => x.employeeId === id);
    return {
      employeeId: id,
      name: e?.name ?? 'Former employee',
      role: e?.role ?? null,
      shifts: mine.length,
      days: new Set(mine.map((s) => s.day)).size,
      hours,
      target,
      variance: hours - target,
      overtimeHours,
      cost: (hours - overtimeHours) * rate + overtimeHours * rate * OT_MULTIPLIER,
      doubles: w.filter((x) => x.kind === 'double').length,
      clopens: w.filter((x) => x.kind === 'clopen').length,
      overrides: mine.filter((s) => s.override).length,
    };
  });

  // Blended rate per employee lets day/role costs add up to the OT-inclusive total.
  const blended = new Map(lines.map((l) => [l.employeeId, l.hours ? l.cost / l.hours : 0]));
  const costOf = (list: Shift[]) => list.reduce((a, s) => a + shiftHours(s) * (s.employeeId ? blended.get(s.employeeId) ?? 0 : 0), 0);

  const days: DayLine[] = DAYS.map((day) => {
    const ds = shifts.filter((s) => s.day === day);
    const df = ds.filter((s) => s.employeeId);
    return { day, required: ds.length, filled: df.length, hours: df.reduce((a, s) => a + shiftHours(s), 0), cost: costOf(df) };
  });

  const roles: RoleLine[] = ROLES.map((role) => {
    const rs = shifts.filter((s) => s.role === role);
    const rf = rs.filter((s) => s.employeeId);
    return {
      role,
      required: rs.length,
      filled: rf.length,
      hours: rf.reduce((a, s) => a + shiftHours(s), 0),
      cost: costOf(rf),
      people: new Set(rf.map((s) => s.employeeId)).size,
    };
  }).filter((r) => r.required > 0);

  const hours = lines.reduce((a, l) => a + l.hours, 0);
  const cost = lines.reduce((a, l) => a + l.cost, 0);
  const overtimeHours = lines.reduce((a, l) => a + l.overtimeHours, 0);
  const overtimeCost = lines.reduce((a, l) => {
    const rate = empById.get(l.employeeId)?.hourlyRate ?? 0;
    return a + l.overtimeHours * rate * OT_MULTIPLIER;
  }, 0);
  const active = lines.filter((l) => empById.has(l.employeeId));
  const openShifts = shifts.filter((s) => !s.employeeId);

  return {
    weekKey,
    totals: {
      required: shifts.length,
      filled: filled.length,
      open: openShifts.length,
      hours,
      openHours: openShifts.reduce((a, s) => a + shiftHours(s), 0),
      targetHours: employees.reduce((a, e) => a + e.targetHours, 0),
      regularCost: cost - overtimeCost,
      overtimeCost,
      cost,
      overtimeHours,
      avgRate: hours ? cost / hours : 0,
      coverage: shifts.length ? filled.length / shifts.length : 1,
      onTarget: active.filter((l) => Math.abs(l.variance) <= 4).length,
      staffScheduled: lines.filter((l) => l.shifts > 0).length,
    },
    employees: lines,
    days,
    roles,
    openShifts: openShifts.sort((a, b) => a.day - b.day || a.start - b.start),
    overrides: filled.filter((s) => s.override),
    warnings,
  };
}

const csvCell = (v: string | number) => {
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100) : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Spreadsheet-friendly export. Never includes confidential personal notes. */
export function reportToCsv(r: WeekReport, weekLabel: string): string {
  const rows: (string | number)[][] = [
    [`Weekly labor report`, weekLabel],
    [],
    ['Summary'],
    ['Scheduled hours', r.totals.hours],
    ['Labor cost (est.)', r.totals.cost],
    ['Overtime hours', r.totals.overtimeHours],
    ['Overtime premium cost', r.totals.overtimeCost],
    ['Shifts filled', `${r.totals.filled}/${r.totals.required}`],
    ['Open shifts', r.totals.open],
    [],
    ['Employee', 'Role', 'Shifts', 'Days', 'Hours', 'Target', 'Variance', 'OT hours', 'Est. cost', 'Doubles', 'Clopens', 'Overrides'],
    ...r.employees
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => [l.name, l.role ?? '', l.shifts, l.days, l.hours, l.target, l.variance, l.overtimeHours, l.cost, l.doubles, l.clopens, l.overrides]),
    [],
    ['Day', 'Shifts required', 'Shifts filled', 'Hours', 'Est. cost'],
    ...r.days.map((d) => [DAY_NAMES[d.day], d.required, d.filled, d.hours, d.cost]),
    [],
    ['Role', 'Shifts required', 'Shifts filled', 'Hours', 'Est. cost', 'People'],
    ...r.roles.map((x) => [x.role, x.required, x.filled, x.hours, x.cost, x.people]),
    [],
    ['Open shift day', 'Role', 'Start', 'End', 'Reason'],
    ...r.openShifts.map((s) => [DAY_NAMES[s.day], s.role, fmtTime(s.start, false), fmtTime(s.end, false), s.unassignedReason ?? '']),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
