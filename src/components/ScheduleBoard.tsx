import { AlertTriangle, CircleAlert, Inbox, PencilLine } from 'lucide-react';
import { Fragment, useMemo, useState, type DragEvent } from 'react';
import { employeeTags, hardConflicts, OVERTIME_HOURS, shiftHours } from '../lib/constraints';
import { BLOCK_REASON, ROLE_AREA } from '../lib/meta';
import { DAY_SHORT, dateFor, fmtDate, fmtHours, fmtMoney, fmtRange } from '../lib/time';
import type { Day, Employee, ScheduleWarning, Shift, ShiftTemplate } from '../types';
import { DAYS } from '../types';
import { Avatar, ConstraintSummary, TagPill, cx } from './common';
import { Hover } from './Hover';
import { ShiftChip } from './ShiftChip';

interface Props {
  employees: Employee[];
  allEmployees: Employee[];
  shifts: Shift[];
  templates: ShiftTemplate[];
  warnings: ScheduleWarning[];
  week: Date;
  privacy: boolean;
  groupByArea: boolean;
  onAssign: (shiftId: string, employeeId: string | null) => void;
  onOpenShift: (shiftId: string) => void;
  onOpenEmployee: (employeeId: string) => void;
}

const COLS = 'grid-cols-[240px_repeat(7,minmax(128px,1fr))_120px]';
const OPEN_ROW = '__open__';

