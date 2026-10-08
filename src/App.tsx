import { BarChart3, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Filter, Layers, RotateCcw, Search, Settings2, Sparkles, Undo2, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dashboard } from './components/Dashboard';
import { EmployeeModal } from './components/EmployeeModal';
import { ScheduleBoard } from './components/ScheduleBoard';
import { SettingsDrawer } from './components/SettingsDrawer';
import { OverrideDialog, ShiftModal } from './components/ShiftModal';
import { WeeklyReport } from './components/WeeklyReport';
import { demoSchedules } from './data/demo';
import { btn, cx } from './components/common';
import { RESTAURANT_NAME, SEED_EMPLOYEES, SEED_REQUIREMENTS, SEED_TEMPLATES } from './data/seed';
import { computeWarnings, hardConflicts } from './lib/constraints';
import { KIND_STYLE, ROLE_AREA, ROLE_STYLE } from './lib/meta';
import { generateSchedule, newId, refreshUnassignedReasons } from './lib/scheduler';
import { addDays, fmtWeek, weekKey, weekStart } from './lib/time';
import type { Employee, Requirements, Role, Shift, ShiftTemplate } from './types';
import { ROLES } from './types';

const STORAGE_KEY = 'shiftwise:v2';
const LEGACY_KEY = 'shiftwise:v1';
const NO_SHIFTS: Shift[] = [];

interface Persisted {
  employees: Employee[];
  templates: ShiftTemplate[];
  requirements: Requirements;
  /** One schedule per week, keyed by the week's Monday (YYYY-MM-DD). */
  schedules: Record<string, Shift[]>;
}

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
    // v1 stored a single schedule; it becomes this week's.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const { shifts, ...rest } = JSON.parse(legacy) as Omit<Persisted, 'schedules'> & { shifts: Shift[] };
      return { ...rest, schedules: { [weekKey(weekStart(new Date()))]: shifts } };
    }
  } catch {
    /* storage unavailable or corrupt — fall back to demo data */
  }
  return {
    employees: SEED_EMPLOYEES,
    templates: SEED_TEMPLATES,
    requirements: SEED_REQUIREMENTS,
    schedules: demoSchedules(weekStart(new Date())),
  };
}

const roleOrder = (r: Role) => ROLES.indexOf(r);

