import {z} from 'zod/v4';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Capabilities
////////////////////////////////////////////////////////////////////////////////////////////////////

// Simple string to unsigned integer map
export const capabilitiesSchema = z.record(z.string(), z.int().gte(1));
export type Capabilities = z.infer<typeof capabilitiesSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Actions
////////////////////////////////////////////////////////////////////////////////////////////////////

// Older xbot_monitoring builds publish `enabled` and the various has_* flags
// as numbers; current builds emit native booleans. Accept any number and treat
// non-zero as true. Restricting this to literal 0 / 1 used to reject the whole
// payload (Zod throws on the union) when stale firmware happened to put a
// garbage bit in a has_* field — losing the entire sensor_infos topic is much
// worse than displaying a slightly off flag.
const looseBoolean = z.union([z.boolean(), z.number().transform((v) => v !== 0)]);

// A telemetry number that tolerates non-finite/garbage from firmware: NaN,
// ±Infinity, a missing field, or an out-of-range value fall back to `fallback`
// instead of throwing. The GNSS/IMU streams arrive several times a second, so a
// single bad field (e.g. hacc/vacc reported as NaN before a fix) must never
// drop the whole sample — z.number() rejects NaN and .default only fills
// `undefined`, so .catch() is the right tool here. Mirrors looseBoolean above.
const looseNumber = (fallback = 0) => z.number().catch(fallback);
// Optional variant: a bad/non-finite value collapses to undefined (shown as
// "—") rather than throwing.
const looseNumberOpt = () => z.number().optional().catch(undefined);
const looseIntOpt = () => z.number().int().optional().catch(undefined);

export const actionSchema = z.object({
  action_id: z.string(),
  action_name: z.string(),
  enabled: looseBoolean.default(true),
});
export const actionsSchema = z.array(actionSchema);
export type Action = z.infer<typeof actionSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////////////////////////////////

const numericBoolean = z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1);
const percentage = z
  .number()
  .min(0)
  .max(1)
  .transform((v) => Math.round(v * 100));

const gpsPercentage = z
  .number()
  .max(1)
  .transform((v) => Math.round(Math.max(0, v) * 100));

export const stateSchema = z.object({
  battery_percentage: percentage,
  current_state: z.string(),
  current_action_progress: z.number(),
  current_area: z.number(),
  current_path: z.number(),
  current_path_index: z.number(),
  current_sub_state: z.string(),
  // robot_state/json bool fields — newer xbot_monitoring builds emit native
  // JSON booleans (nlohmann::json serialises C++ bool that way), older builds
  // historically emitted 0/1. looseBoolean accepts both.
  emergency: looseBoolean,
  gps_percentage: gpsPercentage,
  is_charging: looseBoolean,
  pose: z.object({
    // Pose fields can be null on the wire when GPS just (re)started:
    // xbot_positioning publishes NaN/Inf which nlohmann::json serialises as
    // JSON null. x/y/heading are coerced to 0 because the marker/telemetry
    // surfaces want a concrete number. The accuracy fields stay nullable so
    // the UI can show "—" instead of a misleading "0.0 m" reading.
    heading: z
      .number()
      .nullable()
      .transform((v) => v ?? 0),
    heading_accuracy: z.number().nullable(),
    heading_valid: looseBoolean,
    pos_accuracy: z.number().nullable(),
    x: z
      .number()
      .nullable()
      .transform((v) => v ?? 0),
    y: z
      .number()
      .nullable()
      .transform((v) => v ?? 0),
  }),
  // Backend R9a — extended GPS + WLAN telemetry. All optional so the schema
  // continues to parse on older xbot_monitoring builds that don't publish
  // these fields yet.
  gps_fix_type: z.number().int().min(0).max(5).optional(),
  gps_satellite_count: z.number().int().nonnegative().optional(),
  gps_pdop: z.number().nonnegative().optional(),
  wifi_signal_dbm: z.number().optional(),
  wifi_link_quality: z.number().min(0).max(1).optional(),
  rain_detected: looseBoolean.optional(),
});

export type State = z.infer<typeof stateSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Map
////////////////////////////////////////////////////////////////////////////////////////////////////

