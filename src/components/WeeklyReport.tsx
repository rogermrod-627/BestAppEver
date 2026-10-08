import { AlertTriangle, ArrowDown, ArrowUp, CalendarRange, CircleAlert, Clock, DollarSign, Download, Inbox, Printer, Timer, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ROLE_STYLE } from '../lib/meta';
import { buildWeekReport, reportToCsv, type EmployeeLine, type WeekReport } from '../lib/report';
import { DAY_NAMES, DAY_SHORT, addDays, fmtHours, fmtMoney, fmtRange, fmtWeek, parseWeekKey, weekKey } from '../lib/time';
import type { Employee, Shift } from '../types';
import { btn, cx } from './common';

interface Props {
  week: Date;
  employees: Employee[];
  schedules: Record<string, Shift[]>;
  onSelectWeek: (week: Date) => void;
  onOpenSchedule: () => void;
}

const TREND_WEEKS = 8;

export function WeeklyReport({ week, employees, schedules, onSelectWeek, onOpenSchedule }: Props) {
  const key = weekKey(week);
  const shifts = schedules[key];
  const report = useMemo(() => (shifts ? buildWeekReport(key, shifts, employees) : null), [key, shifts, employees]);
  const prevKey = weekKey(addDays(week, -7));
  const prev = useMemo(() => (schedules[prevKey] ? buildWeekReport(prevKey, schedules[prevKey], employees) : null), [prevKey, schedules, employees]);

  // The selected week plus the weeks before it, oldest first.
  const trend = useMemo(() => {
    const out: { key: string; week: Date; report: WeekReport | null }[] = [];
    for (let i = TREND_WEEKS - 1; i >= 0; i--) {
      const w = addDays(week, -7 * i);
      const k = weekKey(w);
      out.push({ key: k, week: w, report: schedules[k] ? buildWeekReport(k, schedules[k], employees) : null });
    }
    // Drop empty weeks before the first scheduled one.
    const first = out.findIndex((w) => w.report);
    return out.slice(Math.max(0, first));
  }, [week, schedules, employees]);

  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <CalendarRange className="mx-auto h-10 w-10 text-stone-300" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">No schedule for {fmtWeek(week)}</h2>
        <p className="mt-1 text-sm text-stone-500">Reports are built from a week's schedule. Create one first.</p>
        <button className={cx(btn.primary, 'mt-4')} onClick={onOpenSchedule}>Go to schedule</button>
        <SavedWeeks schedules={schedules} current={key} onSelect={onSelectWeek} />
      </div>
    );
  }

  const t = report.totals;
  const download = () => {
    const blob = new Blob([reportToCsv(report, fmtWeek(week))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `labor-report-${key}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Weekly labor report</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{fmtWeek(week)}, {week.getFullYear()}</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {t.staffScheduled} staff scheduled · {t.filled}/{t.required} shifts filled
            {prev ? ` · compared with ${fmtWeek(parseWeekKey(prevKey))}` : ' · no prior week to compare'}
          </p>
        </div>
        <div className="ml-auto flex gap-2 print:hidden">
          <button className={btn.secondary} onClick={download}><Download className="h-4 w-4" /> Export CSV</button>
          <button className={btn.secondary} onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Labor cost" value={fmtMoney(t.cost)} delta={prev && { now: t.cost, before: prev.totals.cost, fmt: fmtMoney, upIsBad: true }} sub={`${fmtMoney(t.overtimeCost)} overtime`} />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Scheduled hours" value={fmtHours(t.hours)} delta={prev && { now: t.hours, before: prev.totals.hours, fmt: fmtHours }} sub={`team target ${fmtHours(t.targetHours)}`} />
        <Kpi icon={<Inbox className="h-4 w-4" />} label="Coverage" value={`${Math.round(t.coverage * 100)}%`} delta={prev && { now: t.coverage * 100, before: prev.totals.coverage * 100, fmt: (n) => `${n.toFixed(0)} pts` }}
          sub={t.open ? `${t.open} open · ${fmtHours(t.openHours)} uncovered` : 'Every shift filled'} tone={t.open ? 'bad' : 'good'} />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Overtime" value={fmtHours(t.overtimeHours)} delta={prev && { now: t.overtimeHours, before: prev.totals.overtimeHours, fmt: fmtHours, upIsBad: true }}
          sub={`${report.employees.filter((l) => l.overtimeHours > 0).length} people over 40h`} tone={t.overtimeHours ? 'warn' : 'good'} />
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Avg cost / hour" value={`$${t.avgRate.toFixed(2)}`} delta={prev && { now: t.avgRate, before: prev.totals.avgRate, fmt: (n) => `$${n.toFixed(2)}`, upIsBad: true }} sub="incl. overtime premium" />
        <Kpi icon={<Users className="h-4 w-4" />} label="On target" value={`${t.onTarget}/${employees.length}`} delta={prev && { now: t.onTarget, before: prev.totals.onTarget, fmt: (n) => `${n}` }} sub="within ±4h of target" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Labor cost by week" subtitle={`Up to ${TREND_WEEKS} weeks · click a bar to open that week`}>
          <BarChart
            bars={trend.map((w) => ({
              key: w.key,
              label: fmtWeek(w.week).split(' – ')[0],
              value: w.report?.totals.cost ?? null,
              active: w.key === key,
              tip: w.report ? [fmtWeek(w.week), fmtMoney(w.report.totals.cost), `${fmtHours(w.report.totals.hours)} · ${Math.round(w.report.totals.coverage * 100)}% covered`] : [fmtWeek(w.week), 'No schedule'],
              onClick: () => onSelectWeek(w.week),
            }))}
            fmt={fmtMoney}
          />
        </Card>
        <Card title="Labor cost by day" subtitle="Share of this week's cost">
          <BarChart
            bars={report.days.map((d) => ({
              key: String(d.day),
              label: DAY_SHORT[d.day],
              value: d.cost,
              active: true,
              tip: [DAY_NAMES[d.day], fmtMoney(d.cost), `${fmtHours(d.hours)} · ${d.filled}/${d.required} shifts`],
            }))}
            fmt={fmtMoney}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="By position">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-stone-400">
              <tr>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 text-right font-medium">Filled</th>
                <th className="pb-2 text-right font-medium">Hours</th>
                <th className="pb-2 pl-4 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {report.roles.map((r) => (
                <tr key={r.role}>
                  <td className="py-2">
                    <span className="flex items-center gap-2 font-medium text-slate-700"><span className={cx('h-2 w-2 rounded-full', ROLE_STYLE[r.role].dot)} />{r.role}</span>
                    <span className="pl-4 text-[11px] text-stone-400">{r.people} people</span>
                  </td>
                  <td className={cx('py-2 text-right tabular-nums', r.filled < r.required ? 'font-semibold text-red-600' : 'text-slate-600')}>{r.filled}/{r.required}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{fmtHours(r.hours)}</td>
                  <td className="py-2 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.cost / Math.max(t.cost, 1)) * 100}%` }} />
                      </div>
                      <span className="w-16 text-right tabular-nums text-slate-700">{fmtMoney(r.cost)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Exceptions" subtitle="What needs a manager's attention">
          <div className="space-y-3 text-sm">
            <Exception count={report.openShifts.length} label="Open shifts" tone="bad">
              {report.openShifts.slice(0, 6).map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-24 shrink-0 text-stone-500">{DAY_SHORT[s.day]} {fmtRange(s.start, s.end)}</span>
                  <span className="w-20 shrink-0 font-medium text-slate-700">{s.role}</span>
                  <span className="truncate text-red-600">{s.unassignedReason?.replace(/^(Unassigned|Conflict): /, '')}</span>
                </li>
              ))}
              {report.openShifts.length > 6 && <li className="text-stone-400">+{report.openShifts.length - 6} more</li>}
            </Exception>
            <Exception count={report.overrides.length} label="Constraint overrides" tone="bad">
              {report.overrides.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-24 shrink-0 text-stone-500">{DAY_SHORT[s.day]} {fmtRange(s.start, s.end)}</span>
                  <span className="truncate font-medium text-slate-700">{employees.find((e) => e.id === s.employeeId)?.name ?? 'Former employee'}</span>
                </li>
              ))}
            </Exception>
            <Exception count={report.warnings.filter((w) => w.kind === 'overtime').length} label="Overtime" tone="warn" />
            <Exception count={report.warnings.filter((w) => w.kind === 'double').length} label="Double shifts" tone="warn" />
            <Exception count={report.warnings.filter((w) => w.kind === 'clopen').length} label="Clopens (<10h rest)" tone="warn" />
          </div>
        </Card>
      </div>

      <EmployeeTable lines={report.employees} />
    </div>
  );
}

