import { Clock, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { employeeTags, type Tag } from '../lib/constraints';
import { BLOCK_REASON, RESTRICTION_LABEL, ROLE_STYLE } from '../lib/meta';
import { DAY_SHORT, fmtRange } from '../lib/time';
import type { Employee, Role } from '../types';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Avatar({ name, role, size = 'md' }: { name: string; role: Role; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const s = ROLE_STYLE[role];
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';
  return <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold', s.soft, s.text, dims)}>{initials}</div>;
}

export function TagPill({ tag, small }: { tag: Tag; small?: boolean }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full font-medium', tag.cls, small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]')}>
      {tag.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const s = ROLE_STYLE[role];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', s.chip)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {role}
    </span>
  );
}

/** Compact read-out of an employee's constraints, used in hover cards. */
export function ConstraintSummary({ e, privacy }: { e: Employee; privacy: boolean }) {
  const tags = employeeTags(e);
  const byDay = [...e.unavailable].sort((a, b) => a.day - b.day || a.start - b.start);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={e.name} role={e.role} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{e.name}</div>
          <div className="text-[11px] text-slate-500">
            {e.role}
            {e.secondaryRoles.length > 0 && ` · also ${e.secondaryRoles.join(', ')}`}
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <TagPill key={t.label} tag={t} small />
          ))}
        </div>
      )}
      <Row icon={<Clock className="h-3.5 w-3.5" />}>
        Target {e.targetHours}h · Max {e.maxHours}h{e.maxShiftHours ? ` · ≤${e.maxShiftHours}h/shift` : ''} · ${e.hourlyRate.toFixed(2)}/h
      </Row>
      <Row icon={<ShieldCheck className="h-3.5 w-3.5" />}>{RESTRICTION_LABEL[e.restriction]}</Row>
      {byDay.length > 0 && (
        <ul className="space-y-1">
          {byDay.map((b) => (
            <li key={b.id} className="flex items-center gap-1.5">
              <span className="w-8 font-semibold text-slate-500">{DAY_SHORT[b.day]}</span>
              <span className={cx('rounded border px-1.5 py-px text-[10px] font-medium', BLOCK_REASON[b.reason].cls)}>{BLOCK_REASON[b.reason].label}</span>
              <span className="text-slate-600">{b.end - b.start >= 1440 ? 'All day' : fmtRange(b.start, b.end)}</span>
              {b.note && <span className="truncate text-slate-400">· {b.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {e.personalNotes && (
        <div className="rounded-lg bg-stone-50 p-2">
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            <Lock className="h-3 w-3" /> Personal context
          </div>
          {privacy ? <div className="italic text-stone-400">Hidden — privacy mode is on</div> : <div className="leading-snug text-stone-700">{e.personalNotes}</div>}
        </div>
      )}
    </div>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-600">
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onEscape();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onEscape]);
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div
        className={cx('animate-pop w-full rounded-2xl bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-md')}
        onMouseDown={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export const btn = {
  primary: 'inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50',
  secondary: 'inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-stone-50',
  ghost: 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-stone-100',
  danger: 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50',
};

export const input =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
