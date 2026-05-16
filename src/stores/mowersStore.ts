import type {MowerConfig} from '@/components/types';
import {OpenMowerRpc} from '@/lib/rpc';
import {hostFromMqttUrl, TeleopSocket} from '@/lib/teleopSocket';
import {generateId} from '@/utils/area-utils';
import {immerable} from 'immer';
import mqtt, {MqttClient} from 'mqtt';
import {useMemo} from 'react';
import {create, useStore} from 'zustand';
import {immer} from 'zustand/middleware/immer';
import {useConfigStore} from './configStore';
import {
  Action,
  actionsSchema,
  Area,
  AreaType,
  capabilitiesSchema,
  coveragePathSchema,
  LegacyArea,
  LegacyMapData,
  legacyMapSchema,
  mapDefaults,
  mapOverlayDefaults,
  mapOverlaySchema,
  mapSchema,
  mowingSessionsSchema,
  mowingTrailSchema,
  plannedPathSchema,
  sensorInfosSchema,
  versionSchema,
  stateDefaults,
  stateSchema,
  type Capabilities,
  type CoveragePath,
  type MapData,
  type MapOverlay,
  type MowingSessions,
  type MowingTrail,
  type PlannedPath,
  type SensorInfo,
  type State,
  type VersionInfo,
} from './schemas';
import {useDatumCacheStore} from './datumCacheStore';
import {pushSensorValue} from './sensorsStore';

export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline';

// Topics the dashboard depends on for "is the mower alive?". Tracked
// separately from arbitrary topic subscriptions so the connection banner
// surfaces only the things the user actually waits for.
// Topic spec — `live: false` means the topic is published retained on change
// only (e.g. capabilities, map, actions). For those we only care if the
// payload ever arrived (presence check); we don't track staleness because
// silence is normal. `live: true` topics publish at ~1Hz and stale-detection
// is meaningful.
export interface TopicSpec {
  topic: string;
  live: boolean;
}

export const EXPECTED_TOPICS: readonly TopicSpec[] = [
  {topic: 'capabilities/json', live: false},
  {topic: 'robot_state/json', live: true},
  {topic: 'map/json', live: false},
  {topic: 'actions/json', live: false},
  {topic: 'sensor_infos/json', live: false},
] as const;

export type ExpectedTopic = (typeof EXPECTED_TOPICS)[number]['topic'];

// 10 seconds without a topic update on a connected broker counts as stale —
// matches the typical 1Hz publish cadence of the live ROS bridges with
// comfortable headroom. Only applied to topics with `live: true`.
const STALE_THRESHOLD_MS = 10_000;

class Mower {
  [immerable] = true;

  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly mqttUrl: string;
  readonly mqttClient: MqttClient;
  readonly mqttPrefix: string;
  readonly rpc: OpenMowerRpc;
  capabilities: Capabilities = {};
  state: State = stateDefaults;
  map: MapData = mapDefaults;
  mapOverlay: MapOverlay = mapOverlayDefaults;
  actions: Action[] = [];
  sensorInfos: SensorInfo[] = [];
  plannedPath: PlannedPath = [];
  coveragePath: CoveragePath = [];
  mowingTrail: MowingTrail = [];
  // Optional. Backend may never publish mowing_sessions/json — the Statistics
  // page handles the empty case gracefully.
  mowingSessions: MowingSessions = [];
  // Backend version published retained on version/json. Null until the first
  // payload arrives (older deployments may not publish at all).
  versionInfo: VersionInfo | null = null;
  // Map of partial topic ('robot_state/json' etc.) -> Date.now() when the
  // most recent payload arrived. Stays empty until the first message lands.
  lastSeen: Record<string, number> = {};
  // xbot_remote takes joystick output via a separate WebSocket on :9002 — the
  // MQTT teleop topic that ships with xbot_monitoring is not wired through to
  // mower_logic, so MQTT teleop never moves the mower. The legacy Flutter app
  // uses the same WebSocket path. Created lazily per mower in loadMowers().
  teleopSocket: TeleopSocket | null = null;

  constructor(config: MowerConfig, mqttClient: MqttClient) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.mqttUrl = config.mqtt_ws_url;
    this.mqttClient = mqttClient;
    this.mqttPrefix = config.mqtt_prefix;
    this.rpc = new OpenMowerRpc(mqttClient, config.mqtt_prefix);
    const host = hostFromMqttUrl(config.mqtt_ws_url);
    this.teleopSocket = host ? new TeleopSocket(host) : null;
  }

  hasCapability(capability: string, minLevel: number = 1): boolean {
    const level = this.capabilities[capability];
    return level !== undefined && level >= minLevel;
  }

  publishTeleop(vx: number, vz: number) {
    this.teleopSocket?.send(vx, vz);
  }

  // Sends an action_id to the mower. The ROS xbot_monitoring node forwards it
  // to the action publisher. Action IDs come from the actions/json topic and
  // are formatted "<node_prefix>/<action_id>" (e.g. "mower_logic/start_mowing").
  publishAction(actionId: string) {
    this.mqttClient.publish(this.mqttPrefix + 'action', actionId);
  }

  isActionEnabled(actionId: string): boolean {
    return this.actions.some((a) => a.action_id === actionId && a.enabled);
  }
}

