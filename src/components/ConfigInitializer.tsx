'use client';

import {AppConfig} from '@/components/types';
import {useConfigStore} from '@/stores/configStore';
import {useMowersStore} from '@/stores/mowersStore';
import {useEffect} from 'react';

interface ConfigInitializerProps {
  config: AppConfig;
}

// Seeds the config store and triggers MQTT client setup. Both run in an effect
// so React 19 Strict Mode and Next.js HMR re-mounts don't fire side effects
// during render. loadMowers() is itself idempotent against an unchanged config,
// so the Strict-Mode double-invoke is a no-op on the second pass.
export function ConfigInitializer({config}: ConfigInitializerProps) {
  useEffect(() => {
    useConfigStore.getState().setConfig(config);
    useMowersStore.getState().loadMowers();
  }, [config]);
  return null;
}
