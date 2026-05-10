import type {MowerConfig} from '@/components/types';
import {OpenMowerRpc} from '@/lib/rpc';
import {generateId} from '@/utils/area-utils';
import {BSON} from 'bson';
import {immerable} from 'immer';
import mqtt, {MqttClient} from 'mqtt';
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
  mowingTrailSchema,
  plannedPathSchema,
  sensorInfosSchema,
  stateDefaults,
  stateSchema,
  type Capabilities,
  type CoveragePath,
  type MapData,
  type MapOverlay,
  type MowingTrail,
  type PlannedPath,
  type SensorInfo,
  type State,
} from './schemas';
import {pushSensorValue} from './sensorsStore';

export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline';

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

  constructor(config: MowerConfig, mqttClient: MqttClient) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.mqttUrl = config.mqtt_ws_url;
    this.mqttClient = mqttClient;
    this.mqttPrefix = config.mqtt_prefix;
    this.rpc = new OpenMowerRpc(mqttClient, config.mqtt_prefix);
  }

  hasCapability(capability: string, minLevel: number = 1): boolean {
    const level = this.capabilities[capability];
    return level !== undefined && level >= minLevel;
  }

  publishTeleop(vx: number, vz: number) {
    const payload = BSON.serialize({vx, vz});
    this.mqttClient.publish(this.mqttPrefix + 'teleop', Buffer.from(payload.buffer));
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
  loadMowers: () => void;
}

export const useMowersStore = create<MowersStore>()(
  immer((set, get) => ({
    mowers: [],
    mqttStatuses: {},
    selected: 0,
    loadMowers: () => {
      for (const oldMower of get().mowers) {
        oldMower.mqttClient.end();
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
            client.subscribe(clientMower.prefix + 'rpc/response');
          }
        });

        client.on('message', (topic, payload) => {
          const clientMower = clientMowers.find((clientMower) => topic.startsWith(clientMower.prefix));
          if (clientMower !== undefined) {
            const {idx, prefix} = clientMower;
            const partialTopic = topic.substring(prefix.length);
            if (partialTopic === 'robot_state/json') {
              set((state) => {
                state.mowers[idx].state = stateSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'map/json') {
              set((state) => {
                const json = JSON.parse(payload.toString());
                state.mowers[idx].map =
                  'areas' in json ? mapSchema.parse(json) : convertLegacyMap(legacyMapSchema.parse(json));
              });
            } else if (partialTopic === 'rpc/response') {
              mowers[idx].rpc._handleResponse(payload.toString());
            } else if (partialTopic === 'capabilities/json') {
              set((state) => {
                state.mowers[idx].capabilities = capabilitiesSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'actions/json') {
              set((state) => {
                state.mowers[idx].actions = actionsSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'map_overlay/json') {
              set((state) => {
                state.mowers[idx].mapOverlay = mapOverlaySchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'sensor_infos/json') {
              set((state) => {
                state.mowers[idx].sensorInfos = sensorInfosSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'planned_path/json') {
              set((state) => {
                state.mowers[idx].plannedPath = plannedPathSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'coverage_path/json') {
              set((state) => {
                state.mowers[idx].coveragePath = coveragePathSchema.parse(JSON.parse(payload.toString()));
              });
            } else if (partialTopic === 'mowing_trail/json') {
              set((state) => {
                state.mowers[idx].mowingTrail = mowingTrailSchema.parse(JSON.parse(payload.toString()));
              });
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
    },
  })),
);

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
