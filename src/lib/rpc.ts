// GENERATED FILE, DO NOT EDIT!!!
/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenMowerBaseRpc from './rpc-base';

export type NumberHo1ClIqD = number;
export type UnorderedSetOfNumberHo1ClIqDVeKFvh2C = NumberHo1ClIqD[];
export type UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUG = UnorderedSetOfNumberHo1ClIqDVeKFvh2C[];
export type Integer7Bd9WOt2 = number;
/**
 *
 * Mowing speed in m/s (FTC speed_slow). Omit to use the global FTC planner speed.
 *
 */
export type NumberTAZyBWjP = number;
/**
 *
 * Travel/approach speed in m/s (FTC speed_fast) used between mow paths. Omit to use the global FTC planner speed.
 *
 */
export type NumberUQNyT7Ml = number;
/**
 *
 * Coverage fill pattern. Omit to use the global default pattern.
 *
 */
export type StringCakJguo4 = "linear" | "concentric_lines" | "concentric_circle" | "hilbert" | "grid" | "honeycomb" | "octagram";
/**
 *
 * Absolute mowing angle in degrees. Omit to use the global/auto-detected angle.
 *
 */
export type NumberA4WF8D4D = number;
/**
 *
 * Number of perimeter passes before the fill pattern. Omit to use the per-area/global default.
 *
 */
export type IntegerMe5ZzgZO = number;
type AlwaysTrue = any;
export type StringDoaGddGA = string;
/**
 *
 * Generated server-side when omitted.
 *
 */
export type StringAm7XRL52 = string;
export type BooleanVyG3AETh = boolean;
/**
 *
 * Mowing-logic mode. 'time_area' (default): fire the rrule occurrence on the listed areas for duration_minutes. 'time_window': mow within a daily start/end window across active areas, resuming where the previous window left off. 'continuous' (24/7): keep automatic mode active, gated only by blocking days / rain. Defaults to 'time_area' on the server when missing.
 *
 */
export type String8HOxumqc = "time_area" | "time_window" | "continuous";
export type Integer2AHOqbcQ = number;
/**
 *
 * Zero-based indices into the mow-type areas. Every listed area is mowed in order (multi-area).
 *
 */
export type UnorderedSetOfInteger2AHOqbcQck4QOpRC = Integer2AHOqbcQ[];
/**
 *
 * iCal RRULE string. The server validates with python-dateutil; supports FREQ (DAILY/WEEKLY/MONTHLY), INTERVAL, BYDAY/BYHOUR/BYMINUTE, COUNT and UNTIL.
 *
 */
export type StringU4RlUo3D = string;
/**
 *
 * Series exception dates (ISO 8601 'YYYY-MM-DD'). Occurrences on these dates are skipped without an event.
 *
 */
export type UnorderedSetOfStringDoaGddGA2VviDRzF = StringDoaGddGA[];
/**
 *
 * Used by 'time_area' mode as the stop-at-time horizon for the run.
 *
 */
export type IntegerZ984LTOJ = number;
/**
 *
 * IANA time zone name the rrule is interpreted in (e.g. 'Europe/Vienna'). Defaults to 'UTC' on the server when missing for legacy entries.
 *
 */
export type StringNwgXXEkt = string;
/**
 *
 * Daily window start, 'HH:MM' in the schedule timezone.
 *
 */
export type StringPti3J7ZI = string;
/**
 *
 * Daily window end, 'HH:MM' in the schedule timezone.
 *
 */
export type String80JIivhs = string;
export type StringLD1FOTDs = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
/**
 *
 * Weekdays the window is active on.
 *
 */
export type UnorderedSetOfStringLD1FOTDsxWHiLPH4 = StringLD1FOTDs[];
/**
 *
 * Idle wait inserted between areas within a window.
 *
 */
export type IntegerJYrdHJVi = number;
/**
 *
 * Used by 'time_window' mode only.
 *
 */
export interface ObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7Y {
  start?: StringPti3J7ZI;
  end?: String80JIivhs;
  days?: UnorderedSetOfStringLD1FOTDsxWHiLPH4;
  area_wait_minutes?: IntegerJYrdHJVi;
  [k: string]: any;
}
export interface ObjectOfBooleanVyG3AEThF7X7Tx0W {
  skip_if_rain?: BooleanVyG3AETh;
  [k: string]: any;
}
/**
 *
 * Number of perimeter (outline) passes mowed before the fill pattern. Omit to use the per-area/global default.
 *
 */
export type IntegerMTgw1O6O = number;
/**
 *
 * Per-appointment parameter overrides. An omitted field falls back to the mower's global default.
 *
 */
