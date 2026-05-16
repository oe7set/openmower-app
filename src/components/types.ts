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
}

export interface AppConfig {
  mowers: MowerConfig[];
}
