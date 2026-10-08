import type { Day } from '../types';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const hours = (start: number, end: number) => (end - start) / 60;

/** 390 -> "6:30a", 1440 -> "12a", 1470 -> "12:30a" */
export function fmtTime(min: number, compact = true): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? (compact ? 'a' : ' AM') : compact ? 'p' : ' PM';
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${suffix}`;
}

export const fmtRange = (start: number, end: number, compact = true) =>
  `${fmtTime(start, compact)}–${fmtTime(end, compact)}`;

/** "HH:MM" <-> minutes, for <input type="time"> */
export const toInput = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const fromInput = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

export const fmtHours = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);

export const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const dateFor = (week: Date, day: Day) => addDays(week, day);

export const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