interface MowersStore {
  mowers: Mower[];
  mqttStatuses: Record<string, MqttStatus>;
  selected: number;
  // Monotonically incremented every 2s while at least one mower is loaded.
  // Components that need to re-render when topic ages cross thresholds
  // subscribe to this value via useConnectionDiagnostic.
  lastSeenTick: number;
  loadMowers: () => void;
}

// Singleton interval handle so loadMowers() never spawns more than one
// liveness ticker even if the user reloads config while the app is open.
let liveTickHandle: ReturnType<typeof setInterval> | null = null;

export const useMowersStore = create<MowersStore>()(
  immer((set, get) => ({
    mowers: [],
    mqttStatuses: {},
    selected: 0,
    lastSeenTick: 0,
    loadMowers: () => {
      for (const oldMower of get().mowers) {
        oldMower.mqttClient.end();
      }
      if (liveTickHandle) {
        clearInterval(liveTickHandle);
        liveTickHandle = null;
      }

      const mowers: Mower[] = [];
      const mowerConfigs = useConfigStore.getState().config.mowers;
      const urls = [...new Set(mowerConfigs.map((config) => config.mqtt_ws_url))];
      for (const url of urls) {
        const urlObj = new URL(url);
        const client = mqtt.connect(url, {
          username: urlObj.username,
          password: urlObj.password,
          clean: true,
        });
        const clientMowers: {prefix: string; idx: number}[] = [];
        for (const config of mowerConfigs) {
          if (config.mqtt_ws_url === url) {
            const mower = new Mower(config, client);
            mowers.push(mower);
            clientMowers.push({prefix: mower.mqttPrefix, idx: mowers.length - 1});
          }
        }

        const setMqttStatus = (status: MqttStatus) => {
          set((state) => {
            for (const clientMower of clientMowers) {
              state.mqttStatuses[mowers[clientMower.idx].id] = status;
            }
          });
        };

        client.on('error', () => {
          setMqttStatus('disconnected');
        });

        client.on('close', () => {
          setMqttStatus('disconnected');
        });

        client.on('offline', () => {
          setMqttStatus('offline');
        });

        client.on('reconnect', () => {
          setMqttStatus('reconnecting');
        });

        client.on('connect', () => {
          setMqttStatus('connected');
          for (const clientMower of clientMowers) {
            client.subscribe(clientMower.prefix + 'capabilities/json');
            client.subscribe(clientMower.prefix + 'robot_state/json');
            client.subscribe(clientMower.prefix + 'map/json');
            client.subscribe(clientMower.prefix + 'map_overlay/json');
            client.subscribe(clientMower.prefix + 'actions/json');
            client.subscribe(clientMower.prefix + 'sensor_infos/json');
            client.subscribe(clientMower.prefix + 'sensors/+/data');
            client.subscribe(clientMower.prefix + 'planned_path/json');
            client.subscribe(clientMower.prefix + 'coverage_path/json');
            client.subscribe(clientMower.prefix + 'mowing_trail/json');
            client.subscribe(clientMower.prefix + 'mowing_sessions/json');
            client.subscribe(clientMower.prefix + 'version/json');
            client.subscribe(clientMower.prefix + 'rpc/response');
          }
          // The map/json topic doesn't carry the GPS datum (mower_map_service
          // omits it), so pull it from the live ROS-param-backed config. We
          // populate the persisted datum cache so satellite/OSM/hybrid styles
          // can position tiles correctly even on the first connect.
          for (const clientMower of clientMowers) {
            const mower = mowers[clientMower.idx];
            mower.rpc.meta.config
              .get()
              .then((cfg) => {
                const cfgMap = cfg as unknown as Record<string, string>;
                const lat = parseFloat(cfgMap.OM_DATUM_LAT);
                const long = parseFloat(cfgMap.OM_DATUM_LONG);
                const heightRaw = cfgMap.OM_DATUM_HEIGHT;
                const height = heightRaw ? parseFloat(heightRaw) : 0;
                if (Number.isFinite(lat) && Number.isFinite(long) && (lat !== 0 || long !== 0)) {
                  useDatumCacheStore.getState().setDatum(mower.id, {lat, long, height});
                }
              })
              .catch((e) => console.warn('[mowersStore] meta.config.get failed:', e));
          }
        });

        client.on('message', (topic, payload) => {
          const clientMower = clientMowers.find((clientMower) => topic.startsWith(clientMower.prefix));
          if (clientMower !== undefined) {
            const {idx, prefix} = clientMower;
            const partialTopic = topic.substring(prefix.length);
            // Wildcard sensor topics share a bucket — anything matching
            // sensors/<id>/data counts as 'sensors/data' in lastSeen so the
            // diagnostics view doesn't grow per-sensor.
            const seenKey = partialTopic.startsWith('sensors/') && partialTopic.endsWith('/data')
              ? 'sensors/data'
              : partialTopic;
            // Always stamp lastSeen first — if zod parsing throws below we
            // still know the mower is publishing on this topic, just with a
            // schema mismatch (which is a backend bug, not a connectivity one).
            set((state) => {
              state.mowers[idx].lastSeen[seenKey] = Date.now();
            });
            // Wrap every schema-parse in try/catch. A single mismatch (older
            // backends that don't match the current schemas — e.g. numeric
            // booleans where a `bool` is expected) used to throw out of the
            // immer producer, leaving the store unchanged AND the page with an
            // unhandled rejection. Now we log a warning and move on; the
            // affected topic just stays at its previous value.
            if (partialTopic === 'robot_state/json') {
              try {
                const parsed = stateSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].state = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] robot_state/json parse failed:', e);
              }
            } else if (partialTopic === 'map/json') {
              try {
                const json = JSON.parse(payload.toString());
                const parsed = 'areas' in json ? mapSchema.parse(json) : convertLegacyMap(legacyMapSchema.parse(json));
                if (parsed.datum) {
                  useDatumCacheStore.getState().setDatum(mowers[idx].id, parsed.datum);
                }
                set((state) => {
                  state.mowers[idx].map = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] map/json parse failed:', e);
              }
            } else if (partialTopic === 'rpc/response') {
              mowers[idx].rpc._handleResponse(payload.toString());
            } else if (partialTopic === 'capabilities/json') {
              try {
                const parsed = capabilitiesSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].capabilities = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] capabilities/json parse failed:', e);
              }
            } else if (partialTopic === 'actions/json') {
              try {
                const parsed = actionsSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].actions = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] actions/json parse failed:', e);
              }
            } else if (partialTopic === 'map_overlay/json') {
              try {
                const parsed = mapOverlaySchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].mapOverlay = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] map_overlay/json parse failed:', e);
              }
            } else if (partialTopic === 'sensor_infos/json') {
              try {
                const parsed = sensorInfosSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].sensorInfos = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] sensor_infos/json parse failed:', e);
              }
            } else if (partialTopic === 'planned_path/json') {
              try {
                const parsed = plannedPathSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].plannedPath = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] planned_path/json parse failed:', e);
              }
            } else if (partialTopic === 'coverage_path/json') {
              try {
                const parsed = coveragePathSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].coveragePath = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] coverage_path/json parse failed:', e);
              }
            } else if (partialTopic === 'mowing_trail/json') {
              try {
                const parsed = mowingTrailSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].mowingTrail = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] mowing_trail/json parse failed:', e);
              }
            } else if (partialTopic === 'version/json') {
              try {
                const parsed = versionSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].versionInfo = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] version/json parse failed:', e);
              }
            } else if (partialTopic === 'mowing_sessions/json') {
              // Future-only topic — tolerate empty/unexpected payloads so
              // experimental backends can publish minimal data without
              // breaking the UI.
              try {
                const parsed = mowingSessionsSchema.parse(JSON.parse(payload.toString()));
                set((state) => {
                  state.mowers[idx].mowingSessions = parsed;
                });
              } catch (e) {
                console.warn('[mowersStore] mowing_sessions/json parse failed:', e);
              }
            } else if (partialTopic.startsWith('sensors/') && partialTopic.endsWith('/data')) {
              // sensors/<id>/data is plaintext: a stringified number for DOUBLE
              // sensors, a free string for STRING sensors. The high-frequency
              // values land in a separate store so they don't trigger
              // re-renders for unrelated UI.
              const sensorId = partialTopic.slice('sensors/'.length, -'/data'.length);
              const mowerId = mowers[idx].id;
              pushSensorValue(mowerId, sensorId, payload.toString());
            }
          }
        });
      }
      set({mowers, selected: 0});
      // 2s tick — coarse enough to avoid render churn, fine enough that the
      // banner reacts within ~12s of a backend going silent.
      if (mowers.length > 0) {
        liveTickHandle = setInterval(() => {
          set((state) => {
            state.lastSeenTick++;
          });
        }, 2000);
      }
    },
  })),
);