export function ScheduleBoard({ employees, allEmployees, shifts, templates, warnings, week, privacy, groupByArea, onAssign, onOpenShift, onOpenEmployee }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);

  const dragShift = dragId ? shifts.find((s) => s.id === dragId) ?? null : null;
  const tplById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const empById = useMemo(() => new Map(allEmployees.map((e) => [e.id, e])), [allEmployees]);

  const cells = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.employeeId ?? OPEN_ROW}:${s.day}`;
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    for (const list of m.values()) list.sort((a, b) => a.start - b.start);
    return m;
  }, [shifts]);

  const warnByShift = useMemo(() => {
    const m = new Map<string, ScheduleWarning[]>();
    for (const w of warnings) for (const id of w.shiftIds) m.set(id, [...(m.get(id) ?? []), w]);
    return m;
  }, [warnings]);
  const warnByEmp = useMemo(() => {
    const m = new Map<string, ScheduleWarning[]>();
    for (const w of warnings) m.set(w.employeeId, [...(m.get(w.employeeId) ?? []), w]);
    return m;
  }, [warnings]);

  const hoursByEmp = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) if (s.employeeId) m.set(s.employeeId, (m.get(s.employeeId) ?? 0) + shiftHours(s));
    return m;
  }, [shifts]);

  // Eligibility of every employee for the shift being dragged (only its own day is a valid target).
  const dropInfo = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!dragShift) return m;
    for (const e of allEmployees) m.set(e.id, hardConflicts(e, dragShift, shifts));
    return m;
  }, [dragShift, allEmployees, shifts]);

  const groups = useMemo(() => {
    if (!groupByArea) return [{ label: null as string | null, list: employees }];
    const foh = employees.filter((e) => ROLE_AREA[e.role] === 'Front of House');
    const boh = employees.filter((e) => ROLE_AREA[e.role] === 'Back of House');
    return [
      { label: 'Front of House', list: foh },
      { label: 'Back of House', list: boh },
    ].filter((g) => g.list.length);
  }, [employees, groupByArea]);

  const endDrag = () => {
    setDragId(null);
    setOverCell(null);
  };

  const handleDrop = (ev: DragEvent, employeeId: string | null, day: Day) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain') || dragId;
    const s = shifts.find((x) => x.id === id);
    endDrag();
    if (!s || s.day !== day || s.employeeId === employeeId) return;
    onAssign(s.id, employeeId);
  };

  const dropHandlers = (key: string, employeeId: string | null, day: Day) => ({
    'data-cell': key,
    onDragOver: (ev: DragEvent) => {
      if (!dragShift || dragShift.day !== day) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      if (overCell !== key) setOverCell(key);
    },
    onDragLeave: () => overCell === key && setOverCell(null),
    onDrop: (ev: DragEvent) => handleDrop(ev, employeeId, day),
  });

  const dayStats = DAYS.map((d) => {
    const ds = shifts.filter((s) => s.day === d);
    const filled = ds.filter((s) => s.employeeId);
    return {
      total: ds.length,
      filled: filled.length,
      hours: filled.reduce((a, s) => a + shiftHours(s), 0),
      cost: filled.reduce((a, s) => a + shiftHours(s) * (empById.get(s.employeeId!)?.hourlyRate ?? 0), 0),
    };
  });

  const renderChips = (list: Shift[] | undefined) =>
    list?.map((s) => (
      <ShiftChip
        key={s.id}
        shift={s}
        template={tplById.get(s.templateId)}
        employee={s.employeeId ? empById.get(s.employeeId) : undefined}
        warnings={warnByShift.get(s.id) ?? []}
        dragging={dragId === s.id}
        anyDragging={!!dragId}
        onDragStart={setDragId}
        onDragEnd={endDrag}
        onClick={onOpenShift}
      />
    ));

  const openCount = shifts.filter((s) => !s.employeeId).length;

  return (
    <div className="scroll-thin max-h-[calc(100vh-150px)] min-h-[420px] overflow-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className={cx('grid min-w-[1260px]', COLS)}>
        {/* ── Header ── */}
        <div className="sticky left-0 top-0 z-30 flex items-end border-b border-r border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Team</div>
            <div className="text-sm font-semibold text-slate-800">{employees.length} employees</div>
          </div>
        </div>
        {DAYS.map((d) => {
          const st = dayStats[d];
          const pct = st.total ? st.filled / st.total : 1;
          const isDragDay = dragShift?.day === d;
          return (
            <div key={d} className={cx('sticky top-0 z-20 border-b border-r border-stone-200 px-3 py-2.5 backdrop-blur', isDragDay ? 'bg-emerald-50/95' : 'bg-stone-50/95')}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">{DAY_SHORT[d]}</span>
                <span className="text-[11px] text-stone-500">{fmtDate(dateFor(week, d))}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div className={cx('h-full rounded-full', pct === 1 ? 'bg-emerald-400' : pct > 0.9 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${pct * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-stone-500">
                <span>{st.filled}/{st.total} filled</span>
                <span>{fmtHours(st.hours)} · {fmtMoney(st.cost)}</span>
              </div>
            </div>
          );
        })}
        <div className="sticky top-0 z-20 flex items-end border-b border-stone-200 bg-stone-50/95 px-3 py-3 backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Hours / Target</div>
        </div>

        {/* ── Open shifts row ── */}
        <div className={cx('sticky left-0 z-10 flex items-start gap-2.5 border-b border-r border-stone-200 px-4 py-3', openCount ? 'bg-red-50' : 'bg-emerald-50')}>
          <div className={cx('grid h-9 w-9 place-items-center rounded-full', openCount ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}>
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Open Shifts</div>
            <div className={cx('text-[11px]', openCount ? 'text-red-600' : 'text-emerald-700')}>
              {openCount ? `${openCount} need coverage` : 'All shifts covered'}
            </div>
            <div className="mt-0.5 text-[10px] text-stone-500">Drop a shift here to unassign</div>
          </div>
        </div>
        {DAYS.map((d) => {
          const key = `${OPEN_ROW}:${d}`;
          const isTarget = dragShift?.day === d && dragShift.employeeId !== null;
          return (
            <div
              key={key}
              {...dropHandlers(key, null, d)}
              className={cx(
                'min-h-[64px] space-y-1 border-b border-r border-stone-200 p-1.5 transition',
                openCount ? 'bg-red-50/40' : 'bg-emerald-50/30',
                dragShift && dragShift.day !== d && 'opacity-50',
                isTarget && 'bg-stone-100',
                overCell === key && 'ring-2 ring-inset ring-slate-400',
              )}
            >
              {renderChips(cells.get(key))}
            </div>
          );
        })}
        <div className="border-b border-stone-200 bg-stone-50/50" />

        {/* ── Employees ── */}
        {groups.map((g) => (
          <Fragment key={g.label ?? 'all'}>
            {g.label && (
              <div className="col-span-full sticky left-0 border-b border-stone-200 bg-stone-100/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                {g.label} · {g.list.length}
              </div>
            )}
            {g.list.map((e) => {
              const h = hoursByEmp.get(e.id) ?? 0;
              const empWarn = warnByEmp.get(e.id) ?? [];
              const conflicts = dropInfo.get(e.id);
              return (
                <Fragment key={e.id}>
                  <EmployeeCell e={e} privacy={privacy} warnings={empWarn} anyDragging={!!dragId} onOpen={() => onOpenEmployee(e.id)} />
                  {DAYS.map((d) => {
                    const key = `${e.id}:${d}`;
                    const fullBlock = e.unavailable.find((b) => b.day === d && b.end - b.start >= 1440);
                    const partial = e.unavailable.filter((b) => b.day === d && b.end - b.start < 1440);
                    const isDragDay = dragShift?.day === d && dragShift.employeeId !== e.id;
                    const ok = isDragDay && conflicts && conflicts.length === 0;
                    const bad = isDragDay && conflicts && conflicts.length > 0;
                    return (
                      <div
                        key={key}
                        {...dropHandlers(key, e.id, d)}
                        className={cx(
                          'relative min-h-[64px] space-y-1 border-b border-r border-stone-100 p-1.5 transition-colors',
                          fullBlock && 'bg-[repeating-linear-gradient(135deg,#f5f5f4_0,#f5f5f4_6px,#fafaf9_6px,#fafaf9_12px)]',
                          dragShift && dragShift.day !== d && 'opacity-40',
                          ok && 'bg-emerald-50',
                          bad && 'bg-red-50/70',
                          overCell === key && ok && 'ring-2 ring-inset ring-emerald-400',
                          overCell === key && bad && 'ring-2 ring-inset ring-red-400',
                        )}
                      >
                        {fullBlock && !cells.get(key) && !isDragDay && (
                          <div className="flex h-full min-h-[48px] flex-col items-center justify-center text-center text-[10px] font-medium text-stone-400">
                            <span>Unavailable</span>
                            <span className="font-normal">{BLOCK_REASON[fullBlock.reason].label}</span>
                          </div>
                        )}
                        {renderChips(cells.get(key))}
                        {isDragDay && conflicts && (
                          <div className={cx('rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight', ok ? 'text-emerald-700' : 'text-red-700')}>
                            {ok ? `✓ Available · ${fmtHours(h + shiftHours(dragShift!))} total` : conflicts[0]}
                          </div>
                        )}
                        {!isDragDay && partial.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {partial.map((b) => (
                              <span key={b.id} title={b.note} className={cx('rounded border px-1 text-[9px] font-medium', BLOCK_REASON[b.reason].cls)}>
                                ✕ {fmtRange(b.start, b.end)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <HoursCell e={e} hours={h} />
                </Fragment>
              );
            })}
          </Fragment>
        ))}
        {employees.length === 0 && (
          <div className="col-span-full px-4 py-16 text-center text-sm text-stone-500">No employees match the current filters.</div>
        )}
      </div>
    </div>
  );
}

function EmployeeCell({ e, privacy, warnings, anyDragging, onOpen }: { e: Employee; privacy: boolean; warnings: ScheduleWarning[]; anyDragging: boolean; onOpen: () => void }) {
  const tags = employeeTags(e);
  const hard = warnings.some((w) => w.severity === 'hard');
  return (
    <Hover
      disabled={anyDragging}
      className="sticky left-0 z-10 border-b border-r border-stone-200 bg-white"
      content={
        <div className="space-y-2">
          <ConstraintSummary e={e} privacy={privacy} />
          {warnings.length > 0 && (
            <div className="space-y-1 border-t border-stone-100 pt-2">
              {warnings.map((w, i) => (
                <div key={i} className={cx('flex items-start gap-1.5', w.severity === 'hard' ? 'text-red-700' : 'text-amber-700')}>
                  {w.severity === 'hard' ? <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
                  {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      }
      width={320}
      side="right"
    >
      <button onClick={onOpen} className="group flex h-full w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-stone-50">
        <Avatar name={e.name} role={e.role} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium text-slate-800">{e.name}</span>
            {warnings.length > 0 && (hard ? <CircleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />)}
            <PencilLine className="ml-auto h-3.5 w-3.5 shrink-0 text-stone-300 opacity-0 transition group-hover:opacity-100" />
          </div>
          <div className="text-[11px] text-stone-500">{e.role}</div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {tags.slice(0, 2).map((t) => (
                <TagPill key={t.label} tag={t} small />
              ))}
              {tags.length > 2 && <span className="px-1 text-[10px] text-stone-400">+{tags.length - 2}</span>}
            </div>
          )}
        </div>
      </button>
    </Hover>
  );
}

function HoursCell({ e, hours }: { e: Employee; hours: number }) {
  const pct = Math.min(1, hours / Math.max(e.targetHours, 1));
  const tone = hours > OVERTIME_HOURS || hours > e.maxHours ? 'red' : hours > e.targetHours + 4 ? 'amber' : hours >= e.targetHours - 4 ? 'emerald' : 'slate';
  const bar = { red: 'bg-red-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400', slate: 'bg-slate-300' }[tone];
  const text = { red: 'text-red-600', amber: 'text-amber-700', emerald: 'text-emerald-700', slate: 'text-slate-500' }[tone];
  return (
    <div className="flex flex-col justify-center border-b border-stone-100 px-3 py-2">
      <div className="flex items-baseline gap-1">
        <span className={cx('text-sm font-semibold', text)}>{fmtHours(hours)}</span>
        <span className="text-[11px] text-stone-400">/ {e.targetHours}h</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className={cx('h-full rounded-full', bar)} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-stone-400">{fmtMoney(hours * e.hourlyRate)}</div>
    </div>
  );
}