export interface ObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01 {
  speed_mps?: NumberTAZyBWjP;
  travel_speed_mps?: NumberUQNyT7Ml;
  pattern?: StringCakJguo4;
  angle_deg?: NumberA4WF8D4D;
  outline_count?: IntegerMTgw1O6O;
  [k: string]: any;
}
/**
 *
 * Deprecated. Migrated server-side into 'overrides.angle_deg'. Retained for backward compatibility with v1 schedules.
 *
 */
export interface ObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7Q {
  angle_offset?: NumberHo1ClIqD;
  rotate_by_days?: Integer2AHOqbcQ;
  [k: string]: any;
}
/**
 *
 * Read-only. ISO 8601 timestamp (with offset) of the upcoming occurrence. Omitted when the schedule is disabled or has no future occurrence.
 *
 */
export type StringOIDLIvtl = string;
/**
 *
 * Read-only. ISO 8601 timestamp of the last successful firing. Omitted when the schedule has never fired.
 *
 */
export type String8AUA9TrY = string;
/**
 *
 * Read-only. Reason the most recent due occurrence was skipped. Omitted when no skip has been recorded.
 *
 */
export type String2QvGyGDO = "no_state" | "emergency" | "not_idle" | "charging" | "rain" | "blocked" | "holiday" | "block_window";
/**
 *
 * Read-only. ISO 8601 timestamp of the most recent skip. Omitted when no skip has been recorded.
 *
 */
export type StringQhq3HSA0 = string;
/**
 *
 * ISO country code for public-holiday lookup, e.g. 'DE'. Empty disables holiday blocking.
 *
 */
export type StringPIVdEUDG = string;
/**
 *
 * Optional subdivision/region code, e.g. 'BY' for Bavaria. Empty for nationwide holidays.
 *
 */
export type StringW73LspcZ = string;
/**
 *
 * Manual blocking days as ISO 'YYYY-MM-DD'. Mowing is skipped on these dates regardless of schedules.
 *
 */
export type UnorderedSetOfStringDoaGddGAxIQucMbf = StringDoaGddGA[];
/**
 *
 * IANA time zone the block_windows times are interpreted in (e.g. 'Europe/Vienna'). Defaults to 'UTC' on the server when missing.
 *
 */
export type StringTF2N8PAY = string;
/**
 *
 * Window start, 'HH:MM' in the exceptions timezone.
 *
 */
export type StringKjcr2O6H = string;
/**
 *
 * Window end, 'HH:MM'. An end <= start crosses midnight (e.g. 20:00-08:00).
 *
 */
export type StringLfutBJWh = string;
/**
 *
 * Weekdays the window is active on. Empty or omitted = every day.
 *
 */
export type UnorderedSetOfStringLD1FOTDsBUsnf7JH = StringLD1FOTDs[];
export interface ObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5U {
  start: StringKjcr2O6H;
  end: StringLfutBJWh;
  days?: UnorderedSetOfStringLD1FOTDsBUsnf7JH;
  [k: string]: any;
}
/**
 *
 * Recurring time-of-day windows during which mowing is blocked (hard stop: an active run is sent home and no new/automatic run starts while a window is active). E.g. nightly 20:00-08:00.
 *
 */
