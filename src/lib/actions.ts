'use server';

import {AppConfig} from '@/components/types';
import {promises as fs} from 'fs';
import {headers} from 'next/headers';
import path from 'path';

const configPath = path.join(process.cwd(), 'config.json');

async function loadConfigFromEnv(): Promise<AppConfig | null> {
  const name = process.env.MOWER_NAME ?? 'OpenMower';
  const host = (await headers()).get('host') ?? 'localhost';
  const hostname = host.split(':')[0];
  const mqtt_ws_url = process.env.MOWER_MQTT_WS_URL ?? `ws://${hostname}:9001`;
  const mqtt_prefix = process.env.MOWER_MQTT_PREFIX ?? '';
  const camera_url = process.env.MOWER_CAMERA_URL ?? '';
  // Opt-in: leave both unset and the Drive page hides the camera card
  // entirely (CameraCard returns null when both URLs are empty). Set
  // MOWER_WHEP_URL explicitly to enable WHEP, or MOWER_CAMERA_URL for
  // the MJPEG fallback. The lowlatency-cam-streamer sidecar's standard
  // endpoint is http://<host>:8889/cam/whep if you want a starting point.
  const whep_url = process.env.MOWER_WHEP_URL ?? '';

  if (!name || !mqtt_ws_url) return null;

  return {
    mowers: [
      {
        id: '1',
        name,
        mqtt_ws_url,
        mqtt_prefix,
        description: '',
        camera_url,
        whep_url,
      },
    ],
  };
}

export async function loadAppConfig(): Promise<AppConfig> {
  const envConfig = await loadConfigFromEnv();
  if (envConfig) return envConfig;

  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading configuration:', error);
    throw new Error('Failed to read configuration');
  }
}
