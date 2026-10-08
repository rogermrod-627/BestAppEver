# ShiftWise — Restaurant Employee Scheduling

A visual, constraint-aware weekly scheduler for restaurant managers running large teams
(students, parents, second jobs, pregnancy accommodations, minors, fixed commitments).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run simulate              # run the generator headless on the demo data
```

Ships with a demo restaurant (**Harbor & Vine**, 38 FOH/BOH employees) and saves edits to
`localStorage`. Use the ↺ button in the toolbar to restore the demo.

## Features

- **Weekly schedule board** — employees × days grid, grouped Front/Back of House, with daily
  coverage bars, hours-vs-target per person, and an *Open Shifts* row.
- **Drag & drop** — drag a shift onto anyone on the same day. While dragging, every cell turns
  green (available, with new weekly total) or red (with the blocking reason). Dropping on a
  conflicting cell asks for an explicit override; the shift is then flagged red. Drop on
  *Open Shifts* to unassign. Ctrl/⌘+Z undoes.
- **Hover cards** — hover an employee for their tags, rules, blocked times and confidential
  notes; hover a shift for its warnings or why it's unfilled. *Privacy mode* hides notes when
  screen-sharing.
- **Employee profile modal** — profile & pay, cross-trained roles, target/max hours,
  shift-time restriction (Morning Only / Evening Only / No Late Nights), max shift length,
  max days/week, recurring unavailable blocks (class, childcare, other job, medical…) with a
  visual week timeline, life-situation flags with suggested accommodations, and dynamic tags.
- **One-click generator** (`src/lib/scheduler.ts`) — builds slots from shift templates ×
  staffing needs, fills the most-constrained slots first, never breaks a hard constraint,
  scores candidates for fairness (distance below target), primary role, and avoiding doubles
  and clopens, then runs a swap-based repair pass. Pinned shifts survive regeneration.
  Unfillable shifts carry a reason such as `Unassigned: Exceeds Max Hours` or
  `Conflict: Student Class Time`, plus a per-reason breakdown.
- **Soft warnings** — overtime (>40h), over target, double shifts, clopens (<10h rest).
- **Dashboard** — scheduled vs target hours, labor cost (by role), unassigned counter,
  warnings breakdown, on-target staff.
- **Shifts & Staffing drawer** — edit shift templates and required headcount per role per day.

## Stack

React 18 + TypeScript, Vite, Tailwind CSS v4, lucide-react. No backend — state lives in React
and `localStorage`.