export type UnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27Cb = ObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5U[];
export interface ObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVF {
  is_outline: BooleanVyG3AETh;
  points: UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUG;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmX = ObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVF[];
/**
 *
 * Content of a YAML file as a string
 *
 */
export type StringXJCrhoiv = string;
export type UnorderedSetOfStringDoaGddGADvj0XlFa = StringDoaGddGA[];
export type String9BJAV6Bu = "readonly" | "env-source" | "ros-source" | "unknown" | "no-yaml-path" | "out-of-range";
export interface ObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODF {
  key: StringDoaGddGA;
  reason: String9BJAV6Bu;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaT = ObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODF[];
export interface ObjectIZgu6KjQ { [key: string]: any; }
export interface ObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL {
  id?: StringAm7XRL52;
  name: StringDoaGddGA;
  enabled: BooleanVyG3AETh;
  mode?: String8HOxumqc;
  areas: UnorderedSetOfInteger2AHOqbcQck4QOpRC;
  rrule: StringU4RlUo3D;
  exdates?: UnorderedSetOfStringDoaGddGA2VviDRzF;
  duration_minutes: IntegerZ984LTOJ;
  timezone: StringNwgXXEkt;
  window?: ObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7Y;
  weather?: ObjectOfBooleanVyG3AEThF7X7Tx0W;
  overrides?: ObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01;
  pattern?: ObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7Q;
  next_run?: StringOIDLIvtl;
  last_fired_at?: String8AUA9TrY;
  last_skip_reason?: String2QvGyGDO;
  last_skip_at?: StringQhq3HSA0;
  [k: string]: any;
}
/**
 *
 * Unique id correlating this run across the dispatch and its lifecycle events.
 *
 */
export type StringEfOF2Tab = string;
/**
 *
 * Schedule name at the time of the run.
 *
 */
export type StringIgmTLAHJ = string;
/**
 *
 * ISO 8601 timestamp of the rrule occurrence that triggered the run.
 *
 */
export type StringB7N8MIyA = string;
/**
 *
 * ISO 8601 timestamp the run was dispatched.
 *
 */
export type StringVgJsWAxb = string;
/**
 *
 * ISO 8601 timestamp the run was closed. Omitted while still running.
 *
 */
export type StringUlYO7V8F = string;
export type UnorderedSetOfInteger2AHOqbcQarZIQlOy = Integer2AHOqbcQ[];
/**
 *
 * Run outcome. 'started' = still running or never closed.
 *
 */
export type StringVpQXKS8Z = "started" | "completed" | "aborted" | "failed";
/**
 *
 * Outcome detail, e.g. 'aborted', 'stopped_by_user'. Empty for clean completions.
 *
 */
export type StringMVRSI8C0 = string;
/**
 *
 * A single scheduler run outcome, opened when a schedule fires and closed when the mow completes or aborts.
 *
 */
export interface ObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX {
  run_id: StringEfOF2Tab;
  schedule_id: StringDoaGddGA;
  name?: StringIgmTLAHJ;
  occurrence_iso: StringB7N8MIyA;
  started_iso?: StringVgJsWAxb;
  ended_iso?: StringUlYO7V8F;
  area_indices?: UnorderedSetOfInteger2AHOqbcQarZIQlOy;
  status: StringVpQXKS8Z;
  reason?: StringMVRSI8C0;
  [k: string]: any;
}
/**
 *
 * ISO 'YYYY-MM-DD'.
 *
 */
export type StringPlNnRm6U = string;
/**
 *
 * Localized holiday name from the holidays database.
 *
 */
export type String9Bg2HXX5 = string;
export interface ObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MR {
  date: StringPlNnRm6U;
  name: String9Bg2HXX5;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8Pu = ObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MR[];
/**
 *
 * Aggregate CPU utilisation 0–100.
 *
 */
export type NumberP4YjumIF = number;
/**
 *
 * CPU temperature in degrees Celsius.
 *
 */
export type NumberU8K1Uas0 = number;
/**
 *
 * Size of the host root filesystem (SD/eMMC).
 *
 */
export type IntegerPspRrr78 = number;
/**
 *
 * Epoch seconds.
 *
 */
export type NumberCxGOTzvB = number;
export type StringSkVxiS6E = "debug" | "info" | "warn" | "error";
export interface ObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46Y {
  ts: NumberCxGOTzvB;
  level: StringSkVxiS6E;
  msg: StringDoaGddGA;
  source: StringDoaGddGA;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjy = ObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46Y[];
export interface ObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgx {
  id: StringDoaGddGA;
  start_ts: NumberCxGOTzvB;
  end_ts: NumberHo1ClIqD;
  sample_count: Integer2AHOqbcQ;
  file_size_bytes?: Integer2AHOqbcQ;
  duration_s?: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQ = ObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgx[];
/**
 *
 * Mowing state at capture: 'MOWING' or 'PAUSED'.
 *
 */
export type StringMQoP6WbA = string;
export interface ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN {
  ts: NumberHo1ClIqD;
  x: NumberHo1ClIqD;
  y: NumberHo1ClIqD;
  yaw?: NumberHo1ClIqD;
  pitch?: NumberHo1ClIqD;
  roll?: NumberHo1ClIqD;
  gps_fix_type?: Integer2AHOqbcQ;
  gps_satellite_count?: Integer2AHOqbcQ;
  gps_pdop?: NumberHo1ClIqD;
  gps_accuracy?: NumberHo1ClIqD;
  wifi_dbm?: NumberHo1ClIqD;
  wifi_q?: NumberHo1ClIqD;
  state?: StringMQoP6WbA;
  qw?: NumberHo1ClIqD;
  qx?: NumberHo1ClIqD;
  qy?: NumberHo1ClIqD;
  qz?: NumberHo1ClIqD;
  gx?: NumberHo1ClIqD;
  gy?: NumberHo1ClIqD;
  gz?: NumberHo1ClIqD;
  ax?: NumberHo1ClIqD;
  ay?: NumberHo1ClIqD;
  az?: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HF = ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN[];
/**
 *
 * True when more samples remain past this page (request the next offset).
 *
 */
export type BooleanIvFJCYqv = boolean;
export interface ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexV {
  x: NumberHo1ClIqD;
  y: NumberHo1ClIqD;
  z: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfNumberHo1ClIqDC9YO3FZR = NumberHo1ClIqD[];
/**
 *
 * UUID-v4 generated by the producer.
 *
 */
export type String3RwRKkvG = string;
/**
 *
 * Wall-clock epoch milliseconds at emission.
 *
 */
export type IntegerRGdkPNsc = number;
export type StringIQ4UVKQj = "info" | "warning" | "error" | "critical";
/**
 *
 * Canonical kebab-case event type, e.g. 'mowing.started'.
 *
 */
export type StringDLUYbyEJ = string;
/**
 *
 * Originating ROS node name.
 *
 */
export type StringVd3W2HD3 = string;
/**
 *
 * One-line user-facing description.
 *
 */
export type String836AVxQg = string;
/**
 *
 * Optional structured payload. Empty object when not provided.
 *
 */
export interface ObjectWKqX2MzR { [key: string]: any; }
/**
 *
 * Whether the user has acknowledged this event.
 *
 */
export type BooleanC0TIr4Au = boolean;
export interface ObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEE {
  id: String3RwRKkvG;
  ts_ms: IntegerRGdkPNsc;
  severity: StringIQ4UVKQj;
  type: StringDLUYbyEJ;
  source: StringVd3W2HD3;
  summary: String836AVxQg;
  details?: ObjectWKqX2MzR;
  acked?: BooleanC0TIr4Au;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob = ObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEE[];
/**
 *
 * Wall-clock epoch milliseconds the sample was recorded at.
 *
 */
export type IntegerSAdpLmxW = number;
export interface ObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv {
  ts_ms: IntegerSAdpLmxW;
  value: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJta = ObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv[];
export interface Object8Zf4CCW2 { [key: string]: any; }
export interface ObjectHAgrRKSz { [key: string]: any; }
export type UnorderedSetOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGv0X1LEW3 = UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUG[];
export type UnorderedSetOfInteger7Bd9WOt2MMEUfR9Y = Integer7Bd9WOt2[];
export interface ObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMe5ZzgZONumberA4WF8D4DGSirr8SK {
  speed_mps?: NumberTAZyBWjP;
  travel_speed_mps?: NumberUQNyT7Ml;
  pattern?: StringCakJguo4;
  angle_deg?: NumberA4WF8D4D;
  outline_count?: IntegerMe5ZzgZO;
  [k: string]: any;
}
export type AnyL9Fw4VUO = any;
export type IntegerOmVsfaNv = number;
/**
 *
 * When mowing is blocked: explicit blocking_days, the public holidays of the configured country/region, and recurring block_windows (time-of-day ranges).
 *
 */
export interface ObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjes {
  country?: StringPIVdEUDG;
  subdiv?: StringW73LspcZ;
  blocking_days?: UnorderedSetOfStringDoaGddGAxIQucMbf;
  timezone?: StringTF2N8PAY;
  block_windows?: UnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27Cb;
  [k: string]: any;
}
export type String8MpEGeOy = "openmower" | "mower_logic" | "xbot_monitoring" | "move_base_flex";
export type IntegerQDdWfSg7 = number;
export type StringYKWJZZDp = "all" | "mower_logic" | "xbot_monitoring" | "mower_scheduler" | "move_base_flex";
export type IntegerGCqMpUyL = number;
export type IntegerN0RpaiaM = number;
export type IntegerVGvI61Gh = number;
export type StringZDJW5SIj = "pong";
export type NullQu0Arl1F = null;
export interface ObjectOfUnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmXBooleanVyG3AEThXQSuYyPu {
  paths: UnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmX;
  fill_fallback: BooleanVyG3AETh;
  [k: string]: any;
}
export interface ObjectOfBooleanVyG3AEThIj5UHSfl {
  ok?: BooleanVyG3AETh;
  [k: string]: any;
}
export interface ObjectOfStringDoaGddGAPbK8LLpM {
  run_id: StringDoaGddGA;
  [k: string]: any;
}
/**
 *
 * Keys are relative file paths, values are YAML file contents as strings
 *
 */
export interface ObjectHicl3T4F { [key: string]: any; }
export interface ObjectBd6DQSjJ { [key: string]: any; }
export interface ObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwB {
  updated: Integer2AHOqbcQ;
  updated_keys: UnorderedSetOfStringDoaGddGADvj0XlFa;
  skipped_keys: UnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaT;
  [k: string]: any;
}
export interface ObjectOfObjectIZgu6KjQ48UMYEZj {
  values: ObjectIZgu6KjQ;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL3YLDqReT = ObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL[];
export type UnorderedSetOfObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX3XU5XiEl = ObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX[];
export interface ObjectOfUnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8PuDgvnw6C1 {
  holidays?: UnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8Pu;
  [k: string]: any;
}
export interface ObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvG {
  ok?: BooleanVyG3AETh;
  delay_s?: Integer2AHOqbcQ;
  [k: string]: any;
}
export interface ObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvON {
  cpu_percent?: NumberP4YjumIF;
  ram_total_bytes?: Integer2AHOqbcQ;
  ram_used_bytes?: Integer2AHOqbcQ;
  ram_available_bytes?: Integer2AHOqbcQ;
  cpu_temp_c?: NumberU8K1Uas0;
  disk_total_bytes?: IntegerPspRrr78;
  disk_used_bytes?: Integer2AHOqbcQ;
  disk_free_bytes?: Integer2AHOqbcQ;
  uptime_seconds?: NumberHo1ClIqD;
  [k: string]: any;
}
export interface ObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7 {
  ok?: BooleanVyG3AETh;
  reclaimed_bytes?: Integer2AHOqbcQ;
  output?: StringDoaGddGA;
  [k: string]: any;
}
export interface ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N {
  entries?: UnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjy;
  [k: string]: any;
}
export interface ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd {
  sessions?: UnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQ;
  [k: string]: any;
}
export interface ObjectOfBooleanIvFJCYqvUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HFCbDvjopC {
  samples?: UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HF;
  truncated?: BooleanIvFJCYqv;
  [k: string]: any;
}
export interface ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2 {
  mounting_roll_offset_rad: NumberHo1ClIqD;
  mounting_pitch_offset_rad: NumberHo1ClIqD;
  gyro_bias: ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexV;
  samples_count: Integer2AHOqbcQ;
  accel_stddev: UnorderedSetOfNumberHo1ClIqDC9YO3FZR;
  gyro_stddev: UnorderedSetOfNumberHo1ClIqDC9YO3FZR;
  [k: string]: any;
}
export interface ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12 {
  events?: UnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob;
  unread?: Integer2AHOqbcQ;
  [k: string]: any;
}
export interface ObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5U {
  sensor_id?: StringDoaGddGA;
  samples?: UnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJta;
  [k: string]: any;
}
export interface ObjectOfObject8Zf4CCW24GqovvrD {
  sensors?: Object8Zf4CCW2;
  [k: string]: any;
}
/**
 *
 * Generated! Represents an alias to any of the provided schemas
 *
 */
export type AnyOfObjectHAgrRKSzInteger7Bd9WOt2UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGUnorderedSetOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGv0X1LEW3Integer7Bd9WOt2NumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger7Bd9WOt2Integer7Bd9WOt2BooleanVyG3AEThBooleanVyG3AEThBooleanVyG3AEThUnorderedSetOfInteger7Bd9WOt2MMEUfR9YObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMe5ZzgZONumberA4WF8D4DGSirr8SKInteger7Bd9WOt2ObjectIZgu6KjQUnorderedSetOfStringDoaGddGADvj0XlFaStringDoaGddGAAnyL9Fw4VUOObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyLStringDoaGddGAStringDoaGddGAIntegerOmVsfaNvObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjesStringDoaGddGAStringDoaGddGAString8MpEGeOyIntegerQDdWfSg7StringYKWJZZDpIntegerGCqMpUyLStringDoaGddGAIntegerOmVsfaNvInteger7Bd9WOt2IntegerOmVsfaNvIntegerN0RpaiaMInteger7Bd9WOt2StringIQ4UVKQjUnorderedSetOfStringDoaGddGADvj0XlFaStringDoaGddGAStringDoaGddGAInteger7Bd9WOt2IntegerVGvI61GhInteger7Bd9WOt2IntegerVGvI61GhStringZDJW5SIjUnorderedSetOfStringDoaGddGADvj0XlFaNullQu0Arl1FNullQu0Arl1FObjectOfUnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmXBooleanVyG3AEThXQSuYyPuObjectOfBooleanVyG3AEThIj5UHSflObjectOfStringDoaGddGAPbK8LLpMStringZDJW5SIjStringDoaGddGAObjectHicl3T4FObjectBd6DQSjJObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwBObjectOfObjectIZgu6KjQ48UMYEZjNullQu0Arl1FUnorderedSetOfObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL3YLDqReTObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyLNullQu0Arl1FUnorderedSetOfObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX3XU5XiElObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjesObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjesObjectOfUnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8PuDgvnw6C1ObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvGObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvONObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525NObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69FdObjectOfBooleanIvFJCYqvUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HFCbDvjopCObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12ObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThIj5UHSflObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5UObjectOfObject8Zf4CCW24GqovvrD = ObjectHAgrRKSz | Integer7Bd9WOt2 | UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUG | UnorderedSetOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGv0X1LEW3 | NumberHo1ClIqD | BooleanVyG3AETh | UnorderedSetOfInteger7Bd9WOt2MMEUfR9Y | ObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMe5ZzgZONumberA4WF8D4DGSirr8SK | ObjectIZgu6KjQ | UnorderedSetOfStringDoaGddGADvj0XlFa | StringDoaGddGA | AnyL9Fw4VUO | ObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL | IntegerOmVsfaNv | ObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjes | String8MpEGeOy | IntegerQDdWfSg7 | StringYKWJZZDp | IntegerGCqMpUyL | IntegerN0RpaiaM | StringIQ4UVKQj | IntegerVGvI61Gh | StringZDJW5SIj | NullQu0Arl1F | ObjectOfUnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmXBooleanVyG3AEThXQSuYyPu | ObjectOfBooleanVyG3AEThIj5UHSfl | ObjectOfStringDoaGddGAPbK8LLpM | ObjectHicl3T4F | ObjectBd6DQSjJ | ObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwB | ObjectOfObjectIZgu6KjQ48UMYEZj | UnorderedSetOfObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL3YLDqReT | UnorderedSetOfObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX3XU5XiEl | ObjectOfUnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8PuDgvnw6C1 | ObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvG | ObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvON | ObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7 | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd | ObjectOfBooleanIvFJCYqvUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HFCbDvjopC | ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2 | ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12 | ObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5U | ObjectOfObject8Zf4CCW24GqovvrD;

export class OpenMowerRpc extends OpenMowerBaseRpc {
  rpc = {
    /**
    * Ping the server.
    */
    ping: async (timeoutMs?: number): Promise<StringZDJW5SIj> => this.call('rpc.ping', undefined, timeoutMs),
    /**
    * List all available methods.
    */
    methods: async (timeoutMs?: number): Promise<UnorderedSetOfStringDoaGddGADvj0XlFa> => this.call('rpc.methods', undefined, timeoutMs),
  };
  map = {
    /**
    * Replace the current map with a new one.
    */
    replace: async (...args: [map: ObjectHAgrRKSz]): Promise<void> => this.call('map.replace', args),
    /**
    * Trigger mowing to start in a specific working area.
    */
    start_in_area: async (args: {area_index: Integer7Bd9WOt2}, timeoutMs?: number): Promise<void> => this.call('map.start_in_area', args, timeoutMs),
  };
  coverage = {
    /**
    * Compute the exact slic3r coverage path for an area without executing it, for on-map preview. All parameters are concrete (the caller resolves 'use default' against the live config first); geometry is in mower-relative metres like Area.outline.
    */
    preview: async (args: {outline: UnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUG, holes?: UnorderedSetOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGv0X1LEW3, fill_type?: Integer7Bd9WOt2, angle_rad?: NumberHo1ClIqD, distance?: NumberHo1ClIqD, outer_offset?: NumberHo1ClIqD, outline_count?: Integer7Bd9WOt2, outline_overlap_count?: Integer7Bd9WOt2, skip_area_outline?: BooleanVyG3AETh, skip_obstacle_outlines?: BooleanVyG3AETh, skip_fill?: BooleanVyG3AETh}, timeoutMs?: number): Promise<ObjectOfUnorderedSetOfObjectOfUnorderedSetOfUnorderedSetOfNumberHo1ClIqDVeKFvh2CtSFAhUUGBooleanVyG3AEThPwv5XVVFOVt11FmXBooleanVyG3AEThXQSuYyPu> => this.call('coverage.preview', args, timeoutMs),
  };
  mower = {
    /**
    * Tell the mower to return to its docking station, regardless of the current state.
    */
    return_home: async (timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('mower.return_home', undefined, timeoutMs),
    /**
    * Start a manual (ad-hoc) mowing run over chosen areas with optional per-run parameter overrides. Dispatched through the scheduler, so it honours the same gating (must be idle, not in an active block window).
    */
    start_mowing: async (args: {areas: UnorderedSetOfInteger7Bd9WOt2MMEUfR9Y, overrides?: ObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMe5ZzgZONumberA4WF8D4DGSirr8SK, duration_minutes?: Integer7Bd9WOt2}, timeoutMs?: number): Promise<ObjectOfStringDoaGddGAPbK8LLpM> => this.call('mower.start_mowing', args, timeoutMs),
  };
  meta = {
    rpc: {
      /**
      * Ping the meta server.
      */
      ping: async (timeoutMs?: number): Promise<StringZDJW5SIj> => this.call('meta.rpc.ping', undefined, timeoutMs),
    },
    config: {
      /**
      * Get the configuration schema.
      */
      schema: async (timeoutMs?: number): Promise<StringDoaGddGA> => this.call('meta.config.schema', undefined, timeoutMs),
      /**
      * Get the default configuration values.
      */
      defaults: async (timeoutMs?: number): Promise<ObjectHicl3T4F> => this.call('meta.config.defaults', undefined, timeoutMs),
      /**
      * Read the live mower_config.sh as a flat key/value object.
      */
      get: async (timeoutMs?: number): Promise<ObjectBd6DQSjJ> => this.call('meta.config.get', undefined, timeoutMs),
      /**
      * Apply a set of changes to mower_config.sh atomically.
      */
      set: async (...args: [changes: ObjectIZgu6KjQ]): Promise<ObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwB> => this.call('meta.config.set', args),
    },
  };
  params = {
    /**
    * Read multiple ROS parameters at once. Names are filtered against the schema's x-ros-param whitelist on the server.
    */
    get_many: async (args: {names: UnorderedSetOfStringDoaGddGADvj0XlFa}, timeoutMs?: number): Promise<ObjectOfObjectIZgu6KjQ48UMYEZj> => this.call('params.get_many', args, timeoutMs),
    /**
    * Set a single ROS parameter, optionally triggering dynamic_reconfigure on the owning node.
    */
    set: async (args: {name: StringDoaGddGA, value: AnyL9Fw4VUO}, timeoutMs?: number): Promise<void> => this.call('params.set', args, timeoutMs),
  };
  schedule = {
    /**
    * List all configured mowing schedules.
    */
    list: async (timeoutMs?: number): Promise<UnorderedSetOfObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL3YLDqReT> => this.call('schedule.list', undefined, timeoutMs),
    /**
    * Insert or update a schedule. The ID is generated server-side when missing.
    */
    upsert: async (args: {schedule: ObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL}, timeoutMs?: number): Promise<ObjectOfObjectOfStringPti3J7ZIString80JIivhsUnorderedSetOfStringLD1FOTDsxWHiLPH4IntegerJYrdHJVi8UKwZM7YObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringU4RlUo3DObjectOfInteger2AHOqbcQNumberHo1ClIqDBpX8Oj7QObjectOfNumberUQNyT7MlNumberTAZyBWjPStringCakJguo4IntegerMTgw1O6ONumberA4WF8D4DBkID9J01StringOIDLIvtlStringDoaGddGAString8HOxumqcString2QvGyGDOStringQhq3HSA0String8AUA9TrYStringAm7XRL52UnorderedSetOfStringDoaGddGA2VviDRzFBooleanVyG3AEThIntegerZ984LTOJUnorderedSetOfInteger2AHOqbcQck4QOpRCVI8JxTyL> => this.call('schedule.upsert', args, timeoutMs),
    /**
    * Remove a schedule by id.
    */
    delete: async (args: {id: StringDoaGddGA}, timeoutMs?: number): Promise<void> => this.call('schedule.delete', args, timeoutMs),
    /**
    * List recent scheduler run outcomes, newest first. Surfaces completions and failures (e.g. an aborted/stuck run) per occurrence so the calendar can annotate days.
    */
    history: async (args: {schedule_id?: StringDoaGddGA, limit?: IntegerOmVsfaNv}, timeoutMs?: number): Promise<UnorderedSetOfObjectOfStringVpQXKS8ZStringVgJsWAxbStringDoaGddGAStringEfOF2TabStringMVRSI8C0StringB7N8MIyAStringIgmTLAHJStringUlYO7V8FUnorderedSetOfInteger2AHOqbcQarZIQlOyLR2TletX3XU5XiEl> => this.call('schedule.history', args, timeoutMs),
  };
  exceptions = {
    /**
    * Get the mowing exceptions: manual blocking days plus the country/region whose public holidays also block mowing.
    */
    get: async (timeoutMs?: number): Promise<ObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjes> => this.call('exceptions.get', undefined, timeoutMs),
    /**
    * Replace the mowing exceptions. Validates the country/region against the holidays database.
    */
    set: async (args: {exceptions: ObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjes}, timeoutMs?: number): Promise<ObjectOfStringTF2N8PAYStringW73LspcZStringPIVdEUDGUnorderedSetOfStringDoaGddGAxIQucMbfUnorderedSetOfObjectOfStringKjcr2O6HStringLfutBJWhUnorderedSetOfStringLD1FOTDsBUsnf7JHF8EEHH5UANpB27CbYGRFtjes> => this.call('exceptions.set', args, timeoutMs),
    /**
    * Resolve the public-holiday names for the configured country/region across a date range, so the calendar can label holiday days.
    */
    holidays: async (args: {from: StringDoaGddGA, to: StringDoaGddGA}, timeoutMs?: number): Promise<ObjectOfUnorderedSetOfObjectOfString9Bg2HXX5StringPlNnRm6UBu0O08MRASXjv8PuDgvnw6C1> => this.call('exceptions.holidays', args, timeoutMs),
  };
  system = {
    /**
    * Restart a whitelisted systemd unit on the mower host.
    */
    restart_service: async (args: {service?: String8MpEGeOy}, timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('system.restart_service', args, timeoutMs),
    /**
    * Reboot the host machine (Raspberry Pi).
    */
    reboot: async (args: {delay_s?: IntegerQDdWfSg7}, timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvG> => this.call('system.reboot', args, timeoutMs),
    /**
    * Read live host metrics: CPU %, RAM, CPU temperature, root-filesystem usage, uptime.
    */
    stats: async (timeoutMs?: number): Promise<ObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvON> => this.call('system.stats', undefined, timeoutMs),
    /**
    * Remove unused Docker images on the host (`docker image prune -af`).
    */
    docker_prune: async (timeoutMs?: number): Promise<ObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7> => this.call('system.docker_prune', undefined, timeoutMs),
  };
  logs = {
    /**
    * Read recent log lines from a node or 'all' sources on the mower host.
    */
    tail: async (args: {source?: StringYKWJZZDp, lines?: IntegerGCqMpUyL}, timeoutMs?: number): Promise<ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N> => this.call('logs.tail', args, timeoutMs),
  };
  telemetry = {
    /**
    * Enumerate recorded mowing telemetry sessions.
    */
    list_sessions: async (timeoutMs?: number): Promise<ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd> => this.call('telemetry.list_sessions', undefined, timeoutMs),
    /**
    * Fetch the recorded telemetry samples for a single mowing session.
    */
    get_session: async (args: {id: StringDoaGddGA, stride?: IntegerOmVsfaNv, offset?: Integer7Bd9WOt2, limit?: IntegerOmVsfaNv}, timeoutMs?: number): Promise<ObjectOfBooleanIvFJCYqvUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDStringMQoP6WbANumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqD78KcflVN1ZllQ8HFCbDvjopC> => this.call('telemetry.get_session', args, timeoutMs),
  };
  imu = {
    /**
    * Treat the mower's current pose as level: derive the IMU mounting roll/pitch and gyro-bias from a 2 s sample window and persist them under ll.services.imu.* via meta.config.set's atomic write pipeline.
    */
    calibrate_level: async (timeoutMs?: number): Promise<ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2> => this.call('imu.calibrate_level', undefined, timeoutMs),
  };
  events = {
    /**
    * List recent lifecycle events from the mower's notification ring buffer.
    */
    list: async (args: {limit?: IntegerN0RpaiaM, since_ts?: Integer7Bd9WOt2, severity_min?: StringIQ4UVKQj, types?: UnorderedSetOfStringDoaGddGADvj0XlFa}, timeoutMs?: number): Promise<ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12> => this.call('events.list', args, timeoutMs),
    /**
    * Mark a single event as acknowledged.
    */
    ack: async (args: {id: StringDoaGddGA}, timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.ack', args, timeoutMs),
    /**
    * Mark every event in the ring buffer as acknowledged.
    */
    ack_all: async (timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.ack_all', undefined, timeoutMs),
    /**
    * Drop every event from the ring buffer and from disk.
    */
    clear: async (timeoutMs?: number): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.clear', undefined, timeoutMs),
  };
  sensors = {
    /**
    * Replay the in-memory sample ring buffer for one sensor (~1 h @ 2 Hz).
    */
    history: async (args: {sensor_id: StringDoaGddGA, since_ts?: Integer7Bd9WOt2, limit?: IntegerVGvI61Gh}, timeoutMs?: number): Promise<ObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5U> => this.call('sensors.history', args, timeoutMs),
    /**
    * Replay history for every sensor with a non-empty ring buffer in one round-trip.
    */
    history_bulk: async (args: {since_ts?: Integer7Bd9WOt2, limit?: IntegerVGvI61Gh}, timeoutMs?: number): Promise<ObjectOfObject8Zf4CCW24GqovvrD> => this.call('sensors.history_bulk', args, timeoutMs),
  };
}
