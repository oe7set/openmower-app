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
  // running alongside the mower). Used as a fallback when whep_url is unset.
  camera_url?: string;
  // Optional WHEP (WebRTC) endpoint, e.g. http://<host>:8889/cam/whep served by
  // the lowlatency-cam-streamer sidecar. Takes priority over camera_url. When
  // both are unset, the drive page hides the camera card entirely.
  whep_url?: string;
}

export interface AppConfig {
  mowers: MowerConfig[];
}
