import { Copy, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { KIND_STYLE, ROLE_STYLE } from '../lib/meta';
import { newId } from '../lib/scheduler';
import { DAY_SHORT, fmtHours, fromInput, hours, toInput } from '../lib/time';
import type { Requirements, Role, ShiftKind, ShiftTemplate } from '../types';
import { DAYS, ROLES } from '../types';
import { btn, cx, input, useEscape } from './common';
import { KIND_ICON } from './ShiftChip';

interface Props {
  templates: ShiftTemplate[];
  requirements: Requirements;
  onChange: (templates: ShiftTemplate[], requirements: Requirements) => void;
  onClose: () => void;
}

export function SettingsDrawer({ templates, requirements, onChange, onClose }: Props) {
  const [tpls, setTpls] = useState(templates);
  const [reqs, setReqs] = useState<Requirements>(requirements);
  const [active, setActive] = useState(templates[0]?.id ?? '');

  const updateTpl = (id: string, patch: Partial<ShiftTemplate>) => setTpls((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const setCount = (day: number, tplId: string, role: Role, n: number) =>
    setReqs((r) => {
      const next = structuredClone(r);
      next[day as keyof Requirements][tplId] = { ...(next[day as keyof Requirements][tplId] ?? {}), [role]: Math.max(0, n) };
      return next;
    });
  const copyMonday = () =>
    setReqs((r) => {
      const next = structuredClone(r);
      for (const d of DAYS.slice(1, 4)) next[d][active] = { ...(r[0][active] ?? {}) };
      return next;
    });

  const totalSlots = DAYS.reduce<number>((a, d) => a + tpls.reduce((b, t) => b + ROLES.reduce((c, r) => c + (reqs[d]?.[t.id]?.[r] ?? 0), 0), 0), 0);
  const totalHours = DAYS.reduce<number>((a, d) => a + tpls.reduce((b, t) => b + ROLES.reduce((c, r) => c + (reqs[d]?.[t.id]?.[r] ?? 0), 0) * hours(t.start, t.end), 0), 0);
  const activeTpl = tpls.find((t) => t.id === active);
  useEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside className="animate-pop flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Shift templates & staffing needs</h2>
            <p className="text-xs text-stone-500">{totalSlots} shifts/week · {fmtHours(totalHours)} of labor demand</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Shift templates</h3>
              <button
                className={btn.ghost}
                onClick={() => {
                  const t: ShiftTemplate = { id: newId('tpl'), name: 'New shift', kind: 'mid', start: 12 * 60, end: 18 * 60 };
                  setTpls((ts) => [...ts, t]);
                  setActive(t.id);
                }}
              >
                <Plus className="h-4 w-4" /> Add template
              </button>
            </div>
            <div className="space-y-2">
              {tpls.map((t) => {
                const Icon = KIND_ICON[t.kind];
                return (
                  <div key={t.id} className="grid grid-cols-[32px_1fr_110px_132px_132px_32px] items-center gap-2 rounded-xl border border-stone-200 p-2">
                    <span className={cx('grid h-8 w-8 place-items-center rounded-lg', KIND_STYLE[t.kind].badge)}><Icon className="h-4 w-4" /></span>
                    <input className={input} value={t.name} onChange={(e) => updateTpl(t.id, { name: e.target.value })} />
                    <select className={input} value={t.kind} onChange={(e) => updateTpl(t.id, { kind: e.target.value as ShiftKind })}>
                      {(Object.keys(KIND_STYLE) as ShiftKind[]).map((k) => <option key={k} value={k}>{KIND_STYLE[k].label}</option>)}
                    </select>
                    <input type="time" className={input} value={toInput(t.start)} onChange={(e) => updateTpl(t.id, { start: fromInput(e.target.value) })} />
                    <input type="time" className={input} value={toInput(t.end)}
                      onChange={(e) => {
                        const v = fromInput(e.target.value);
                        // End before start means the shift runs past midnight.
                        updateTpl(t.id, { end: v <= t.start ? v + 1440 : v });
                      }} />
                    <button
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      disabled={tpls.length === 1}
                      onClick={() => {
                        setTpls((ts) => ts.filter((x) => x.id !== t.id));
                        if (active === t.id) setActive(tpls.find((x) => x.id !== t.id)?.id ?? '');
                      }}
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Required staff per role</h3>
              <div className="flex rounded-lg bg-stone-100 p-0.5">
                {tpls.map((t) => (
                  <button key={t.id} onClick={() => setActive(t.id)}
                    className={cx('rounded-md px-3 py-1 text-xs font-medium transition', active === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            {activeTpl && (
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-xs text-stone-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Role</th>
                      {DAYS.map((d) => <th key={d} className="px-1 py-2 font-medium">{DAY_SHORT[d]}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ROLES.map((r) => (
                      <tr key={r}>
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2 text-xs font-medium text-slate-700"><span className={cx('h-2 w-2 rounded-full', ROLE_STYLE[r].dot)} />{r}</span>
                        </td>
                        {DAYS.map((d) => {
                          const n = reqs[d]?.[activeTpl.id]?.[r] ?? 0;
                          return (
                            <td key={d} className="px-1 py-1 text-center">
                              <input type="number" min={0} max={20} value={n}
                                onChange={(e) => setCount(d, activeTpl.id, r, Number(e.target.value))}
                                className={cx('h-8 w-12 rounded-md border text-center text-sm outline-none focus:border-emerald-400', n ? cx(ROLE_STYLE[r].chip, 'font-semibold') : 'border-stone-200 text-stone-400')} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className={cx(btn.ghost, 'mt-2 text-xs')} onClick={copyMonday}><Copy className="h-3.5 w-3.5" /> Copy Monday to Tue–Thu</button>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-3.5">
          <span className="mr-auto text-xs text-stone-500">Saving regenerates the schedule (pinned shifts are kept).</span>
          <button className={btn.secondary} onClick={onClose}>Cancel</button>
          <button className={btn.primary} onClick={() => onChange(tpls, reqs)}>Save & regenerate</button>
        </div>
      </aside>
    </div>
  );
}