export const datumSchema = z.object({
  lat: z.number(),
  long: z.number(),
  height: z.number(),
});
export type Datum = z.infer<typeof datumSchema>;

const pointSchema = z.object({x: z.number(), y: z.number()});
const polygonSchema = z.array(pointSchema);
const areaSchema = z.object({
  id: z.string(),
  properties: z.looseObject({
    name: z.string().optional(),
    type: z.enum(['mow', 'nav', 'obstacle', 'draft']).default('draft'),
    active: z.boolean().default(true),
    // Per-area mowing-parameter overrides (all optional; an absent field falls
    // back to the global config on the mower). These round-trip verbatim
    // through map.replace into the ROS MapArea properties — keep the names and
    // units in sync with mower_map_service.cpp: `angle` is in radians and
    // `fill_type` is the slic3r fill enum int (see area-mow-params.ts for the
    // conversion to the UI's degrees / MowPattern string).
    angle: z.number().optional(),
    fill_type: z.number().int().optional(),
    outline_count: z.number().int().optional(),
    outline_overlap_count: z.number().int().optional(),
    outline_offset: z.number().optional(),
    distance: z.number().optional(),
    speed_mps: z.number().optional(),
  }),
  outline: polygonSchema,
});
export type Area = z.infer<typeof areaSchema>;
export type AreaProps = Area['properties'];
export type AreaType = AreaProps['type'];

const dockingStationSchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().optional(),
    active: z.boolean().default(true),
  }),
  position: pointSchema,
  heading: z.number(),
});

export const mapSchema = z.object({
  datum: datumSchema.optional(),
  areas: z.array(areaSchema),
  docking_stations: z.array(dockingStationSchema),
});

export type MapData = z.infer<typeof mapSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Path overlays (planned, coverage, mowing trail)
////////////////////////////////////////////////////////////////////////////////////////////////////

// All three topics use the same simple {x, y} point shape (in mower-relative
// metres, like Area.outline). The trail is a single long polyline; coverage
// is many short polylines; planned_path is one polyline.
export const plannedPathSchema = z.array(pointSchema).default([]);
export type PlannedPath = z.infer<typeof plannedPathSchema>;

const coverageStripeSchema = z.object({
  points: z.array(pointSchema),
});
export const coveragePathSchema = z.array(coverageStripeSchema).default([]);
export type CoveragePath = z.infer<typeof coveragePathSchema>;

export const mowingTrailSchema = z.array(pointSchema).default([]);
export type MowingTrail = z.infer<typeof mowingTrailSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Sensors
////////////////////////////////////////////////////////////////////////////////////////////////////

// Mirrors xbot_monitoring's publish_sensor_metadata() shape. The C++ code
// either emits a known string or "UNKNOWN" — we accept any string here so
// the UI can fall back gracefully on backends that grow new variants.
const sensorValueTypeSchema = z.string();
const sensorValueDescriptionSchema = z.string();

export const sensorInfoSchema = z.object({
  sensor_id: z.string(),
  sensor_name: z.string().default(''),
  value_type: sensorValueTypeSchema.default('UNKNOWN'),
  value_description: sensorValueDescriptionSchema.default('UNKNOWN'),
  unit: z.string().default(''),
  // Older xbot_monitoring builds publish has_* flags as 0/1 numbers; current
  // builds emit native booleans. looseBoolean accepts both shapes.
  has_min_max: looseBoolean.default(false),
  min_value: z.number().default(0),
  max_value: z.number().default(0),
  has_critical_low: looseBoolean.default(false),
  lower_critical_value: z.number().default(0),
  has_critical_high: looseBoolean.default(false),
  upper_critical_value: z.number().default(0),
});
export const sensorInfosSchema = z.array(sensorInfoSchema);
export type SensorInfo = z.infer<typeof sensorInfoSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Map overlay (transient visualisations like the recording trail)
////////////////////////////////////////////////////////////////////////////////////////////////////

// xbot_msgs/MapOverlayPolygon.msg — color is one of red|green|blue (0|1|2),
// is_closed=1 means the polygon is drawn as a closed ring.
export const overlayColorSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type OverlayColor = z.infer<typeof overlayColorSchema>;