export default function App() {
  const initial = useMemo(loadState, []);
  const [employees, setEmployees] = useState(initial.employees);
  const [templates, setTemplates] = useState(initial.templates);
  const [requirements, setRequirements] = useState(initial.requirements);
  const [schedules, setSchedules] = useState(initial.schedules);
  const [history, setHistory] = useState<Shift[][]>([]);

  const [view, setView] = useState<'schedule' | 'reports'>('schedule');
  const [week, setWeek] = useState(() => weekStart(new Date()));
  const key = weekKey(week);
  const shifts = schedules[key] ?? NO_SHIFTS;
  const hasSchedule = key in schedules;
  const setShiftsRaw = (next: Shift[]) => setSchedules((all) => ({ ...all, [key]: next }));
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role[]>([]);
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [groupByArea, setGroupByArea] = useState(true);
  const [privacy, setPrivacy] = useState(false);

  const [editing, setEditing] = useState<{ employee: Employee; isNew: boolean } | null>(null);
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState<{ shiftId: string; employeeId: string; conflicts: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ employees, templates, requirements, schedules } satisfies Persisted));
    } catch {
      /* ignore quota / private mode */
    }
  }, [employees, templates, requirements, schedules]);

  // Undo history and open dialogs belong to the week being viewed.
  useEffect(() => {
    setHistory([]);
    setOpenShiftId(null);
  }, [key]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const setShifts = (next: Shift[], emps = employees) => {
    setHistory((h) => [...h.slice(-29), shifts]);
    setShiftsRaw(refreshUnassignedReasons(emps, next));
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setShiftsRaw(prev);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const warnings = useMemo(() => computeWarnings(employees, shifts), [employees, shifts]);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const warned = new Set(warnings.map((w) => w.employeeId));
    return employees
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || e.personalNotes.toLowerCase().includes(q))
      .filter((e) => !roleFilter.length || roleFilter.includes(e.role) || e.secondaryRoles.some((r) => roleFilter.includes(r)))
      .filter((e) => !warningsOnly || warned.has(e.id))
      .sort((a, b) => (ROLE_AREA[a.role] === ROLE_AREA[b.role] ? 0 : ROLE_AREA[a.role] === 'Front of House' ? -1 : 1) || roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name));
  }, [employees, search, roleFilter, warningsOnly, warnings]);

  const generate = (emps = employees, tpls = templates, reqs = requirements) => {
    const next = generateSchedule(emps, tpls, reqs, shifts);
    setHistory((h) => [...h.slice(-29), shifts]);
    setShiftsRaw(next);
    const open = next.filter((s) => !s.employeeId).length;
    setToast(`Generated ${next.length} shifts for ${fmtWeek(week)} · ${open ? `${open} could not be filled` : 'all covered'}`);
  };

  const prevKey = weekKey(addDays(week, -7));
  const copyPreviousWeek = () => {
    const prev = schedules[prevKey];
    if (!prev) return;
    setShifts(prev.map((s) => ({ ...s, id: newId('sh'), override: false })));
    setToast(`Copied ${prev.length} shifts from ${fmtWeek(addDays(week, -7))}`);
  };

  const applyAssign = (shiftId: string, employeeId: string | null, override = false) => {
    setShifts(shifts.map((s) => (s.id === shiftId ? { ...s, employeeId, override: employeeId ? override : false } : s)));
  };

  const requestAssign = (shiftId: string, employeeId: string | null, override = false) => {
    const shift = shifts.find((s) => s.id === shiftId);
    const emp = employees.find((e) => e.id === employeeId);
    if (shift && emp && !override) {
      const conflicts = hardConflicts(emp, shift, shifts);
      if (conflicts.length) {
        setPending({ shiftId, employeeId: emp.id, conflicts });
        return;
      }
    }
    applyAssign(shiftId, employeeId, override);
  };

  const saveEmployee = (e: Employee) => {
    const exists = employees.some((x) => x.id === e.id);
    const emps = exists ? employees.map((x) => (x.id === e.id ? e : x)) : [...employees, e];
    setEmployees(emps);
    setEditing(null);
    setShiftsRaw(refreshUnassignedReasons(emps, shifts));
    const clashes = shifts.filter((s) => s.employeeId === e.id && hardConflicts(e, s, shifts).length).length;
    setToast(clashes ? `${e.name} saved — ${clashes} existing shift${clashes > 1 ? 's' : ''} now conflict. Regenerate or reassign.` : `${e.name} ${exists ? 'updated' : 'added to the team'}`);
  };

  const deleteEmployee = (id: string) => {
    const emps = employees.filter((e) => e.id !== id);
    setEmployees(emps);
    setEditing(null);
    // Past weeks keep their history; this week and later weeks get the shifts reopened.
    setHistory([]);
    setSchedules((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, list]) => [
          k,
          k < key ? list : refreshUnassignedReasons(emps, list.map((s) => (s.employeeId === id ? { ...s, employeeId: null, pinned: false } : s))),
        ]),
      ),
    );
  };

  const resetDemo = () => {
    if (!confirm('Reset to the demo restaurant? This replaces your team, templates and schedule.')) return;
    setEmployees(SEED_EMPLOYEES);
    setTemplates(SEED_TEMPLATES);
    setRequirements(SEED_REQUIREMENTS);
    setHistory([]);
    setWeek(weekStart(new Date()));
    setSchedules(demoSchedules(weekStart(new Date())));
    setToast('Demo data restored');
  };

  const openShift = shifts.find((s) => s.id === openShiftId);
  const pendingShift = pending && shifts.find((s) => s.id === pending.shiftId);
  const pendingEmp = pending && employees.find((e) => e.id === pending.employeeId);

  return (
    <div className="min-h-screen">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b print:hidden border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900">ShiftWise</div>
              <div className="text-[11px] text-stone-500">{RESTAURANT_NAME} · {employees.length} staff</div>
            </div>
          </div>

          <div className="ml-2 flex items-center rounded-xl border border-stone-200 bg-white shadow-sm">
            <button className="rounded-l-xl p-2 text-stone-500 hover:bg-stone-50" onClick={() => setWeek((w) => addDays(w, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
            <button className="px-2 text-sm font-medium text-slate-700" onClick={() => setWeek(weekStart(new Date()))} title="Jump to this week">
              {fmtWeek(week)}
            </button>
            <button className="rounded-r-xl p-2 text-stone-500 hover:bg-stone-50" onClick={() => setWeek((w) => addDays(w, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="flex rounded-xl bg-stone-100 p-0.5 print:hidden" role="tablist">
            {(
              [
                ['schedule', 'Schedule', CalendarDays],
                ['reports', 'Reports', BarChart3],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition', view === id ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className={cx('ml-auto flex flex-wrap items-center gap-2', view !== 'schedule' && 'hidden')}>
            <button className={btn.ghost} onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Undo</span>
            </button>
            <button className={btn.secondary} onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Shifts & Staffing</span>
            </button>
            <button className={btn.secondary} onClick={() => setEditing({ isNew: true, employee: blankEmployee() })}>
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Add employee</span>
            </button>
            <button className={cx(btn.primary, 'bg-gradient-to-r from-emerald-600 to-teal-600 px-4')} onClick={() => generate()}>
              <Sparkles className="h-4 w-4" /> Generate schedule
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] space-y-4 px-4 py-5 sm:px-6 print:p-0">
        {view === 'reports' && (
          <WeeklyReport week={week} employees={employees} schedules={schedules} onSelectWeek={setWeek} onOpenSchedule={() => setView('schedule')} />
        )}

        {view === 'schedule' && !hasSchedule && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <CalendarPlus className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-3 text-lg font-semibold text-slate-800">No schedule yet for {fmtWeek(week)}</h2>
            <p className="mt-1 text-sm text-stone-500">Generate one from your staffing needs, or start from last week's assignments.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className={cx(btn.primary, 'bg-gradient-to-r from-emerald-600 to-teal-600 px-4')} onClick={() => generate()}>
                <Sparkles className="h-4 w-4" /> Generate schedule
              </button>
              {schedules[prevKey] && (
                <button className={btn.secondary} onClick={copyPreviousWeek}><Copy className="h-4 w-4" /> Copy previous week</button>
              )}
            </div>
          </div>
        )}

        {view === 'schedule' && hasSchedule && (
          <>
          <Dashboard employees={employees} shifts={shifts} warnings={warnings} onShowOpen={() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff or notes…"
                className="w-56 rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-7 text-sm shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400" onClick={() => setSearch('')} aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Filter className="mx-1 h-3.5 w-3.5 text-stone-400" />
              {ROLES.map((r) => {
                const on = roleFilter.includes(r);
                return (
                  <button key={r} onClick={() => setRoleFilter(on ? roleFilter.filter((x) => x !== r) : [...roleFilter, r])}
                    className={cx('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? ROLE_STYLE[r].chip : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50')}>
                    <span className={cx('h-1.5 w-1.5 rounded-full', ROLE_STYLE[r].dot)} />
                    {r}
                  </button>
                );
              })}
              {roleFilter.length > 0 && <button className="px-1.5 text-xs text-stone-500 hover:text-stone-700" onClick={() => setRoleFilter([])}>Clear</button>}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Toggle on={warningsOnly} onClick={() => setWarningsOnly(!warningsOnly)} label="Flagged only" />
              <Toggle on={groupByArea} onClick={() => setGroupByArea(!groupByArea)} label="FOH / BOH" icon={<Layers className="h-3.5 w-3.5" />} />
              <Toggle on={privacy} onClick={() => setPrivacy(!privacy)} label="Privacy mode" icon={privacy ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} />
              <button className={cx(btn.ghost, 'text-xs')} onClick={resetDemo} title="Reset demo data"><RotateCcw className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          <div ref={boardRef} className="scroll-mt-20">
            <ScheduleBoard
              employees={visibleEmployees}
              allEmployees={employees}
              shifts={shifts}
              templates={templates}
              warnings={warnings}
              week={week}
              privacy={privacy}
              groupByArea={groupByArea}
              onAssign={(id, emp) => requestAssign(id, emp)}
              onOpenShift={setOpenShiftId}
              onOpenEmployee={(id) => {
                const e = employees.find((x) => x.id === id);
                if (e) setEditing({ employee: e, isNew: false });
              }}
            />
          </div>

          <Legend templates={templates} />
          </>
        )}
      </main>

      {editing && (
        <EmployeeModal
          key={editing.employee.id}
          employee={editing.employee}
          isNew={editing.isNew}
          templates={templates}
          privacy={privacy}
          onSave={saveEmployee}
          onDelete={deleteEmployee}
          onClose={() => setEditing(null)}
        />
      )}

      {openShift && (
        <ShiftModal
          shift={openShift}
          template={templates.find((t) => t.id === openShift.templateId)}
          employees={employees}
          shifts={shifts}
          warnings={warnings.filter((w) => w.shiftIds.includes(openShift.id))}
          onAssign={(id, emp, override) => {
            requestAssign(id, emp, override);
            setOpenShiftId(null);
          }}
          onTogglePin={(id) => setShifts(shifts.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)))}
          onDelete={(id) => {
            setShifts(shifts.filter((s) => s.id !== id));
            setOpenShiftId(null);
          }}
          onClose={() => setOpenShiftId(null)}
        />
      )}

      {pending && pendingShift && pendingEmp && (
        <OverrideDialog
          employee={pendingEmp}
          shift={pendingShift}
          conflicts={pending.conflicts}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            applyAssign(pending.shiftId, pending.employeeId, true);
            setPending(null);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsDrawer
          templates={templates}
          requirements={requirements}
          onClose={() => setSettingsOpen(false)}
          onChange={(tpls, reqs) => {
            setTemplates(tpls);
            setRequirements(reqs);
            setSettingsOpen(false);
            generate(employees, tpls, reqs);
          }}
        />
      )}

      {toast && (
        <div className="animate-pop fixed bottom-5 print:hidden left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon?: ReactNode }) {
  return (
    <button onClick={onClick}
      className={cx('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition', on ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50')}>
      {icon}
      {label}
    </button>
  );
}

function Legend({ templates }: { templates: ShiftTemplate[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[11px] text-stone-500">
      <span className="font-semibold uppercase tracking-wider text-stone-400">Legend</span>
      {templates.map((t) => (
        <span key={t.id} className="flex items-center gap-1.5"><span className={cx('h-3 w-1 rounded-full', KIND_STYLE[t.kind].bar)} />{t.name}</span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-red-300" /> Open shift</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded ring-1 ring-amber-400" /> Soft warning (overtime, double, clopen)</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded ring-2 ring-red-400" /> Constraint override</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-[repeating-linear-gradient(135deg,#e7e5e4_0,#e7e5e4_3px,#fafaf9_3px,#fafaf9_6px)]" /> Unavailable all day</span>
      <span className="ml-auto">Drag shifts between people on the same day · Hover anyone for constraints · Ctrl+Z to undo</span>
    </div>
  );
}

function blankEmployee(): Employee {
  return {
    id: newId('emp'),
    name: '',
    role: 'Server',
    secondaryRoles: [],
    hourlyRate: 15,
    targetHours: 30,
    maxHours: 40,
    restriction: 'none',
    unavailable: [],
    situations: [],
    personalNotes: '',
    customTags: [],
    hireDate: new Date().toISOString().slice(0, 10),
  };
}
