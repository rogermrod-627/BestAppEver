import { Baby, Briefcase, CalendarClock, GraduationCap, HeartPulse, Lock, Plus, Sparkles, Stethoscope, Trash2, User, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { employeeTags } from '../lib/constraints';
import { BLOCK_REASON, RESTRICTION_HELP, RESTRICTION_LABEL, ROLE_STYLE, SITUATION } from '../lib/meta';
import { DAY_SHORT, fmtRange, fromInput, toInput } from '../lib/time';
import { newId } from '../lib/scheduler';
import type { BlockReason, Day, Employee, ShiftRestriction, ShiftTemplate, Situation, UnavailableBlock } from '../types';
import { DAYS, ROLES } from '../types';
import { Avatar, Modal, TagPill, btn, cx, input } from './common';
import { KIND_ICON } from './ShiftChip';

type Tab = 'profile' | 'availability' | 'context';

interface Props {
  employee: Employee;
  isNew: boolean;
  templates: ShiftTemplate[];
  privacy: boolean;
  onSave: (e: Employee) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const SITUATION_ICON: Record<Situation, typeof User> = {
  student: GraduationCap,
  parent: Baby,
  pregnancy: HeartPulse,
  'second-job': Briefcase,
  minor: UserRound,
  medical: Stethoscope,
};

const SITUATION_HINT: Record<Situation, string> = {
  student: 'Add class times as unavailable blocks so the generator works around them.',
  parent: 'Record pickup/drop-off windows or no-closing days as childcare blocks.',
  pregnancy: 'Common accommodation: cap single shifts at 6 hours, avoid late closes.',
  'second-job': 'Block out the hours of the other job.',
  minor: 'Minors typically: off by 10 PM and ≤18 hrs on school weeks.',
  medical: 'Record recurring appointments. Keep details minimal.',
};

const PRESETS: { label: string; start: string; end: string; reason: BlockReason }[] = [
  { label: 'Night class', start: '17:00', end: '22:00', reason: 'class' },
  { label: 'Day class', start: '08:00', end: '15:00', reason: 'class' },
  { label: 'School drop-off', start: '06:00', end: '09:30', reason: 'childcare' },
  { label: 'Daycare pickup', start: '15:30', end: '24:00', reason: 'childcare' },
  { label: 'Full day off', start: '00:00', end: '24:00', reason: 'personal' },
];

export function EmployeeModal({ employee, isNew, templates, privacy, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Employee>(employee);
  const [tab, setTab] = useState<Tab>('profile');
  const [revealNotes, setRevealNotes] = useState(!privacy);
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.name.trim().length > 1 && draft.maxHours >= draft.targetHours;
  const tags = employeeTags(draft);

  return (
    <Modal onClose={onClose} wide>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-stone-100 px-6 pb-4 pt-5">
        <Avatar name={draft.name || '?'} role={draft.role} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-900">{isNew ? 'New employee' : draft.name || 'Unnamed'}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.length ? tags.map((t) => <TagPill key={t.label} tag={t} />) : <span className="text-xs text-stone-400">No constraints yet — fully flexible</span>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-100 px-6">
        {(
          [
            ['profile', 'Profile & Pay', User],
            ['availability', 'Availability & Rules', CalendarClock],
            ['context', 'Personal Context', Lock],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition',
              tab === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
        {tab === 'profile' && <ProfileTab draft={draft} set={set} />}
        {tab === 'availability' && <AvailabilityTab draft={draft} set={set} templates={templates} />}
        {tab === 'context' && <ContextTab draft={draft} set={set} reveal={revealNotes} onReveal={() => setRevealNotes(true)} />}
      </div>

      <div className="flex items-center gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-3.5">
        {!isNew && (
          <button
            className={btn.danger}
            onClick={() => {
              if (confirm(`Remove ${draft.name} from the team? Their shifts become open shifts.`)) onDelete(draft.id);
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
        {!valid && <span className="text-xs text-red-600">{draft.name.trim().length < 2 ? 'Name is required.' : 'Max hours must be ≥ target hours.'}</span>}
        <div className="ml-auto flex gap-2">
          <button className={btn.secondary} onClick={onClose}>Cancel</button>
          <button className={btn.primary} disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            {isNew ? 'Add employee' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type Setter = <K extends keyof Employee>(k: K, v: Employee[K]) => void;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

function ProfileTab({ draft, set }: { draft: Employee; set: Setter }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Jamie Rivera" autoFocus />
      </Field>
      <Field label="Hire date">
        <input type="date" className={input} value={draft.hireDate ?? ''} onChange={(e) => set('hireDate', e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Primary position</span>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                set('role', r);
                set('secondaryRoles', draft.secondaryRoles.filter((x) => x !== r));
              }}
              className={cx(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                draft.role === r ? cx(ROLE_STYLE[r].chip, 'ring-2 ring-offset-1 ring-emerald-300') : 'border-stone-200 text-stone-600 hover:bg-stone-50',
              )}
            >
              <span className={cx('h-2 w-2 rounded-full', ROLE_STYLE[r].dot)} />
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Cross-trained to cover</span>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.filter((r) => r !== draft.role).map((r) => {
            const on = draft.secondaryRoles.includes(r);
            return (
              <button
                key={r}
                onClick={() => set('secondaryRoles', on ? draft.secondaryRoles.filter((x) => x !== r) : [...draft.secondaryRoles, r])}
                className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', on ? ROLE_STYLE[r].chip : 'border-dashed border-stone-300 text-stone-500 hover:bg-stone-50')}
              >
                {on ? '✓ ' : '+ '}
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Hourly rate">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">$</span>
          <input type="number" min={0} step={0.25} className={cx(input, 'pl-7')} value={draft.hourlyRate} onChange={(e) => set('hourlyRate', Number(e.target.value))} />
        </div>
      </Field>
      <div />
      <Field label={`Target weekly hours · ${draft.targetHours}h`} hint="The generator balances hours toward each person's target.">
        <input type="range" min={0} max={50} className="w-full accent-emerald-600" value={draft.targetHours} onChange={(e) => set('targetHours', Number(e.target.value))} />
      </Field>
      <Field label={`Max weekly hours · ${draft.maxHours}h`} hint="Hard cap — never scheduled beyond this.">
        <input type="range" min={0} max={60} className="w-full accent-emerald-600" value={draft.maxHours} onChange={(e) => set('maxHours', Number(e.target.value))} />
      </Field>
    </div>
  );
}

function AvailabilityTab({ draft, set, templates }: { draft: Employee; set: Setter; templates: ShiftTemplate[] }) {
  const [days, setDays] = useState<Day[]>([]);
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('22:00');
  const [reason, setReason] = useState<BlockReason>('class');
  const [note, setNote] = useState('');

  const addBlocks = () => {
    const s = fromInput(start);
    const e = end === '00:00' || end === '24:00' ? 1440 : fromInput(end);
    if (!days.length || e <= s) return;
    const added: UnavailableBlock[] = days.map((day) => ({ id: newId('blk'), day, start: s, end: e, reason, note: note.trim() || undefined }));
    set('unavailable', [...draft.unavailable, ...added]);
    setDays([]);
    setNote('');
  };

  const updateBlock = (id: string, patch: Partial<UnavailableBlock>) =>
    set('unavailable', draft.unavailable.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Shift-time restriction</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          {(['none', 'morning-only', 'evening-only', 'no-late-nights'] as ShiftRestriction[]).map((r) => (
            <button
              key={r}
              onClick={() => set('restriction', r)}
              className={cx(
                'rounded-xl border p-3 text-left transition',
                draft.restriction === r ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-stone-200 hover:bg-stone-50',
              )}
            >
              <div className="text-sm font-medium text-slate-800">{RESTRICTION_LABEL[r]}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-stone-500">{RESTRICTION_HELP[r]}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Max single-shift length (hours)" hint="Leave blank for no limit. e.g. 6 for a pregnancy accommodation.">
            <input type="number" min={1} max={14} className={input} value={draft.maxShiftHours ?? ''} placeholder="No limit"
              onChange={(e) => set('maxShiftHours', e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
          <Field label="Max days per week" hint="Leave blank for no limit.">
            <input type="number" min={1} max={7} className={input} value={draft.maxDaysPerWeek ?? ''} placeholder="No limit"
              onChange={(e) => set('maxDaysPerWeek', e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Weekly availability</h3>
        <WeekTimeline blocks={draft.unavailable} templates={templates} restriction={draft.restriction} />
      </section>

      <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Add recurring unavailability</h3>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setStart(p.start); setEnd(p.end); setReason(p.reason); }}
              className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-emerald-300 hover:text-emerald-700">
              {p.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <button key={d} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
              className={cx('h-8 w-11 rounded-lg border text-xs font-semibold transition', days.includes(d) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100')}>
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[110px_110px_150px_1fr_auto]">
          <input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" className={input} value={end === '24:00' ? '00:00' : end} onChange={(e) => setEnd(e.target.value)} />
          <select className={input} value={reason} onChange={(e) => setReason(e.target.value as BlockReason)}>
            {Object.entries(BLOCK_REASON).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input className={input} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btn.primary} onClick={addBlocks} disabled={!days.length}><Plus className="h-4 w-4" /> Add</button>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">An end time of 12:00 AM means “until close”.</p>
      </section>

      {draft.unavailable.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Blocked times ({draft.unavailable.length})</h3>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {[...draft.unavailable].sort((a, b) => a.day - b.day || a.start - b.start).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <select className="rounded-md border border-stone-200 px-1.5 py-1 text-xs" value={b.day} onChange={(e) => updateBlock(b.id, { day: Number(e.target.value) as Day })}>
                  {DAYS.map((d) => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                </select>
                <input type="time" className="rounded-md border border-stone-200 px-1.5 py-1 text-xs" value={toInput(b.start)} onChange={(e) => updateBlock(b.id, { start: fromInput(e.target.value) })} />
                <span className="text-stone-400">–</span>
                <input type="time" className="rounded-md border border-stone-200 px-1.5 py-1 text-xs" value={toInput(b.end)}
                  onChange={(e) => updateBlock(b.id, { end: e.target.value === '00:00' ? 1440 : fromInput(e.target.value) })} />
                <span className={cx('rounded border px-1.5 py-0.5 text-[10px] font-medium', BLOCK_REASON[b.reason].cls)}>{BLOCK_REASON[b.reason].label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-stone-500">{b.note}</span>
                <button onClick={() => set('unavailable', draft.unavailable.filter((x) => x.id !== b.id))} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove block">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 5 AM → 2 AM timeline per day showing blocked windows and shift templates. */
function WeekTimeline({ blocks, templates, restriction }: { blocks: UnavailableBlock[]; templates: ShiftTemplate[]; restriction: ShiftRestriction }) {
  const from = 5 * 60;
  const to = 26 * 60;
  const pct = (m: number) => `${((Math.min(Math.max(m, from), to) - from) / (to - from)) * 100}%`;
  const width = (s: number, e: number) => `${((Math.min(e, to) - Math.max(s, from)) / (to - from)) * 100}%`;
  const ticks = [6, 9, 12, 15, 18, 21, 24];
  const restricted: [number, number][] =
    restriction === 'morning-only' ? [[12 * 60, to]] : restriction === 'evening-only' ? [[from, 15 * 60]] : restriction === 'no-late-nights' ? [[22 * 60, to]] : [];

  return (
    <div className="rounded-xl border border-stone-200 p-3">
      <div className="relative ml-10 mb-1 h-4">
        {ticks.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 text-[10px] text-stone-400" style={{ left: pct(h * 60) }}>
            {h === 12 ? '12p' : h === 24 ? '12a' : h > 12 ? `${h - 12}p` : `${h}a`}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {DAYS.map((d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="w-8 text-xs font-semibold text-stone-500">{DAY_SHORT[d]}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-emerald-50">
              {restricted.map(([s, e], i) => (
                <div key={i} className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#fde68a55_0,#fde68a55_4px,transparent_4px,transparent_8px)]" style={{ left: pct(s), width: width(s, e) }} />
              ))}
              {blocks.filter((b) => b.day === d).map((b) => (
                <div key={b.id} title={`${BLOCK_REASON[b.reason].label}${b.note ? ` — ${b.note}` : ''}`}
                  className={cx('absolute inset-y-0.5 flex items-center overflow-hidden rounded border px-1 text-[9px] font-semibold', BLOCK_REASON[b.reason].cls)}
                  style={{ left: pct(b.start), width: width(b.start, b.end) }}>
                  <span className="truncate">{BLOCK_REASON[b.reason].label} {fmtRange(b.start, b.end)}</span>
                </div>
              ))}
              {ticks.map((h) => <div key={h} className="absolute inset-y-0 w-px bg-white/70" style={{ left: pct(h * 60) }} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-2 text-[10px] text-stone-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" /> Available</span>
        {restricted.length > 0 && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> Outside shift restriction</span>}
        {templates.map((t) => {
          const Icon = KIND_ICON[t.kind];
          return <span key={t.id} className="flex items-center gap-1"><Icon className="h-3 w-3" /> {t.name} {fmtRange(t.start, t.end)}</span>;
        })}
      </div>
    </div>
  );
}

function ContextTab({ draft, set, reveal, onReveal }: { draft: Employee; set: Setter; reveal: boolean; onReveal: () => void }) {
  const [tagInput, setTagInput] = useState('');
  const toggle = (s: Situation) => set('situations', draft.situations.includes(s) ? draft.situations.filter((x) => x !== s) : [...draft.situations, s]);

  const suggestions: { label: string; apply: () => void }[] = [];
  if (draft.situations.includes('pregnancy') && !draft.maxShiftHours) suggestions.push({ label: 'Cap shifts at 6 hours', apply: () => set('maxShiftHours', 6) });
  if (draft.situations.includes('pregnancy') && draft.restriction === 'none') suggestions.push({ label: 'No late nights', apply: () => set('restriction', 'no-late-nights') });
  if (draft.situations.includes('minor') && draft.restriction === 'none') suggestions.push({ label: 'Off by 10 PM', apply: () => set('restriction', 'no-late-nights') });
  if (draft.situations.includes('minor') && draft.maxHours > 18) suggestions.push({ label: 'Max 18 hrs/week', apply: () => { set('maxHours', 18); set('targetHours', Math.min(draft.targetHours, 18)); } });

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !draft.customTags.includes(v)) set('customTags', [...draft.customTags, v]);
    setTagInput('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <b>Confidential.</b> Personal context is visible to managers only and is never shown on printed or shared schedules.
          Record only what's needed to schedule fairly.
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Life situation</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SITUATION) as Situation[]).map((s) => {
            const Icon = SITUATION_ICON[s];
            const on = draft.situations.includes(s);
            return (
              <button key={s} onClick={() => toggle(s)}
                className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-left transition', on ? 'border-emerald-400 bg-emerald-50' : 'border-stone-200 hover:bg-stone-50')}>
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', on ? SITUATION[s].cls : 'bg-stone-100 text-stone-500')}><Icon className="h-4 w-4" /></span>
                <span>
                  <span className="block text-sm font-medium text-slate-800">{SITUATION[s].label}</span>
                  <span className="block text-[11px] leading-snug text-stone-500">{SITUATION_HINT[s]}</span>
                </span>
              </button>
            );
          })}
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-2.5 text-xs text-violet-900">
            <Sparkles className="h-4 w-4" /> Suggested rules:
            {suggestions.map((s) => (
              <button key={s.label} onClick={s.apply} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 font-medium hover:bg-violet-100">+ {s.label}</button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Personal context & constraints</h3>
        {reveal ? (
          <textarea rows={4} className={cx(input, 'resize-y leading-relaxed')} value={draft.personalNotes} onChange={(e) => set('personalNotes', e.target.value)}
            placeholder={'e.g. "In college — night classes Mon/Wed", "Parenting — no closing shifts on weekends", "Pregnancy accommodation — max 6 consecutive standing hours"'} />
        ) : (
          <button onClick={onReveal} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 py-6 text-sm text-stone-500 hover:bg-stone-50">
            <Lock className="h-4 w-4" /> Privacy mode is on — click to reveal notes
          </button>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Custom tags</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.customTags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              {t}
              <button onClick={() => set('customTags', draft.customTags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input className="min-w-[160px] flex-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs outline-none focus:border-emerald-400"
            placeholder="Add tag (e.g. Key Holder) and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
        </div>
        <p className="mt-2 text-[11px] text-stone-400">Tags like Student, Childcare, and Morning Only are added automatically from the situation and availability rules.</p>
      </section>
    </div>
  );
}