const overlayPolygonSchema = z.object({
  poly: z.array(pointSchema),
  is_closed: z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1),
  line_width: z.number(),
  color: overlayColorSchema,
});
export type OverlayPolygon = z.infer<typeof overlayPolygonSchema>;

export const mapOverlaySchema = z.object({
  polygons: z.array(overlayPolygonSchema).default([]),
});
export type MapOverlay = z.infer<typeof mapOverlaySchema>;

export const mapOverlayDefaults: MapOverlay = {polygons: []};

////////////////////////////////////////////////////////////////////////////////////////////////////
// Legacy map
////////////////////////////////////////////////////////////////////////////////////////////////////

export const legacyAreaSchema = z.object({
  name: z.string(),
  obstacles: z.array(polygonSchema).nullable(),
  outline: polygonSchema,
});

export const legacyMapSchema = z.object({
  datum: datumSchema.optional(),
  docking_pose: z.object({
    heading: z.number().nullable(),
    x: z.number(),
    y: z.number(),
  }),
  meta: z.object({
    mapCenterX: z.number(),
    mapCenterY: z.number(),
    mapHeight: z.number(),
    mapWidth: z.number(),
  }),
  navigation_areas: z.array(legacyAreaSchema).nullable(),
  working_areas: z.array(legacyAreaSchema).nullable(),
});

export type LegacyArea = z.infer<typeof legacyAreaSchema>;
export type LegacyMapData = z.infer<typeof legacyMapSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Backend version info — published retained on <prefix>version/json by xbot_monitoring.
////////////////////////////////////////////////////////////////////////////////////////////////////

// `firmware` is populated once the mainboard has reported its build identifiers
// to mower_comms_v2 (HighLevelService). It is missing for legacy/V1 setups and
// while the STM32 has not yet been claimed.
export const firmwareVersionSchema = z.object({
  git_hash: z.string(),
  build_date: z.string(),
});
export const versionSchema = z.object({
  version: z.string(),
  firmware: firmwareVersionSchema.optional(),
});
export type FirmwareVersionInfo = z.infer<typeof firmwareVersionSchema>;
export type VersionInfo = z.infer<typeof versionSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Mowing sessions (statistics)
////////////////////////////////////////////////////////////////////////////////////////////////////

// Future contract — the backend doesn't publish mowing_sessions/json yet, but
// we wire the subscription + page in advance so it lights up automatically the
// day a session aggregator lands. Fields chosen to match what mowing-history
// UIs in the reference apps display today.
export const mowingSessionSchema = z.object({
  id: z.string(),
  start_ts: z.number(), // epoch seconds
  end_ts: z.number().optional(),
  area_id: z.string().optional(),
  distance_m: z.number().optional(),
  duration_s: z.number().optional(),
  coverage_m2: z.number().optional(),
});
export const mowingSessionsSchema = z.array(mowingSessionSchema);
export type MowingSession = z.infer<typeof mowingSessionSchema>;
export type MowingSessions = z.infer<typeof mowingSessionsSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Notification / Event center
////////////////////////////////////////////////////////////////////////////////////////////////////

// Mirrors xbot_msgs/Event.msg as serialised by xbot_monitoring's events_io
// module. Severity travels as a string on the wire — the C++ side translates
// the uint8 SEVERITY_* constants to "info|warning|error|critical" before
// publishing.
export const eventSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);
export type EventSeverity = z.infer<typeof eventSeveritySchema>;

export const eventSchema = z.object({
  id: z.string(),
  ts_ms: z.number(),
  severity: eventSeveritySchema,
  type: z.string(),
  source: z.string(),
  summary: z.string(),
  // The bridge always emits an object (possibly empty) so the app never has
  // to distinguish "missing" from "empty". Keep additionalProperties open so
  // producers can attach arbitrary structured payloads.
  details: z.record(z.string(), z.unknown()).default({}),
  acked: z.boolean().default(false),
});
export type EventEntry = z.infer<typeof eventSchema>;

export const eventsSnapshotSchema = z.object({
  events: z.array(eventSchema),
  unread: z.number(),
});
export type EventsSnapshot = z.infer<typeof eventsSnapshotSchema>;