export interface ConnectionDiagnostic {
  status: 'no-mower' | 'no-broker' | 'connecting' | 'no-topics' | 'stale' | 'ok';
  mqttStatus: MqttStatus | undefined;
  mqttUrl: string;
  mqttPrefix: string;
  /** Topics in EXPECTED_TOPICS that have never been seen. */
  missingTopics: ExpectedTopic[];
  /** Topics that arrived once but are now older than STALE_THRESHOLD_MS. */
  staleTopics: {topic: ExpectedTopic; ageMs: number}[];
}

// Diagnostic selector for the currently-selected mower. Returns a structured
// object instead of pushing fallback strings to UI components — so the banner
// can render specific guidance ("topic X missing"), not vague placeholders.
//
// IMPORTANT: subscribe to *individual* slices and assemble the diagnostic in
// useMemo. Building the object inside a single zustand selector returns a new
// reference on every call, which makes useSyncExternalStore see "changed
// snapshot" forever and crash with "Maximum update depth exceeded".
export function useConnectionDiagnostic(): ConnectionDiagnostic {
  const mower = useMowersStore((s) => s.mowers[s.selected]);
  const mqttStatus = useMowersStore((s) => (mower ? s.mqttStatuses[mower.id] : undefined));
  // Tick is consumed only to force a re-evaluation every 2s so stale-topic
  // detection doesn't freeze. The numeric value itself feeds into the deps
  // array below and re-triggers the memo.
  const tick = useMowersStore((s) => s.lastSeenTick);
  // Snapshot the lastSeen map by reference — the immer middleware swaps it on
  // every mutation, so referential equality is the right invalidation signal.
  const lastSeen = mower?.lastSeen;

  return useMemo<ConnectionDiagnostic>(() => {
    if (!mower) {
      return {
        status: 'no-mower',
        mqttStatus,
        mqttUrl: '',
        mqttPrefix: '',
        missingTopics: [],
        staleTopics: [],
      };
    }
    const now = Date.now();
    const missing: ExpectedTopic[] = [];
    const stale: {topic: ExpectedTopic; ageMs: number}[] = [];
    for (const spec of EXPECTED_TOPICS) {
      const seen = lastSeen?.[spec.topic];
      if (seen === undefined) {
        missing.push(spec.topic);
      } else if (spec.live && now - seen > STALE_THRESHOLD_MS) {
        // Retained topics (live: false) publish on change only — silence is
        // normal, so we never flag them as stale once the initial payload
        // arrived.
        stale.push({topic: spec.topic, ageMs: now - seen});
      }
    }
    let status: ConnectionDiagnostic['status'];
    if (mqttStatus === 'disconnected' || mqttStatus === 'offline') status = 'no-broker';
    else if (mqttStatus === 'connecting' || mqttStatus === 'reconnecting') status = 'connecting';
    else if (missing.length === EXPECTED_TOPICS.length) status = 'no-topics';
    else if (missing.length > 0 || stale.length > 0) status = 'stale';
    else status = 'ok';
    return {
      status,
      mqttStatus,
      mqttUrl: mower.mqttUrl,
      mqttPrefix: mower.mqttPrefix,
      missingTopics: missing,
      staleTopics: stale,
    };
    // tick is intentionally a dependency so we re-evaluate stale-thresholds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mower, lastSeen, mqttStatus, tick]);
}

const convertLegacyMap = (legacy: LegacyMapData) => ({
  datum: legacy.datum,
  areas: [
    ...convertLegacyAreas(legacy.working_areas ?? [], 'mow', 'Working Area'),
    ...convertLegacyAreas(legacy.navigation_areas ?? [], 'nav', 'Navigation Area'),
  ],
  docking_stations: legacy.docking_pose.heading === null ? [] : [convertLegacyDockingStation(legacy.docking_pose)],
});

const convertLegacyAreas = (areas: LegacyArea[], type: AreaType, prefix: string): Area[] =>
  areas.flatMap((area, idx) => [
    {
      id: generateId(),
      properties: {
        name: area.name === '' ? `${prefix} ${idx}` : area.name,
        type: type,
        active: true,
      },
      outline: area.outline,
    },
    ...(area.obstacles ?? []).map((obstacle) => ({
      id: generateId(),
      properties: {
        name: 'Obstacle',
        type: 'obstacle' as const,
        active: true,
      },
      outline: obstacle,
    })),
  ]);

const convertLegacyDockingStation = (docking_pose: LegacyMapData['docking_pose']) => ({
  id: generateId(),
  properties: {
    name: 'Docking station',
    active: true,
  },
  position: {x: docking_pose.x, y: docking_pose.y},
  heading: docking_pose.heading!,
});

export const useMowers = () => {
  // FIXME - this is a hack to get the mowers from the store
  const mowers = useMowersStore((s) => s.mowers);
  return mowers;
};

const identity = <T>(arg: T): T => arg;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSelectedMower<StateSlice>(selector: (state?: Mower) => StateSlice = identity as any) {
  return useStore(useMowersStore, (s) => selector(s.mowers[s.selected]));
}
