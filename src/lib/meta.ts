import type { BlockReason, Role, ShiftKind, ShiftRestriction, Situation } from '../types';

export interface RoleStyle {
  chip: string;
  dot: string;
  text: string;
  soft: string;
  short: string;
}

export const ROLE_STYLE: Record<Role, RoleStyle> = {
  Server: { chip: 'bg-sky-50 border-sky-200 text-sky-900', dot: 'bg-sky-400', text: 'text-sky-700', soft: 'bg-sky-100', short: 'SRV' },
  Bartender: { chip: 'bg-rose-50 border-rose-200 text-rose-900', dot: 'bg-rose-400', text: 'text-rose-700', soft: 'bg-rose-100', short: 'BAR' },
  Host: { chip: 'bg-violet-50 border-violet-200 text-violet-900', dot: 'bg-violet-400', text: 'text-violet-700', soft: 'bg-violet-100', short: 'HST' },
  Busser: { chip: 'bg-teal-50 border-teal-200 text-teal-900', dot: 'bg-teal-400', text: 'text-teal-700', soft: 'bg-teal-100', short: 'BUS' },
  'Line Cook': { chip: 'bg-orange-50 border-orange-200 text-orange-900', dot: 'bg-orange-400', text: 'text-orange-700', soft: 'bg-orange-100', short: 'LINE' },
  'Prep Cook': { chip: 'bg-amber-50 border-amber-200 text-amber-900', dot: 'bg-amber-400', text: 'text-amber-700', soft: 'bg-amber-100', short: 'PREP' },
  Dishwasher: { chip: 'bg-slate-50 border-slate-200 text-slate-800', dot: 'bg-slate-400', text: 'text-slate-600', soft: 'bg-slate-100', short: 'DISH' },
};

export const ROLE_AREA: Record<Role, 'Front of House' | 'Back of House'> = {
  Server: 'Front of House',
  Bartender: 'Front of House',
  Host: 'Front of House',
  Busser: 'Front of House',
  'Line Cook': 'Back of House',
  'Prep Cook': 'Back of House',
  Dishwasher: 'Back of House',
};

export const KIND_STYLE: Record<ShiftKind, { label: string; bar: string; badge: string }> = {
  morning: { label: 'Morning', bar: 'bg-amber-300', badge: 'bg-amber-100 text-amber-800' },
  mid: { label: 'Mid', bar: 'bg-emerald-300', badge: 'bg-emerald-100 text-emerald-800' },
  evening: { label: 'Evening', bar: 'bg-indigo-300', badge: 'bg-indigo-100 text-indigo-800' },
  closing: { label: 'Closing', bar: 'bg-purple-400', badge: 'bg-purple-100 text-purple-800' },
};

export const RESTRICTION_LABEL: Record<ShiftRestriction, string> = {
  none: 'Open availability',
  'morning-only': 'Morning Only',
  'evening-only': 'Evening / Closing Only',
  'no-late-nights': 'No Late Nights',
};

export const RESTRICTION_HELP: Record<ShiftRestriction, string> = {
  none: 'Can be scheduled for any shift type.',
  'morning-only': 'Shifts must start before 12 PM and end by 4 PM.',
  'evening-only': 'Shifts must start at 3 PM or later.',
  'no-late-nights': 'Shifts must end by 10 PM.',
};

export const BLOCK_REASON: Record<BlockReason, { label: string; conflict: string; cls: string }> = {
  class: { label: 'Class', conflict: 'Student Class Time', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  childcare: { label: 'Childcare', conflict: 'Childcare Commitment', cls: 'bg-pink-100 text-pink-800 border-pink-200' },
  'second-job': { label: 'Other Job', conflict: 'Second Job', cls: 'bg-lime-100 text-lime-800 border-lime-200' },
  medical: { label: 'Medical', conflict: 'Medical Accommodation', cls: 'bg-red-100 text-red-800 border-red-200' },
  religious: { label: 'Religious', conflict: 'Religious Observance', cls: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  personal: { label: 'Personal', conflict: 'Personal Commitment', cls: 'bg-stone-100 text-stone-700 border-stone-200' },
};

export const SITUATION: Record<Situation, { label: string; cls: string }> = {
  student: { label: 'Student', cls: 'bg-blue-100 text-blue-800' },
  parent: { label: 'Childcare', cls: 'bg-pink-100 text-pink-800' },
  pregnancy: { label: 'Pregnancy', cls: 'bg-fuchsia-100 text-fuchsia-800' },
  'second-job': { label: 'Second Job', cls: 'bg-lime-100 text-lime-800' },
  minor: { label: 'Minor (<18)', cls: 'bg-yellow-100 text-yellow-800' },
  medical: { label: 'Medical', cls: 'bg-red-100 text-red-800' },
};