// Numeric severity ordering used for the severity_min filter and for
// comparisons (e.g. "fire toast when severity >= warning").
export const eventSeverityRank: Record<EventSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// IMU stream
////////////////////////////////////////////////////////////////////////////////////////////////////

// xbot_monitoring publishes /imu/data (Madgwick-fused) at 30 Hz on
// `<prefix>imu/stream` as a BSON document {d: {ax,ay,az,gx,gy,gz,qw,qx,qy,qz,ts_ms}}.
// The accelerations are m/s^2, angular velocities rad/s, the quaternion is
// the body-to-world rotation in REP-103 conventions (x=fwd, y=left, z=up),
// ts_ms is the message header stamp truncated to wall-clock milliseconds.
export const imuSampleSchema = z.object({
  // Loose numbers: a single NaN/Inf glitch from the IMU must not drop the whole
  // ~30 Hz sample (which would freeze the 3D view). A zero-ed axis for one frame
  // is far less disruptive than a missing sample.
  ax: looseNumber(0),
  ay: looseNumber(0),
  az: looseNumber(0),
  gx: looseNumber(0),
  gy: looseNumber(0),
  gz: looseNumber(0),
  qw: looseNumber(0),
  qx: looseNumber(0),
  qy: looseNumber(0),
  qz: looseNumber(0),
  // Strict: an unstamped sample can't be ordered, so dropping it is correct.
  ts_ms: z.number(),
});
export type ImuSample = z.infer<typeof imuSampleSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// GNSS detail (per-satellite diagnostics)
////////////////////////////////////////////////////////////////////////////////////////////////////

// xbot_monitoring publishes per-satellite GNSS diagnostics on `<prefix>gnss/stream`
// as a BSON document {d: {...}} (see gnss_detail_callback). Short keys keep the
// ~30-row satellite array compact on the WebSocket. Every field is tolerant of
// being absent so the page keeps parsing on firmware that predates a field.

// One tracked signal. gnss_id follows the u-blox convention
// (0 GPS, 1 SBAS, 2 Galileo, 3 BeiDou, 5 QZSS, 6 GLONASS, 255 unknown);
// band is normalized (1 = L1/E1/B1, 2 = L2/B2I, 5 = L5/E5/B2a, 0 = unknown).
export const satelliteSchema = z.object({
  g: z.number().int().catch(255), // gnss_id (255 unknown)
  s: z.number().int().catch(0), // sv_id
  c: looseNumber(0), // C/N0 in dB-Hz
  b: z.number().int().catch(0), // band
  e: looseNumber(-128), // elevation deg (-128 unknown)
  a: looseNumber(-1), // azimuth deg (-1 unknown)
  u: looseBoolean.default(false), // used in fix
  hl: looseBoolean.default(true), // healthy
});
export type GnssSatellite = z.infer<typeof satelliteSchema>;

const dopSchema = z.object({
  g: looseNumber(0),
  p: looseNumber(0),
  h: looseNumber(0),
  v: looseNumber(0),
  t: looseNumber(0),
});

export const gnssSampleSchema = z.object({
  // Every numeric field is loose: the firmware legitimately emits NaN (e.g.
  // hacc/vacc before a fix), and one NaN must not drop the whole ~4 Hz sample.
  ft: z.number().int().min(0).max(5).catch(0), // fix_type
  rtk: z.number().int().catch(0), // 0 none, 1 float, 2 fixed
  used: looseNumber(0), // sats used in fix
  vis: looseNumber(0), // sats visible
  dop: dopSchema.default({g: 0, p: 0, h: 0, v: 0, t: 0}),
  hacc: looseNumber(0), // horizontal accuracy (m)
  vacc: looseNumber(0), // vertical accuracy (m)
  lat: looseNumber(0),
  lon: looseNumber(0),
  h: looseNumber(0), // height (m)
  ve: looseNumber(0), // velocity ENU (m/s)
  vn: looseNumber(0),
  vu: looseNumber(0),
  vh: looseNumber(0), // vehicle heading (rad)
  mh: looseNumber(0), // motion heading (rad)
  age: looseNumber(0), // RTCM correction age (s); 0 when not reported
  // UM982 / Unicore detail. Optional so the page keeps parsing on firmware
  // that doesn't send them yet (they read as undefined → shown as "—").
  base: looseNumberOpt(), // dual-antenna baseline length (m)
  sol: looseIntOpt(), // solution status: 0 none,1 single,2 DGPS,3 float,4 fixed
  hacc_hdg: looseNumberOpt(), // heading accuracy / stddev (deg)
  cutoff: looseNumberOpt(), // enforced elevation cutoff mask (deg); -1 = not reported
  agc: z.array(looseNumber(0)).optional(), // per-antenna AGC: ANT1 [0..4], ANT2 [5..9]; -1 = unused band
  jam: z.array(looseNumber(0)).optional(), // jamming: [cw_ratio 0..255, cw_flag 0/1/2]
  // Strict: a sample without a valid timestamp can't be ordered in the ring, so
  // dropping it is the correct behaviour.
  ts_ms: z.number(),
  sats: z.array(satelliteSchema).default([]),
});
export type GnssSample = z.infer<typeof gnssSampleSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Battery / BMS telemetry
////////////////////////////////////////////////////////////////////////////////////////////////////

