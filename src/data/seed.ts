import type { BlockReason, Day, Employee, Requirements, Role, ShiftRestriction, ShiftTemplate, Situation, UnavailableBlock } from '../types';

export const RESTAURANT_NAME = 'Harbor & Vine';

export const SEED_TEMPLATES: ShiftTemplate[] = [
  { id: 'morning', name: 'Morning', kind: 'morning', start: 6 * 60, end: 14 * 60 },
  { id: 'mid', name: 'Mid', kind: 'mid', start: 11 * 60, end: 19 * 60 },
  { id: 'dinner', name: 'Dinner', kind: 'evening', start: 16 * 60, end: 22 * 60 },
  { id: 'closing', name: 'Closing', kind: 'closing', start: 17 * 60, end: 24 * 60 + 30 },
];

const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;
const WEEKDAYS: Day[] = [MON, TUE, WED, THU, FRI];
const ALL_DAY: [string, string] = ['00:00', '24:00'];

const t = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

let blockSeq = 0;
function blocks(days: Day[], [from, to]: [string, string], reason: BlockReason, note?: string): UnavailableBlock[] {
  return days.map((day) => ({ id: `blk_${++blockSeq}`, day, start: t(from), end: t(to), reason, note }));
}

interface Spec {
  name: string;
  role: Role;
  also?: Role[];
  rate: number;
  target: number;
  max?: number;
  restriction?: ShiftRestriction;
  maxShift?: number;
  maxDays?: number;
  situations?: Situation[];
  unavailable?: UnavailableBlock[];
  notes?: string;
  tags?: string[];
  hired: string;
}

