import { AlertTriangle, Clock, DollarSign, Inbox, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { shiftHours } from '../lib/constraints';
import { buildWeekReport } from '../lib/report';
import { ROLE_STYLE } from '../lib/meta';
import { fmtHours, fmtMoney } from '../lib/time';
import type { Employee, Role, ScheduleWarning, Shift } from '../types';
import { cx } from './common';

interface Props {
  employees: Employee[];
  shifts: Shift[];
  warnings: ScheduleWarning[];
  onShowOpen: () => void;
}

export function Dashboard({ employees, shifts, warnings, onShowOpen }: Props) {
  const filled = shifts.filter((s) => s.employeeId);
  const open = shifts.length - filled.length;
  const scheduled = filled.reduce((a, s) => a + shiftHours(s), 0);
  const target = employees.reduce((a, e) => a + e.targetHours, 0);
  const report = buildWeekReport('', shifts, employees);
  const cost = report.totals.cost;
  const openCost = shifts.filter((s) => !s.employeeId).reduce((a, s) => a + shiftHours(s), 0);
  const hard = warnings.filter((w) => w.severity === 'hard').length;
  const soft = warnings.length - hard;
  const byKind = (k: ScheduleWarning['kind']) => warnings.filter((w) => w.kind === k).length;

  const hoursByEmp = new Map<string, number>();
  for (const s of filled) hoursByEmp.set(s.employeeId!, (hoursByEmp.get(s.employeeId!) ?? 0) + shiftHours(s));
  const onTarget = employees.filter((e) => Math.abs((hoursByEmp.get(e.id) ?? 0) - e.targetHours) <= 4).length;

  const roleCost = report.roles.filter((x) => x.cost > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat icon={<Clock className="h-4 w-4" />} tone="emerald" label="Scheduled hours" value={fmtHours(scheduled)} sub={`vs ${fmtHours(target)} team target`}>
        <Bar pct={scheduled / Math.max(target, 1)} cls={scheduled > target * 1.05 ? 'bg-amber-400' : 'bg-emerald-400'} />
      </Stat>
      <Stat icon={<DollarSign className="h-4 w-4" />} tone="sky" label="Est. labor cost" value={fmtMoney(cost)} sub={`avg $${report.totals.avgRate.toFixed(2)}/hr · ${fmtMoney(report.totals.overtimeCost)} OT`}>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-stone-100" title={roleCost.map((r) => `${r.role}: ${fmtMoney(r.cost)}`).join('\n')}>
          {roleCost.map((r) => <div key={r.role} className={ROLE_STYLE[r.role as Role].dot} style={{ width: `${(r.cost / Math.max(cost, 1)) * 100}%` }} />)}
        </div>
      </Stat>
      <Stat
        icon={<Inbox className="h-4 w-4" />}
        tone={open ? 'red' : 'emerald'}
        label="Unassigned shifts"
        value={String(open)}
        sub={open ? `${fmtHours(openCost)} uncovered — click to review` : 'Every shift is covered'}
        onClick={open ? onShowOpen : undefined}
      >
        <Bar pct={shifts.length ? filled.length / shifts.length : 1} cls={open ? 'bg-red-400' : 'bg-emerald-400'} />
      </Stat>
      <Stat icon={<AlertTriangle className="h-4 w-4" />} tone={hard ? 'red' : soft ? 'amber' : 'emerald'} label="Warnings" value={String(warnings.length)}
        sub={warnings.length ? [hard && `${hard} conflict`, byKind('overtime') && `${byKind('overtime')} OT`, byKind('double') && `${byKind('double')} doubles`, byKind('clopen') && `${byKind('clopen')} clopens`, byKind('over-target') && `${byKind('over-target')} over target`].filter(Boolean).join(' · ') : 'No overtime or doubles'} />
      <Stat icon={<Users className="h-4 w-4" />} tone="violet" label="On-target staff" value={`${onTarget}/${employees.length}`} sub="within ±4h of target hours">
        <Bar pct={employees.length ? onTarget / employees.length : 0} cls="bg-violet-400" />
      </Stat>
    </div>
  );
}

const TONES = {
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
};

function Stat({ icon, tone, label, value, sub, children, onClick }: { icon: ReactNode; tone: keyof typeof TONES; label: string; value: string; sub: string; children?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm', onClick && 'transition hover:border-red-200 hover:shadow-md')}>
      <div className="flex items-center gap-2">
        <span className={cx('grid h-7 w-7 place-items-center rounded-lg', TONES[tone])}>{icon}</span>
        <span className="text-xs font-medium text-stone-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-stone-500">{sub}</div>
      {children}
    </Tag>
  );
}

function Bar({ pct, cls }: { pct: number; cls: string }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
      <div className={cx('h-full rounded-full', cls)} style={{ width: `${Math.min(1, pct) * 100}%` }} />
    </div>
  );
}
