// GENERATED FILE, DO NOT EDIT!!!
/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenMowerBaseRpc from './rpc-base';

type AlwaysTrue = any;
/**
 *
 * Generated server-side when omitted.
 *
 */
export type StringAm7XRL52 = string;
export type StringDoaGddGA = string;
export type BooleanVyG3AETh = boolean;
export type Integer2AHOqbcQ = number;
export type UnorderedSetOfInteger2AHOqbcQarZIQlOy = Integer2AHOqbcQ[];
/**
 *
 * iCal RRULE string.
 *
 */
export type String8H9Rc1RD = string;
export type IntegerOmVsfaNv = number;
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
 * Content of a YAML file as a string
 *
 */
export type StringXJCrhoiv = string;
export interface ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7W {
  id?: StringAm7XRL52;
  name: StringDoaGddGA;
  enabled: BooleanVyG3AETh;
  areas: UnorderedSetOfInteger2AHOqbcQarZIQlOy;
  rrule: String8H9Rc1RD;
  duration_minutes: IntegerOmVsfaNv;
  weather?: ObjectOfBooleanVyG3AEThF7X7Tx0W;
  pattern?: ObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6Z;
  [k: string]: any;
}
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
export interface ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmn {
  ts: NumberHo1ClIqD;
  x: NumberHo1ClIqD;
  y: NumberHo1ClIqD;
  yaw?: NumberHo1ClIqD;
  pitch?: NumberHo1ClIqD;
  roll?: NumberHo1ClIqD;
  gps_fix_type?: Integer2AHOqbcQ;
  gps_satellite_count?: Integer2AHOqbcQ;
  gps_hdop?: NumberHo1ClIqD;
  wifi_dbm?: NumberHo1ClIqD;
  wifi_q?: NumberHo1ClIqD;
  mow_motor_current?: NumberHo1ClIqD;
  mow_motor_temp?: NumberHo1ClIqD;
  esc_temp?: NumberHo1ClIqD;
  battery_voltage?: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJ = ObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmn[];
export interface ObjectHAgrRKSz { [key: string]: any; }
export type Integer7Bd9WOt2 = number;
export interface ObjectIZgu6KjQ { [key: string]: any; }
export type AnyL9Fw4VUO = any;
export type String8MpEGeOy = "openmower" | "mower_logic" | "xbot_monitoring" | "move_base_flex";
export type StringYKWJZZDp = "all" | "mower_logic" | "xbot_monitoring" | "mower_scheduler" | "move_base_flex";
export type IntegerGCqMpUyL = number;
export type StringZDJW5SIj = "pong";
export type UnorderedSetOfStringDoaGddGADvj0XlFa = StringDoaGddGA[];
export type NullQu0Arl1F = null;
/**
 *
 * Keys are relative file paths, values are YAML file contents as strings
 *
 */
export interface ObjectHicl3T4F { [key: string]: any; }
export interface ObjectBd6DQSjJ { [key: string]: any; }
export interface ObjectOfInteger2AHOqbcQNWXhIVnt {
  updated?: Integer2AHOqbcQ;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WxdXUsec0 = ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7W[];
export interface ObjectOfBooleanVyG3AEThIj5UHSfl {
  ok?: BooleanVyG3AETh;
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
export interface ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJEbEy6YC6 {
  samples?: UnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJ;
  [k: string]: any;
}
/**
 *
 * Generated! Represents an alias to any of the provided schemas
 *
 */
export type AnyOfObjectHAgrRKSzInteger7Bd9WOt2ObjectIZgu6KjQStringDoaGddGAAnyL9Fw4VUOObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WStringDoaGddGAString8MpEGeOyStringYKWJZZDpIntegerGCqMpUyLStringDoaGddGAIntegerOmVsfaNvStringZDJW5SIjUnorderedSetOfStringDoaGddGADvj0XlFaNullQu0Arl1FNullQu0Arl1FStringZDJW5SIjStringDoaGddGAObjectHicl3T4FObjectBd6DQSjJObjectOfInteger2AHOqbcQNWXhIVntNullQu0Arl1FUnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WxdXUsec0ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WNullQu0Arl1FObjectOfBooleanVyG3AEThIj5UHSflObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525NObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69FdObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJEbEy6YC6 = ObjectHAgrRKSz | Integer7Bd9WOt2 | ObjectIZgu6KjQ | StringDoaGddGA | AnyL9Fw4VUO | ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7W | String8MpEGeOy | StringYKWJZZDp | IntegerGCqMpUyL | IntegerOmVsfaNv | StringZDJW5SIj | UnorderedSetOfStringDoaGddGADvj0XlFa | NullQu0Arl1F | ObjectHicl3T4F | ObjectBd6DQSjJ | ObjectOfInteger2AHOqbcQNWXhIVnt | UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WxdXUsec0 | ObjectOfBooleanVyG3AEThIj5UHSfl | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBStringDoaGddGAStringDoaGddGAStringSkVxiS6EYfecu46YPnkCtRjyCwlY525N | ObjectOfUnorderedSetOfObjectOfNumberCxGOTzvBInteger2AHOqbcQStringDoaGddGAInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDQ1YTyTgxEuFQMiZQWVpN69Fd | ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJEbEy6YC6;

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
      set: async (...args: [changes: ObjectIZgu6KjQ]): Promise<ObjectOfInteger2AHOqbcQNWXhIVnt> => this.call('meta.config.set', args),
    },
  };
  params = {
    /**
    * Set a single ROS parameter, optionally triggering dynamic_reconfigure on the owning node.
    */
    set: async (args: {name: StringDoaGddGA, value: AnyL9Fw4VUO}): Promise<void> => this.call('params.set', args),
  };
  schedule = {
    /**
    * List all configured mowing schedules.
    */
    list: async (): Promise<UnorderedSetOfObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7WxdXUsec0> => this.call('schedule.list'),
    /**
    * Insert or update a schedule. The ID is generated server-side when missing.
    */
    upsert: async (args: {schedule: ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7W}): Promise<ObjectOfObjectOfBooleanVyG3AEThF7X7Tx0WString8H9Rc1RDObjectOfInteger2AHOqbcQNumberHo1ClIqDGDk4KF6ZStringDoaGddGAStringAm7XRL52BooleanVyG3AEThIntegerOmVsfaNvUnorderedSetOfInteger2AHOqbcQarZIQlOyUR72Vd7W> => this.call('schedule.upsert', args),
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
    get_session: async (args: {id: StringDoaGddGA, stride?: IntegerOmVsfaNv}): Promise<ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDInteger2AHOqbcQNumberHo1ClIqDNumberHo1ClIqDYpsgGWmnL6XZ3QwJEbEy6YC6> => this.call('telemetry.get_session', args),
  };
}
