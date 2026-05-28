// GENERATED FILE, DO NOT EDIT!!!
/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenMowerBaseRpc from './rpc-base';

type AlwaysTrue = any;
export type StringDoaGddGA = string;
/**
 *
 * Generated server-side when omitted.
 *
 */
export type StringAm7XRL52 = string;
export type BooleanVyG3AETh = boolean;
export type Integer2AHOqbcQ = number;
export type UnorderedSetOfInteger2AHOqbcQarZIQlOy = Integer2AHOqbcQ[];
/**
 *
 * iCal RRULE string (FREQ/BYDAY/BYHOUR/BYMINUTE).
 *
 */
export type StringOhDBImii = string;
export type IntegerOmVsfaNv = number;
/**
 *
 * IANA time zone name the rrule is interpreted in (e.g. 'Europe/Vienna'). Defaults to 'UTC' on the server when missing for legacy entries.
 *
 */
export type StringNwgXXEkt = string;
export interface ObjectOfBooleanVyG3AEThF7X7Tx0W {
  skip_if_rain?: BooleanVyG3AETh;
  [k: string]: any;
}
export type NumberHo1ClIqD = number;
export interface ObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6Z {
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
export type String5V2WXAHZ = "no_state" | "emergency" | "not_idle" | "charging" | "rain";
/**
 *
 * Read-only. ISO 8601 timestamp of the most recent skip. Omitted when no skip has been recorded.
 *
 */
export type StringQhq3HSA0 = string;
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
export interface ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2V {
  id?: StringAm7XRL52;
  name: StringDoaGddGA;
  enabled: BooleanVyG3AETh;
  areas: UnorderedSetOfInteger2AHOqbcQarZIQlOy;
  rrule: StringOhDBImii;
  duration_minutes: IntegerOmVsfaNv;
  timezone: StringNwgXXEkt;
  weather?: ObjectOfBooleanVyG3AEThF7X7Tx0W;
  pattern?: ObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6Z;
  next_run?: StringOIDLIvtl;
  last_fired_at?: String8AUA9TrY;
  last_skip_reason?: String5V2WXAHZ;
  last_skip_at?: StringQhq3HSA0;
  [k: string]: any;
}
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
export interface ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbU {
  ts: NumberHo1ClIqD;
  x: NumberHo1ClIqD;
  y: NumberHo1ClIqD;
  yaw?: NumberHo1ClIqD;
  pitch?: NumberHo1ClIqD;
  roll?: NumberHo1ClIqD;
  gps_fix_type?: Integer2AHOqbcQ;
  gps_satellite_count?: Integer2AHOqbcQ;
  gps_pdop?: NumberHo1ClIqD;
  wifi_dbm?: NumberHo1ClIqD;
  wifi_q?: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoE = ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbU[];
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
export type Integer7Bd9WOt2 = number;
export type AnyL9Fw4VUO = any;
export type String8MpEGeOy = "openmower" | "mower_logic" | "xbot_monitoring" | "move_base_flex";
export type IntegerQDdWfSg7 = number;
export type StringYKWJZZDp = "all" | "mower_logic" | "xbot_monitoring" | "mower_scheduler" | "move_base_flex";
export type IntegerGCqMpUyL = number;
export type IntegerN0RpaiaM = number;
export type IntegerVGvI61Gh = number;
export type StringZDJW5SIj = "pong";
export type NullQu0Arl1F = null;
export interface ObjectOfBooleanVyG3AEThIj5UHSfl {
  ok?: BooleanVyG3AETh;
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
export type UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VDBGx4Qeh = ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2V[];
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
export interface ObjectOfBooleanVyG3AEThUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoEPGPQJtX1 {
  samples?: UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoE;
  truncated?: BooleanVyG3AETh;
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
export type AnyOfObjectHAgrRKSzInteger7Bd9WOt2ObjectIZgu6KjQUnorderedSetOfStringDoaGddGADvj0XlFaStringDoaGddGAAnyL9Fw4VUOObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VStringDoaGddGAString8MpEGeOyIntegerQDdWfSg7StringYKWJZZDpIntegerGCqMpUyLStringDoaGddGAIntegerOmVsfaNvIntegerN0RpaiaMInteger7Bd9WOt2StringIQ4UVKQjUnorderedSetOfStringDoaGddGADvj0XlFaStringDoaGddGAStringDoaGddGAInteger7Bd9WOt2IntegerVGvI61GhInteger7Bd9WOt2IntegerVGvI61GhStringZDJW5SIjUnorderedSetOfStringDoaGddGADvj0XlFaNullQu0Arl1FNullQu0Arl1FObjectOfBooleanVyG3AEThIj5UHSflStringZDJW5SIjStringDoaGddGAObjectHicl3T4FObjectBd6DQSjJObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwBObjectOfObjectIZgu6KjQ48UMYEZjNullQu0Arl1FUnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VDBGx4QehObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VNullQu0Arl1FObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvGObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvONObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525NObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69FdObjectOfBooleanVyG3AEThUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoEPGPQJtX1ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12ObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThIj5UHSflObjectOfBooleanVyG3AEThIj5UHSflObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5UObjectOfObject8Zf4CCW24GqovvrD = ObjectHAgrRKSz | Integer7Bd9WOt2 | ObjectIZgu6KjQ | UnorderedSetOfStringDoaGddGADvj0XlFa | StringDoaGddGA | AnyL9Fw4VUO | ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2V | String8MpEGeOy | IntegerQDdWfSg7 | StringYKWJZZDp | IntegerGCqMpUyL | IntegerOmVsfaNv | IntegerN0RpaiaM | StringIQ4UVKQj | IntegerVGvI61Gh | StringZDJW5SIj | NullQu0Arl1F | ObjectOfBooleanVyG3AEThIj5UHSfl | ObjectHicl3T4F | ObjectBd6DQSjJ | ObjectOfUnorderedSetOfStringDoaGddGADvj0XlFaInteger2AHOqbcQUnorderedSetOfObjectOfString9BJAV6BuStringDoaGddGASkKJ8ODFGua3KoaTAuVjlbwB | ObjectOfObjectIZgu6KjQ48UMYEZj | UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VDBGx4Qeh | ObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvG | ObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvON | ObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7 | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd | ObjectOfBooleanVyG3AEThUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoEPGPQJtX1 | ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2 | ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12 | ObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5U | ObjectOfObject8Zf4CCW24GqovvrD;

export class OpenMowerRpc extends OpenMowerBaseRpc {
  rpc = {
    /**
    * Ping the server.
    */
    ping: async (): Promise<StringZDJW5SIj> => this.call('rpc.ping'),
    /**
    * List all available methods.
    */
    methods: async (): Promise<UnorderedSetOfStringDoaGddGADvj0XlFa> => this.call('rpc.methods'),
  };
  map = {
    /**
    * Replace the current map with a new one.
    */
    replace: async (...args: [map: ObjectHAgrRKSz]): Promise<void> => this.call('map.replace', args),
    /**
    * Trigger mowing to start in a specific working area.
    */
    start_in_area: async (args: {area_index: Integer7Bd9WOt2}): Promise<void> => this.call('map.start_in_area', args),
  };
  mower = {
    /**
    * Tell the mower to return to its docking station, regardless of the current state.
    */
    return_home: async (): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('mower.return_home'),
  };
  meta = {
    rpc: {
      /**
      * Ping the meta server.
      */
      ping: async (): Promise<StringZDJW5SIj> => this.call('meta.rpc.ping'),
    },
    config: {
      /**
      * Get the configuration schema.
      */
      schema: async (): Promise<StringDoaGddGA> => this.call('meta.config.schema'),
      /**
      * Get the default configuration values.
      */
      defaults: async (): Promise<ObjectHicl3T4F> => this.call('meta.config.defaults'),
      /**
      * Read the live mower_config.sh as a flat key/value object.
      */
      get: async (): Promise<ObjectBd6DQSjJ> => this.call('meta.config.get'),
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
    get_many: async (args: {names: UnorderedSetOfStringDoaGddGADvj0XlFa}): Promise<ObjectOfObjectIZgu6KjQ48UMYEZj> => this.call('params.get_many', args),
    /**
    * Set a single ROS parameter, optionally triggering dynamic_reconfigure on the owning node.
    */
    set: async (args: {name: StringDoaGddGA, value: AnyL9Fw4VUO}): Promise<void> => this.call('params.set', args),
  };
  schedule = {
    /**
    * List all configured mowing schedules.
    */
    list: async (): Promise<UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2VDBGx4Qeh> => this.call('schedule.list'),
    /**
    * Insert or update a schedule. The ID is generated server-side when missing.
    */
    upsert: async (args: {schedule: ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2V}): Promise<ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WStringNwgXXEktStringOhDBImiiObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringOIDLIvtlStringDoaGddGAString5V2WXAHZStringQhq3HSA0String8AUA9TrYStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyShPpfD2V> => this.call('schedule.upsert', args),
    /**
    * Remove a schedule by id.
    */
    delete: async (args: {id: StringDoaGddGA}): Promise<void> => this.call('schedule.delete', args),
  };
  system = {
    /**
    * Restart a whitelisted systemd unit on the mower host.
    */
    restart_service: async (args: {service?: String8MpEGeOy}): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('system.restart_service', args),
    /**
    * Reboot the host machine (Raspberry Pi).
    */
    reboot: async (args: {delay_s?: IntegerQDdWfSg7}): Promise<ObjectOfBooleanVyG3AEThInteger2AHOqbcQIQdazwvG> => this.call('system.reboot', args),
    /**
    * Read live host metrics: CPU %, RAM, CPU temperature, root-filesystem usage, uptime.
    */
    stats: async (): Promise<ObjectOfNumberHo1ClIqDInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQInteger2AHOqbcQIntegerPspRrr78Integer2AHOqbcQNumberU8K1Uas0NumberP4YjumIFE1QlmvON> => this.call('system.stats'),
    /**
    * Remove unused Docker images on the host (`docker image prune -af`).
    */
    docker_prune: async (): Promise<ObjectOfInteger2AHOqbcQStringDoaGddGABooleanVyG3AEThWJ46RKI7> => this.call('system.docker_prune'),
  };
  logs = {
    /**
    * Read recent log lines from a node or 'all' sources on the mower host.
    */
    tail: async (args: {source?: StringYKWJZZDp, lines?: IntegerGCqMpUyL}): Promise<ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N> => this.call('logs.tail', args),
  };
  telemetry = {
    /**
    * Enumerate recorded mowing telemetry sessions.
    */
    list_sessions: async (): Promise<ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd> => this.call('telemetry.list_sessions'),
    /**
    * Fetch the recorded telemetry samples for a single mowing session.
    */
    get_session: async (args: {id: StringDoaGddGA, stride?: IntegerOmVsfaNv}): Promise<ObjectOfBooleanVyG3AEThUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQ1XQsAsbUKkqlHHoEPGPQJtX1> => this.call('telemetry.get_session', args),
  };
  imu = {
    /**
    * Treat the mower's current pose as level: derive the IMU mounting roll/pitch and gyro-bias from a 2 s sample window and persist them under ll.services.imu.* via meta.config.set's atomic write pipeline.
    */
    calibrate_level: async (): Promise<ObjectOfInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDUnorderedSetOfNumberHo1ClIqDC9YO3FZRObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDBYn6PexVUnorderedSetOfNumberHo1ClIqDC9YO3FZRKRBICRb2> => this.call('imu.calibrate_level'),
  };
  events = {
    /**
    * List recent lifecycle events from the mower's notification ring buffer.
    */
    list: async (args: {limit?: IntegerN0RpaiaM, since_ts?: Integer7Bd9WOt2, severity_min?: StringIQ4UVKQj, types?: UnorderedSetOfStringDoaGddGADvj0XlFa}): Promise<ObjectOfInteger2AHOqbcQUnorderedSetOfObjectOfStringDLUYbyEJIntegerRGdkPNscString836AVxQgStringVd3W2HD3StringIQ4UVKQjString3RwRKkvGObjectWKqX2MzRBooleanC0TIr4AuJMUDeaEERCDBF6Ob2Ihe7M12> => this.call('events.list', args),
    /**
    * Mark a single event as acknowledged.
    */
    ack: async (args: {id: StringDoaGddGA}): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.ack', args),
    /**
    * Mark every event in the ring buffer as acknowledged.
    */
    ack_all: async (): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.ack_all'),
    /**
    * Drop every event from the ring buffer and from disk.
    */
    clear: async (): Promise<ObjectOfBooleanVyG3AEThIj5UHSfl> => this.call('events.clear'),
  };
  sensors = {
    /**
    * Replay the in-memory sample ring buffer for one sensor (~1 h @ 2 Hz).
    */
    history: async (args: {sensor_id: StringDoaGddGA, since_ts?: Integer7Bd9WOt2, limit?: IntegerVGvI61Gh}): Promise<ObjectOfStringDoaGddGAUnorderedSetOfObjectOfNumberHo1ClIqDIntegerSAdpLmxWX6TdOslv3Y9GQJtaGs9BtQ5U> => this.call('sensors.history', args),
    /**
    * Replay history for every sensor with a non-empty ring buffer in one round-trip.
    */
    history_bulk: async (args: {since_ts?: Integer7Bd9WOt2, limit?: IntegerVGvI61Gh}): Promise<ObjectOfObject8Zf4CCW24GqovvrD> => this.call('sensors.history_bulk', args),
  };
}
