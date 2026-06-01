// Hand-written client mirrors of the openrpc.json schemas the generated rpc.ts
// returns as opaque hashed types. Kept here so the calendar/history UI has
// readable shapes without coupling to the generated names.

export type RunStatus = 'started' | 'completed' | 'aborted' | 'failed';

export interface ScheduleRun {
  run_id: string;
  schedule_id: string;
  name?: string;
  occurrence_iso: string;
  started_iso?: string;
  ended_iso?: string;
  area_indices?: number[];
  status: RunStatus;
  reason?: string;
}

// A recurring time-of-day window. start/end are 'HH:MM'; an end <= start
// crosses midnight (e.g. 20:00–08:00). Empty/omitted days = every day.
export interface BlockWindow {
  start: string;
  end: string;
  days?: string[];
}

export interface MowingExceptions {
  country?: string;
  subdiv?: string;
  blocking_days?: string[];
  timezone?: string;
  block_windows?: BlockWindow[];
}

// One public holiday resolved by the backend for the calendar range.
export interface Holiday {
  date: string; // ISO 'YYYY-MM-DD'
  name: string;
}

// Calendar tint for a day: a manual/full-day block or a public holiday. The
// optional label carries the holiday name for the tooltip.
export interface BlockedDay {
  reason: 'blocked' | 'holiday';
  label?: string;
}
