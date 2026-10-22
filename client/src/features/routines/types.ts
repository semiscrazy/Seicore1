export type Frequency = 'daily' | 'days' | 'weekly' | 'monthly';

export interface Step { id: number; label: string }
export interface Session { id: number; label: string; time: string | null; steps: Step[] }
export interface Routine {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: Frequency;
  daysOfWeek: number[];
  timesPerPeriod: number;
  startDate: string;
  archived: boolean;
  sessions: Session[];
}

export interface DaySession extends Session {
  done: boolean;
  checkedStepIds: number[];
  periodCount: number;
  pending: boolean;
}

export interface DayRoutine {
  routine: Routine;
  target: number;
  period: { start: string; end: string };
  sessions: DaySession[];
  done: boolean;
  pending: boolean;
  streak: number;
}

export interface DayResponse {
  date: string;
  today: string;
  routines: DayRoutine[];
  summary: { routines: number; pending: number; sessions: number; sessionsDone: number };
}

export interface HistoryResponse {
  routine: Routine;
  days: { date: string; scheduled: boolean; completedSessionIds: number[] }[];
  streak: number;
}

/** Editable shape: ids are present for existing sessions/steps so their history is kept. */
export interface RoutineDraft {
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: Frequency;
  daysOfWeek: number[];
  timesPerPeriod: number;
  startDate?: string;
  sessions: { id?: number; key: string; label: string; time: string; steps: { id?: number; key: string; label: string }[] }[];
}