function SavedWeeks({ schedules, current, onSelect }: { schedules: Record<string, Shift[]>; current: string; onSelect: (w: Date) => void }) {
  const keys = Object.keys(schedules).sort().reverse().slice(0, 8);
  if (!keys.length) return null;
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs text-stone-500">Weeks with schedules</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {keys.map((k) => (
          <button key={k} onClick={() => onSelect(parseWeekKey(k))}
            className={cx('rounded-full border px-3 py-1 text-xs font-medium', k === current ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}>
            {fmtWeek(parseWeekKey(k))}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm print:break-inside-avoid print:shadow-none">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-[11px] text-stone-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface Delta {
  now: number;
  before: number;
  fmt: (n: number) => string;
  upIsBad?: boolean;
}

function Kpi({ icon, label, value, sub, delta, tone }: { icon: ReactNode; label: string; value: string; sub: string; delta?: Delta | null; tone?: 'good' | 'warn' | 'bad' }) {
  const diff = delta ? delta.now - delta.before : 0;
  const flat = Math.abs(diff) < 0.005;
  const bad = delta?.upIsBad ? diff > 0 : diff < 0;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm print:shadow-none">
      <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        <span className={cx('grid h-6 w-6 place-items-center rounded-md', tone === 'bad' ? 'bg-red-100 text-red-700' : tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {delta && (
        <div className={cx('mt-0.5 flex items-center gap-0.5 text-[11px] font-medium', flat ? 'text-stone-400' : bad ? 'text-red-600' : 'text-emerald-700')}>
          {!flat && (diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          {flat ? 'No change' : `${delta.fmt(Math.abs(diff))} vs last week`}
        </div>
      )}
      <div className="mt-0.5 truncate text-[11px] text-stone-500">{sub}</div>
    </div>
  );
}

function Exception({ count, label, tone, children }: { count: number; label: string; tone: 'bad' | 'warn'; children?: ReactNode }) {
  const Icon = tone === 'bad' ? CircleAlert : AlertTriangle;
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className={cx('h-4 w-4', count === 0 ? 'text-stone-300' : tone === 'bad' ? 'text-red-500' : 'text-amber-500')} />
        <span className="font-medium text-slate-700">{label}</span>
        <span className={cx('ml-auto rounded-full px-2 py-px text-xs font-semibold tabular-nums', count === 0 ? 'bg-stone-100 text-stone-400' : tone === 'bad' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{count}</span>
      </div>
      {count > 0 && children && <ul className="mt-1.5 space-y-1 pl-6 text-xs">{children}</ul>}
    </div>
  );
}

interface Bar {
  key: string;
  label: string;
  value: number | null;
  active: boolean;
  tip: string[];
  onClick?: () => void;
}

/** Single-series bar chart (176px tall, 20px label gutter) with a recessive grid and per-bar hover tooltip. */
function BarChart({ bars, fmt }: { bars: Bar[]; fmt: (n: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const hovered = bars.find((b) => b.key === hover);

  return (
    <div className="relative">
      <div className="flex h-44 gap-2">
        <div className="flex w-14 flex-col-reverse justify-between pb-5 text-right text-[10px] tabular-nums text-stone-400">
          {ticks.map((v) => <span key={v}>{fmt(v)}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((v) => (
            <div key={v} className="absolute inset-x-0 border-t border-stone-100" style={{ bottom: `${20 + (v / max) * 156}px` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5 pb-5">
            {bars.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={b.onClick}
                onMouseEnter={() => setHover(b.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(b.key)}
                onBlur={() => setHover(null)}
                aria-label={b.tip.join(', ')}
                className={cx('relative flex h-full flex-1 items-end justify-center', b.onClick ? 'cursor-pointer' : 'cursor-default')}
              >
                {b.value === null ? (
                  <span className="mb-0.5 h-1 w-full max-w-10 rounded-full border border-dashed border-stone-300" />
                ) : (
                  <span
                    className={cx('w-full max-w-10 rounded-t transition-colors', b.active ? 'bg-emerald-500' : 'bg-emerald-200', hover === b.key && 'bg-emerald-600')}
                    style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
                  />
                )}
                <span className={cx('absolute -bottom-5 whitespace-nowrap text-[10px]', b.active && b.onClick ? 'font-semibold text-slate-700' : 'text-stone-500')}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {hovered && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs shadow-lg">
          <div className="font-semibold text-slate-800">{hovered.tip[0]}</div>
          {hovered.tip.slice(1).map((l) => <div key={l} className="text-slate-600">{l}</div>)}
        </div>
      )}
    </div>
  );
}

type SortKey = 'name' | 'hours' | 'variance' | 'cost' | 'overtimeHours';

function EmployeeTable({ lines }: { lines: EmployeeLine[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'variance', dir: 1 });
  const sorted = [...lines].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
  });
  const under = lines.filter((l) => l.role && l.variance < -4).length;
  const head = (k: SortKey, label: string, right = true) => (
    <th className={cx('px-3 py-2 font-medium', right && 'text-right')}>
      <button className="inline-flex items-center gap-0.5 hover:text-stone-700" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-baseline gap-2 px-5 pt-5">
        <h2 className="text-sm font-semibold text-slate-800">Hours by employee</h2>
        <span className="text-[11px] text-stone-500">{under ? `${under} people are more than 4h under their target and could take more shifts` : 'Everyone is within reach of their target'}</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-y border-stone-100 bg-stone-50 text-left text-[11px] uppercase tracking-wider text-stone-400">
            <tr>
              {head('name', 'Employee', false)}
              <th className="px-3 py-2 text-right font-medium">Shifts</th>
              {head('hours', 'Hours')}
              <th className="px-3 py-2 text-right font-medium">Target</th>
              {head('variance', 'Variance')}
              {head('overtimeHours', 'OT')}
              {head('cost', 'Est. cost')}
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.map((l) => (
              <tr key={l.employeeId} className="hover:bg-stone-50/60">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={cx('h-2 w-2 shrink-0 rounded-full', l.role ? ROLE_STYLE[l.role].dot : 'bg-stone-300')} />
                    <span className="font-medium text-slate-800">{l.name}</span>
                    <span className="text-[11px] text-stone-400">{l.role ?? ''}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.shifts} <span className="text-stone-400">/ {l.days}d</span></td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{fmtHours(l.hours)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-500">{l.role ? `${l.target}h` : '—'}</td>
                <td className={cx('px-3 py-2 text-right font-medium tabular-nums', !l.role ? 'text-stone-400' : l.variance < -4 ? 'text-sky-700' : l.variance > 4 ? 'text-amber-700' : 'text-emerald-700')}>
                  {l.role ? `${l.variance > 0 ? '+' : l.variance < 0 ? '−' : ''}${fmtHours(Math.abs(l.variance))}` : '—'}
                </td>
                <td className={cx('px-3 py-2 text-right tabular-nums', l.overtimeHours ? 'font-semibold text-red-600' : 'text-stone-300')}>{l.overtimeHours ? fmtHours(l.overtimeHours) : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtMoney(l.cost)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {l.doubles > 0 && <Flag cls="bg-amber-100 text-amber-800">{l.doubles} double{l.doubles > 1 ? 's' : ''}</Flag>}
                    {l.clopens > 0 && <Flag cls="bg-amber-100 text-amber-800">{l.clopens} clopen{l.clopens > 1 ? 's' : ''}</Flag>}
                    {l.overrides > 0 && <Flag cls="bg-red-100 text-red-700">{l.overrides} override{l.overrides > 1 ? 's' : ''}</Flag>}
                    {l.role && l.variance < -4 && <Flag cls="bg-sky-100 text-sky-800">Wants hours</Flag>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Flag({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={cx('rounded-full px-1.5 py-px text-[10px] font-medium', cls)}>{children}</span>;
}
