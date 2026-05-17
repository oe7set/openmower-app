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
  // Default points at the lowlatency-cam-streamer sidecar's standard
  // STREAM_NAME=cam, WHEP_PORT=8889. Same host-derivation pattern as
  // mqtt_ws_url so the deploy "just works" when the streamer runs colocated
  // with the app. Set MOWER_WHEP_URL to an empty string to disable WHEP and
  // force the MJPEG fallback.
  const whep_url = process.env.MOWER_WHEP_URL ?? `http://${hostname}:8889/cam/whep`;

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