const specs: Spec[] = [
  // ── Servers ───────────────────────────────────────────────
  { name: 'Maya Thompson', role: 'Server', also: ['Host'], rate: 15.5, target: 30, max: 36, situations: ['student'],
    unavailable: blocks([MON, WED], ['16:30', '22:00'], 'class', 'Organic Chem lecture + lab'),
    notes: 'In college (pre-nursing) — night classes Mon/Wed. Happy to pick up weekend doubles to make up hours.', hired: '2024-08-12' },
  { name: 'Jordan Reyes', role: 'Server', also: ['Bartender'], rate: 16, target: 34, max: 40, restriction: 'evening-only', situations: ['second-job'],
    notes: 'Works a daytime office job (receptionist) Mon–Fri. Only evenings; reliable closer.', hired: '2023-03-02' },
  { name: 'Priya Patel', role: 'Server', rate: 15, target: 26, max: 30, restriction: 'morning-only', situations: ['parent'],
    unavailable: blocks([SAT, SUN], ALL_DAY, 'childcare', 'No weekend childcare available'),
    notes: 'Single parent — daycare closes at 5 PM, needs to leave by 4:15 for pickup. Weekends are with the kids.', tags: ['Brunch Pro'], hired: '2022-11-15' },
  { name: 'Ethan Brooks', role: 'Server', also: ['Busser'], rate: 14.5, target: 22, max: 26, situations: ['student'],
    unavailable: [...blocks([TUE, THU], ['08:00', '14:30'], 'class', 'Community college'), ...blocks([THU], ['17:00', '22:00'], 'class', 'Cannot work Thursday nights due to class')],
    notes: 'Full-time student. Cannot work Thursday nights due to accounting night class.', hired: '2025-01-20' },
  { name: 'Sofia Martinez', role: 'Server', also: ['Host'], rate: 15.5, target: 28, max: 32, maxShift: 6, restriction: 'no-late-nights', situations: ['pregnancy'],
    notes: 'Pregnancy accommodation (2nd trimester) — max 6 consecutive standing hours, seated break every 2 hrs, no heavy tray lifting. Due in March.', hired: '2023-06-01' },
  { name: "Liam O'Connor", role: 'Server', also: ['Bartender'], rate: 16.5, target: 38, max: 40, notes: 'Senior server, trains new hires. Prefers dinner/closing.', tags: ['Trainer'], hired: '2021-04-10' },
  { name: 'Ava Chen', role: 'Server', rate: 15, target: 26, max: 32, situations: ['student'],
    unavailable: blocks([MON, WED, FRI], ['09:00', '13:30'], 'class', 'Morning lectures'),
    notes: 'University junior. Morning lectures MWF.', hired: '2024-09-03' },
  { name: 'Noah Williams', role: 'Server', also: ['Busser'], rate: 15, target: 32, max: 40,
    unavailable: blocks([SAT], ALL_DAY, 'religious', 'Observes Sabbath'),
    notes: 'Observes Sabbath — never schedule Saturdays.', hired: '2023-10-22' },
  { name: 'Isabella Rossi', role: 'Server', also: ['Host'], rate: 16, target: 30, max: 36, restriction: 'no-late-nights', situations: ['parent'],
    unavailable: blocks([TUE, THU], ['06:00', '09:30'], 'childcare', 'School drop-off'),
    notes: 'Parent of two — school drop-off Tue/Thu, partner works nights so must be home by 10:30 PM.', hired: '2022-05-18' },
  { name: 'Marcus Johnson', role: 'Server', also: ['Bartender', 'Host'], rate: 17, target: 40, max: 40, notes: 'Head server. Wants full-time hours.', tags: ['Shift Lead'], hired: '2020-07-07' },
  { name: 'Chloe Nguyen', role: 'Server', rate: 14.5, target: 22, max: 28, restriction: 'evening-only', situations: ['student'],
    unavailable: blocks([SUN], ALL_DAY, 'personal', 'Family day'),
    notes: 'Day classes at the art institute. Sundays are family day.', hired: '2025-02-14' },
  { name: 'Gabriel Santos', role: 'Server', also: ['Busser'], rate: 15, target: 30, max: 38,
    unavailable: blocks([MON, TUE], ALL_DAY, 'second-job', 'Catering gig'),
    situations: ['second-job'], notes: 'Works catering events Mon/Tue.', hired: '2024-03-30' },

  // ── Bartenders ────────────────────────────────────────────
  { name: 'Diego Alvarez', role: 'Bartender', also: ['Server'], rate: 18, target: 38, max: 40, restriction: 'evening-only', notes: 'Bar manager. Owns cocktail menu & inventory.', tags: ['Bar Lead'], hired: '2021-09-01' },
  { name: 'Hannah Lee', role: 'Bartender', also: ['Server'], rate: 17.5, target: 30, max: 36, situations: ['second-job'],
    unavailable: blocks([MON, TUE], ['09:00', '17:00'], 'second-job', 'Barista job'),
    notes: 'Barista at a café Mon/Tue daytime.', hired: '2023-01-09' },
  { name: 'Tyler Grant', role: 'Bartender', rate: 17, target: 28, max: 32, situations: ['student'],
    unavailable: blocks([WED], ['18:00', '21:30'], 'class', 'Grad seminar'),
    notes: 'MBA student — Wednesday evening seminar.', hired: '2024-05-20' },
  { name: 'Zoe Kim', role: 'Bartender', also: ['Server'], rate: 16.5, target: 26, max: 30, situations: ['parent'],
    unavailable: blocks(WEEKDAYS, ['06:00', '09:00'], 'childcare', 'School drop-off'),
    notes: 'Mornings before 9 are school drop-off.', hired: '2023-08-14' },
  { name: 'Ruby Castillo', role: 'Bartender', also: ['Server', 'Host'], rate: 16.5, target: 28, max: 34, notes: 'Covers brunch bar on weekends.', tags: ['Brunch Pro'], hired: '2025-04-01' },

  // ── Hosts ─────────────────────────────────────────────────
  { name: 'Emma Davis', role: 'Host', also: ['Busser'], rate: 13.5, target: 15, max: 18, restriction: 'no-late-nights', situations: ['minor', 'student'],
    unavailable: blocks(WEEKDAYS, ['07:00', '15:30'], 'class', 'High school'),
    notes: 'Age 17 — minor labor rules: max 18 hrs on school weeks, off by 10 PM. Work permit on file.', hired: '2025-06-10' },
  { name: 'Olivia Brown', role: 'Host', rate: 14, target: 28, max: 34, situations: ['student'],
    unavailable: blocks([TUE, THU], ['12:00', '16:00'], 'class', 'Afternoon classes'),
    notes: 'Part-time student; afternoon classes Tue/Thu.', hired: '2024-01-22' },
  { name: 'Lucas Garcia', role: 'Host', also: ['Busser'], rate: 13.5, target: 24, max: 30, restriction: 'evening-only', situations: ['student'],
    notes: 'Day classes Mon–Fri; evenings only.', hired: '2024-10-05' },
  { name: 'Mia Wilson', role: 'Host', also: ['Server'], rate: 14, target: 28, max: 34, situations: ['parent'],
    unavailable: blocks([WED], ALL_DAY, 'childcare', 'Custody day'),
    notes: 'Shared custody — Wednesdays with her son, no exceptions.', hired: '2022-12-01' },

  // ── Bussers ───────────────────────────────────────────────
  { name: 'Mateo Hernandez', role: 'Busser', also: ['Dishwasher'], rate: 12.5, target: 34, max: 40, notes: 'Wants max hours; reliable.', hired: '2023-02-11' },
  { name: 'Jayden Smith', role: 'Busser', also: ['Host'], rate: 12.5, target: 16, max: 18, restriction: 'no-late-nights', situations: ['minor', 'student'],
    unavailable: blocks(WEEKDAYS, ['07:00', '15:30'], 'class', 'High school'),
    notes: 'Age 16 — minor: off by 10 PM, max 18 hrs on school weeks.', hired: '2025-06-15' },
  { name: 'Aaliyah Jackson', role: 'Busser', also: ['Server'], rate: 13, target: 28, max: 32, restriction: 'evening-only', situations: ['second-job'],
    notes: 'Works mornings at a daycare center.', hired: '2024-04-18' },
  { name: 'Ben Carter', role: 'Busser', also: ['Dishwasher'], rate: 12.5, target: 26, max: 30, situations: ['student'],
    unavailable: blocks([MON, WED], ['18:00', '21:00'], 'class', 'Night class'),
    notes: 'Night classes Mon/Wed.', hired: '2025-03-03' },

  // ── Line Cooks ────────────────────────────────────────────
  { name: 'Carlos Mendoza', role: 'Line Cook', also: ['Prep Cook'], rate: 21, target: 40, max: 40, notes: 'Sous chef / kitchen lead. Needs at least one closing per weekend.', tags: ['Kitchen Lead'], hired: '2019-11-01' },
  { name: 'Rachel Foster', role: 'Line Cook', also: ['Prep Cook'], rate: 19, target: 34, max: 40, restriction: 'morning-only', situations: ['parent'],
    notes: 'Childcare — must leave by 3:30 PM for school pickup.', hired: '2022-02-14' },
  { name: 'DeShawn Harris', role: 'Line Cook', rate: 18.5, target: 38, max: 40, restriction: 'evening-only', notes: 'Grill station. Prefers closing.', hired: '2021-08-23' },
  { name: 'Kevin Tran', role: 'Line Cook', also: ['Dishwasher'], rate: 18, target: 32, max: 40, situations: ['second-job'],
    unavailable: blocks([TUE, THU], ['06:00', '14:00'], 'second-job', 'Bakery shift'),
    notes: 'Bakery job Tue/Thu mornings.', hired: '2023-05-05' },
  { name: 'Samantha Ortiz', role: 'Line Cook', also: ['Prep Cook'], rate: 18.5, target: 30, max: 36, restriction: 'no-late-nights', situations: ['parent'],
    unavailable: blocks([SUN], ALL_DAY, 'childcare', 'No Sunday childcare'),
    notes: 'Parenting — no closing shifts, Sundays off with family.', hired: '2022-09-12' },
  { name: 'Andre Wallace', role: 'Line Cook', rate: 19.5, target: 40, max: 40, notes: 'Sauté station. Full-time.', hired: '2020-10-19' },
  { name: 'Jasmine Wright', role: 'Line Cook', also: ['Prep Cook'], rate: 18, target: 30, max: 36, situations: ['student'],
    unavailable: blocks([MON, WED], ['08:00', '15:00'], 'class', 'Culinary school'),
    notes: 'Culinary school Mon/Wed daytime.', hired: '2024-07-08' },

  // ── Prep Cooks ────────────────────────────────────────────
  { name: 'Luis Ramirez', role: 'Prep Cook', also: ['Line Cook', 'Dishwasher'], rate: 17, target: 40, max: 40, restriction: 'morning-only', notes: 'Opens the kitchen. Has keys.', tags: ['Key Holder'], hired: '2020-03-15' },
  { name: 'Grace Okafor', role: 'Prep Cook', rate: 16.5, target: 30, max: 34, restriction: 'morning-only', situations: ['parent'],
    unavailable: blocks([SAT, SUN], ALL_DAY, 'childcare'),
    notes: 'Childcare on weekends — weekdays only.', hired: '2023-04-27' },
  { name: 'Tomás Silva', role: 'Prep Cook', also: ['Line Cook'], rate: 17, target: 32, max: 38, situations: ['medical'],
    unavailable: blocks([THU], ['06:00', '12:00'], 'medical', 'Recurring appointment'),
    notes: 'Recurring medical appointment Thursday mornings (do not discuss with team).', hired: '2022-07-30' },

  // ── Dishwashers ───────────────────────────────────────────
  { name: 'Rosa Delgado', role: 'Dishwasher', also: ['Prep Cook'], rate: 13.5, target: 36, max: 40, notes: 'Cross-trained on prep. Prefers mornings but flexible.', hired: '2021-12-06' },
  { name: 'Malik Owens', role: 'Dishwasher', also: ['Busser'], rate: 13, target: 30, max: 36, restriction: 'evening-only', situations: ['student'],
    notes: 'Day classes at the trade school.', hired: '2024-11-11' },
  { name: 'Nina Petrova', role: 'Dishwasher', rate: 13, target: 22, max: 26, restriction: 'morning-only', situations: ['parent'],
    unavailable: blocks([SUN], ALL_DAY, 'childcare'),
    notes: 'Kids in school until 3 — mornings only, no Sundays.', hired: '2025-05-19' },
];

