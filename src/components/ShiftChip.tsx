import { AlertTriangle, CircleAlert, GripVertical, Moon, Pin, Sun, Sunrise, Sunset } from 'lucide-react';
import type { DragEvent } from 'react';
import { shiftHours } from '../lib/constraints';
import { KIND_STYLE, ROLE_STYLE } from '../lib/meta';
import { DAY_NAMES, fmtHours, fmtRange } from '../lib/time';
import type { Employee, ScheduleWarning, Shift, ShiftKind, ShiftTemplate } from '../types';
import { cx } from './common';
import { Hover } from './Hover';

export const KIND_ICON: Record<ShiftKind, typeof Sun> = { morning: Sunrise, mid: Sun, evening: Sunset, closing: Moon };

interface Props {
  shift: Shift;
  template?: ShiftTemplate;
  employee?: Employee;
  warnings: ScheduleWarning[];
  dragging: boolean;
  anyDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClick: (id: string) => void;
}

export function ShiftChip({ shift, template, employee, warnings, dragging, anyDragging, onDragStart, onDragEnd, onClick }: Props) {
  const kind = template?.kind ?? 'mid';
  const Icon = KIND_ICON[kind];
  const open = !shift.employeeId;
  const hard = warnings.filter((w) => w.severity === 'hard');
  const soft = warnings.filter((w) => w.severity === 'soft');
  const crossRole = employee && employee.role !== shift.role;

  const handleDragStart = (ev: DragEvent) => {
    ev.dataTransfer.setData('text/plain', shift.id);
    ev.dataTransfer.effectAllowed = 'move';
    onDragStart(shift.id);
  };

  const card = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">
          {template?.name ?? 'Shift'} · {shift.role}
        </span>
        <span className={cx('rounded-full px-1.5 py-px text-[10px] font-medium', KIND_STYLE[kind].badge)}>{KIND_STYLE[kind].label}</span>
      </div>
      <div className="text-slate-600">
        {DAY_NAMES[shift.day]} · {fmtRange(shift.start, shift.end, false)} · {fmtHours(shiftHours(shift))}
      </div>
      {employee && <div className="text-slate-600">Assigned to <b>{employee.name}</b>{crossRole && ` (cross-trained from ${employee.role})`}</div>}
      {shift.pinned && <div className="flex items-center gap-1 text-slate-500"><Pin className="h-3 w-3" /> Pinned — kept when regenerating</div>}
      {open && (
        <div className="rounded-lg bg-red-50 p-2 text-red-800">
          <div className="font-semibold">{shift.unassignedReason ?? 'Unassigned'}</div>
          {shift.unassignedDetails?.slice(0, 4).map((d) => (
            <div key={d} className="mt-0.5 text-[11px] text-red-700/80">{d}</div>
          ))}
          <div className="mt-1 text-[11px] text-red-700/70">Drag onto an employee or click to see candidates.</div>
        </div>
      )}
      {[...hard, ...soft].map((w, i) => (
        <div key={i} className={cx('flex items-start gap-1.5 rounded-lg p-1.5', w.severity === 'hard' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          {w.severity === 'hard' ? <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
          {w.message}
        </div>
      ))}
    </div>
  );

  return (
    <Hover content={card} disabled={anyDragging} width={280}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={() => onClick(shift.id)}
        className={cx(
          'group relative flex cursor-grab select-none items-stretch overflow-hidden rounded-lg border text-[11px] leading-tight shadow-sm transition active:cursor-grabbing',
          open ? 'border-dashed border-red-300 bg-white text-red-800 hover:bg-red-50' : ROLE_STYLE[shift.role].chip,
          !open && 'hover:-translate-y-px hover:shadow-md',
          hard.length > 0 && 'ring-2 ring-red-400',
          hard.length === 0 && soft.length > 0 && 'ring-1 ring-amber-400',
          dragging && 'opacity-40',
        )}
      >
        <span className={cx('w-1 shrink-0', KIND_STYLE[kind].bar)} />
        <div className="min-w-0 flex-1 px-1.5 py-1">
          <div className="flex items-center gap-1 font-semibold">
            <Icon className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{fmtRange(shift.start, shift.end)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] opacity-80">
            {open ? (
              <span className="truncate font-medium">{shift.role} · {shift.unassignedReason?.replace(/^(Unassigned|Conflict): /, '') ?? 'Open'}</span>
            ) : (
              <>
                <span className="truncate">{template?.name}</span>
                {crossRole && <span className={cx('rounded px-1 font-semibold', ROLE_STYLE[shift.role].soft)}>{ROLE_STYLE[shift.role].short}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 pr-1">
          {shift.pinned && <Pin className="h-3 w-3 text-slate-500" />}
          {hard.length > 0 && <CircleAlert className="h-3 w-3 text-red-500" />}
          {hard.length === 0 && soft.length > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          {!shift.pinned && warnings.length === 0 && <GripVertical className="h-3 w-3 opacity-0 transition group-hover:opacity-40" />}
        </div>
      </div>
    </Hover>
  );
}
