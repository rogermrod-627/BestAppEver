export const ROLES = [
  'Server',
  'Bartender',
  'Host',
  'Busser',
  'Line Cook',
  'Prep Cook',
  'Dishwasher',
] as const;
export type Role = (typeof ROLES)[number];

/** 0 = Monday … 6 = Sunday */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6];

export type ShiftKind = 'morning' | 'mid' | 'evening' | 'closing';

export interface ShiftTemplate {
  id: string;
  name: string;
  kind: ShiftKind;
  /** minutes from midnight */
  start: number;
  /** minutes from midnight; may exceed 1440 for shifts that run past midnight */
  end: number;
}

export type ShiftRestriction = 'none' | 'morning-only' | 'evening-only' | 'no-late-nights';

export type BlockReason = 'class' | 'childcare' | 'second-job' | 'medical' | 'religious' | 'personal';

/** A recurring weekly window when the employee cannot work. */
export interface UnavailableBlock {
  id: string;
  day: Day;
  start: number;
  end: number;
  reason: BlockReason;
  note?: string;
}

export type Situation = 'student' | 'parent' | 'pregnancy' | 'second-job' | 'minor' | 'medical';

export interface Employee {
  id: string;
  name: string;
  role: Role;
  /** Cross-trained positions the employee can also cover. */
  secondaryRoles: Role[];
  hourlyRate: number;
  targetHours: number;
  maxHours: number;
  /** Max length of a single shift in hours (e.g. pregnancy accommodation). */
  maxShiftHours?: number;
  maxDaysPerWeek?: number;
  restriction: ShiftRestriction;
  unavailable: UnavailableBlock[];
  situations: Situation[];
  /** Confidential manager-only notes. */
  personalNotes: string;
  customTags: string[];
  hireDate?: string;
}

/** Staffing requirement: requirements[day][templateId][role] = headcount */
export type Requirements = Record<Day, Record<string, Partial<Record<Role, number>>>>;

export interface Shift {
  id: string;
  day: Day;
  templateId: string;
  role: Role;
  start: number;
  end: number;
  employeeId: string | null;
  /** Pinned shifts survive regeneration. */
  pinned?: boolean;
  /** Set when the generator could not fill the shift. */
  unassignedReason?: string;
  /** Per-reason breakdown of why candidates were rejected. */
  unassignedDetails?: string[];
  /** Manager knowingly assigned despite a hard conflict. */
  override?: boolean;
}

export type WarningKind = 'overtime' | 'over-target' | 'double' | 'clopen' | 'hard-conflict' | 'too-many-days' | 'over-max';

export interface ScheduleWarning {
  kind: WarningKind;
  employeeId: string;
  shiftIds: string[];
  message: string;
  severity: 'soft' | 'hard';
}