export const SEED_EMPLOYEES: Employee[] = specs.map((s, i) => ({
  id: `emp_${String(i + 1).padStart(2, '0')}`,
  name: s.name,
  role: s.role,
  secondaryRoles: s.also ?? [],
  hourlyRate: s.rate,
  targetHours: s.target,
  maxHours: s.max ?? 40,
  maxShiftHours: s.maxShift,
  maxDaysPerWeek: s.maxDays,
  restriction: s.restriction ?? 'none',
  unavailable: s.unavailable ?? [],
  situations: s.situations ?? [],
  personalNotes: s.notes ?? '',
  customTags: s.tags ?? [],
  hireDate: s.hired,
}));

type Need = Partial<Record<Role, number>>;
type DayNeeds = Record<string, Need>;

const weekday: DayNeeds = {
  morning: { 'Prep Cook': 2, 'Line Cook': 1, Dishwasher: 1, Server: 1 },
  mid: { Server: 2, 'Line Cook': 1, Host: 1 },
  dinner: { Server: 2, Host: 1, Busser: 1, 'Line Cook': 1, Bartender: 1 },
  closing: { Server: 1, 'Line Cook': 2, Bartender: 1, Dishwasher: 1, Busser: 1 },
};
const friSat: DayNeeds = {
  morning: { 'Prep Cook': 2, 'Line Cook': 1, Dishwasher: 1, Server: 2, Host: 1 },
  mid: { Server: 2, 'Line Cook': 1, Host: 1, Busser: 1, Bartender: 1 },
  dinner: { Server: 3, Host: 2, Busser: 1, 'Line Cook': 1, Bartender: 2 },
  closing: { Server: 2, 'Line Cook': 2, Bartender: 2, Dishwasher: 2, Busser: 2 },
};
const sunday: DayNeeds = {
  morning: { 'Prep Cook': 1, 'Line Cook': 2, Dishwasher: 1, Server: 3, Host: 1, Bartender: 1, Busser: 1 },
  mid: { Server: 2, 'Line Cook': 1, Host: 1 },
  dinner: { Server: 2, Host: 1, 'Line Cook': 1, Bartender: 1 },
  closing: { Server: 1, 'Line Cook': 1, Dishwasher: 1, Busser: 1 },
};

const clone = (d: DayNeeds): DayNeeds => JSON.parse(JSON.stringify(d));

export const SEED_REQUIREMENTS: Requirements = {
  0: clone(weekday),
  1: clone(weekday),
  2: clone(weekday),
  3: clone(weekday),
  4: clone(friSat),
  5: clone(friSat),
  6: clone(sunday),
};
