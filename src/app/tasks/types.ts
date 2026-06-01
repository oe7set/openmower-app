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

export interface MowingExceptions {
  country?: string;
  subdiv?: string;
  blocking_days?: string[];
}
