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

// Older xbot_monitoring builds publish `enabled` as 0/1; current builds emit a
// real boolean. Accept both so the app doesn't break on either.
const looseBoolean = z.union([
  z.boolean(),
  z.literal(0).transform(() => false),
  z.literal(1).transform(() => true),
]);

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
  emergency: numericBoolean,
  gps_percentage: gpsPercentage,
  is_charging: numericBoolean,
  pose: z.object({
    heading: z.number(),
    heading_accuracy: z.number(),
    heading_valid: numericBoolean,
    pos_accuracy: z.number(),
    x: z.number(),
    y: z.number(),
  }),
});

export type State = z.infer<typeof stateSchema>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Map
////////////////////////////////////////////////////////////////////////////////////////////////////

const pointSchema = z.object({x: z.number(), y: z.number()});
const polygonSchema = z.array(pointSchema);
const areaSchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().optional(),
    type: z.enum(['mow', 'nav', 'obstacle', 'draft']).default('draft'),
    active: z.boolean().default(true),
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
  datum: z
    .object({
      lat: z.number(),
      long: z.number(),
      height: z.number(),
    })
    .optional(),
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
  has_min_max: z.boolean().default(false),
  min_value: z.number().default(0),
  max_value: z.number().default(0),
  has_critical_low: z.boolean().default(false),
  lower_critical_value: z.number().default(0),
  has_critical_high: z.boolean().default(false),
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
  datum: z
    .object({
      lat: z.number(),
      long: z.number(),
      height: z.number(),
    })
    .optional(),
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

export const versionSchema = z.object({version: z.string()});
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
// Defaults
////////////////////////////////////////////////////////////////////////////////////////////////////

export const mapDefaults: MapData = {
  datum: undefined,
  areas: [],
  docking_stations: [],
};

export const fallbackDatum = {lat: 48.0, long: 11.0, height: 0} satisfies MapData['datum'];

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
