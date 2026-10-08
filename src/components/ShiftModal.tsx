import { AlertTriangle, CircleAlert, Pin, PinOff, Trash2, UserMinus, X } from 'lucide-react';
import { shiftHours } from '../lib/constraints';
import { KIND_STYLE, ROLE_STYLE } from '../lib/meta';
import { rankCandidates } from '../lib/scheduler';
import { DAY_NAMES, fmtHours, fmtMoney, fmtRange } from '../lib/time';
import type { Employee, ScheduleWarning, Shift, ShiftTemplate } from '../types';
import { Avatar, Modal, btn, cx } from './common';
import { KIND_ICON } from './ShiftChip';

interface Props {
  shift: Shift;
  template?: ShiftTemplate;
  employees: Employee[];
  shifts: Shift[];
  warnings: ScheduleWarning[];
  onAssign: (shiftId: string, employeeId: string | null, override?: boolean) => void;
  onTogglePin: (shiftId: string) => void;
  onDelete: (shiftId: string) => void;
  onClose: () => void;
}

export function ShiftModal({ shift, template, employees, shifts, warnings, onAssign, onTogglePin, onDelete, onClose }: Props) {
  const kind = template?.kind ?? 'mid';
  const Icon = KIND_ICON[kind];
  const assigned = employees.find((e) => e.id === shift.employeeId);
  const ranked = rankCandidates(employees, shift, shifts).filter((c) => c.employee.id !== shift.employeeId);
  const eligible = ranked.filter((c) => !c.conflicts.length);
  const blocked = ranked.filter((c) => c.conflicts.length);
  const len = shiftHours(shift);

  return (
    <Modal onClose={onClose}>
      <div className={cx('flex items-start gap-3 rounded-t-2xl border-b px-5 py-4', ROLE_STYLE[shift.role].chip)}>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/70"><Icon className="h-5 w-5" /></div>
        <div className="flex-1">
          <div className="text-base font-semibold">{template?.name ?? 'Shift'} · {shift.role}</div>
          <div className="text-xs opacity-80">{DAY_NAMES[shift.day]} · {fmtRange(shift.start, shift.end, false)} · {fmtHours(len)}</div>
        </div>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', KIND_STYLE[kind].badge)}>{KIND_STYLE[kind].label}</span>
        <button onClick={onClose} className="rounded-lg p-1 opacity-60 hover:bg-white/60 hover:opacity-100" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
        {assigned ? (
          <div className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
            <Avatar name={assigned.name} role={assigned.role} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800">{assigned.name}</div>
              <div className="text-xs text-stone-500">{assigned.role} · {fmtMoney(len * assigned.hourlyRate)} for this shift</div>
            </div>
            <button className={btn.ghost} onClick={() => onAssign(shift.id, null)}><UserMinus className="h-4 w-4" /> Unassign</button>
          </div>
        ) : (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <div className="font-semibold">{shift.unassignedReason ?? 'Open shift'}</div>
            {shift.unassignedDetails?.map((d) => <div key={d} className="mt-0.5 text-xs text-red-700/80">{d}</div>)}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className={cx('flex items-start gap-2 rounded-lg p-2 text-xs', w.severity === 'hard' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
                {w.severity === 'hard' ? <CircleAlert className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                {w.message}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-800">{assigned ? 'Reassign to' : 'Best candidates'}</h3>
            <span className="text-[11px] text-stone-400">ranked by fairness & fit</span>
          </div>
          {eligible.length === 0 && <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">Nobody is fully available for this shift.</div>}
          <ul className="space-y-1">
            {eligible.slice(0, 8).map(({ employee: e, hours }) => (
              <li key={e.id}>
                <button onClick={() => onAssign(shift.id, e.id)} className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-emerald-200 hover:bg-emerald-50">
                  <Avatar name={e.name} role={e.role} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{e.name}</div>
                    <div className="text-[11px] text-stone-500">{e.role !== shift.role ? `Cross-trained · ${e.role}` : e.role}</div>
                  </div>
                  <div className="text-right text-[11px]">
                    <div className={cx('font-semibold', hours + len > e.targetHours ? 'text-amber-600' : 'text-emerald-700')}>{fmtHours(hours)} → {fmtHours(hours + len)}</div>
                    <div className="text-stone-400">target {e.targetHours}h</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {blocked.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-700">Unavailable staff ({blocked.length}) — override if you must</summary>
            <ul className="mt-2 space-y-1">
              {blocked.map(({ employee: e, conflicts }) => (
                <li key={e.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-stone-50">
                  <Avatar name={e.name} role={e.role} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-600">{e.name}</div>
                    <div className="truncate text-[11px] text-red-600">{conflicts.join(' · ')}</div>
                  </div>
                  <button className="rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50" onClick={() => onAssign(shift.id, e.id, true)}>Override</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3">
        <button className={btn.danger} onClick={() => onDelete(shift.id)}><Trash2 className="h-4 w-4" /> Delete shift</button>
        <button className={cx(btn.secondary, 'ml-auto')} onClick={() => onTogglePin(shift.id)}>
          {shift.pinned ? <><PinOff className="h-4 w-4" /> Unpin</> : <><Pin className="h-4 w-4" /> Pin shift</>}
        </button>
      </div>
    </Modal>
  );
}

export function OverrideDialog({ employee, shift, conflicts, onConfirm, onCancel }: { employee: Employee; shift: Shift; conflicts: string[]; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"><CircleAlert className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Assign despite constraint conflict?</h2>
            <p className="mt-1 text-sm text-stone-600">
              {employee.name} has a hard constraint for {DAY_NAMES[shift.day]} {fmtRange(shift.start, shift.end, false)} ({shift.role}):
            </p>
            <ul className="mt-2 space-y-1">
              {conflicts.map((c) => <li key={c} className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{c}</li>)}
            </ul>
            <p className="mt-3 text-xs text-stone-500">The shift will be flagged on the board until resolved. Make sure you've confirmed with {employee.name.split(' ')[0]} first.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btn.secondary} onClick={onCancel}>Cancel</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700" onClick={onConfirm}>Assign anyway</button>
        </div>
      </div>
    </Modal>
  );
}
