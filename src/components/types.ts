import {ReactElement} from 'react';

export interface NavigationItem {
  label: string;
  icon: ReactElement;
  path: string;
  isGlobal: boolean;
  isPrimary?: boolean;
}

export interface MowerConfig {
  id: string;
  name: string;
  mqtt_ws_url: string;
  mqtt_prefix: string;
  description: string;
  // Optional MJPEG stream URL of an external camera service (e.g. mjpg-streamer
  // running alongside the mower). When unset or empty, the drive page hides
  // the camera card entirely.
  camera_url?: string;
}

export interface AppConfig {
  mowers: MowerConfig[];
}