// xbot_monitoring publishes the merged BMS + charger snapshot on `<prefix>bms/json`
// at ~1 Hz, and the same shape is returned by the battery.get_telemetry RPC.
// Every field is optional so the schema parses on all platforms: only a smart
// BMS (e.g. the Sabo FSM-BMZ pack) fills the per-cell / capacity / cycle data
// (`present` is then true); the charger fields come from /ll/power and exist on
// every V2 platform. When nothing has reported yet the payload is just
// {present:false}. `battery_status` is the human-readable comma-joined flag
// string produced by mower_comms_v2's BmsServiceInterface, not a raw bitmask.
export const bmsTelemetrySchema = z.object({
  present: z.boolean().default(false),
  ts_ms: z.number().optional(),
  // Pack scalars (from mower_msgs/Bms).
  voltage: z.number().optional(),
  current: z.number().optional(), // +charge / -discharge
  relative_state_of_charge: z.number().optional(), // 0..1
  remaining_capacity: z.number().optional(), // Ah
  full_charge_capacity: z.number().optional(), // Ah
  cycle_count: z.number().int().optional(),
  temperature: z.number().optional(), // deg.C
  battery_status: z.string().optional(),
  // From the firmware Extra Data JSON (smart BMS only).
  mfr_name: z.string().optional(),
  mfr_date: z.string().optional(),
  dev_name: z.string().optional(),
  dev_version: z.string().optional(),
  dev_chemistry: z.string().optional(),
  serial_number: z.number().optional(),
  design_capacity_ah: z.number().optional(),
  design_voltage_v: z.number().optional(),
  absolute_soc: z.number().optional(), // 0..1, relative to design capacity (SoH hint)
  cell_count: z.number().int().optional(),
  cell_voltage_v: z.array(z.number()).optional(),
  // Charger fields (from mower_msgs/Power) — present on every V2 platform.
  charge_voltage: z.number().optional(),
  charge_current: z.number().optional(),
  battery_voltage: z.number().optional(),
  battery_pct: z.number().optional(), // 0..1
  charger_status: z.string().optional(),
  charger_enabled: looseBoolean.optional(),
  dcdc_input_current: z.number().optional(),
  charger_input_current: z.number().optional(),
});
export type BmsTelemetry = z.infer<typeof bmsTelemetrySchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Defaults
////////////////////////////////////////////////////////////////////////////////////////////////////

export const mapDefaults: MapData = {
  datum: undefined,
  areas: [],
  docking_stations: [],
};

export const fallbackDatum = {lat: 48.0, long: 11.0, height: 0} satisfies Datum;

export const stateDefaults: State = {
  battery_percentage: 100,
  current_action_progress: 0.0,
  current_area: -1,
  current_path: -1,
  current_path_index: -1,
  current_state: 'UNKNOWN',
  current_sub_state: '',
  emergency: false,
  gps_percentage: 0.0,
  is_charging: false,
  pose: {
    heading: 0,
    heading_accuracy: 0,
    heading_valid: false,
    pos_accuracy: 0,
    x: 0,
    y: 0,
  },
};
