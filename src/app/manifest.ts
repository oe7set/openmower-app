import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OpenMower',
    short_name: 'OpenMower',
    description: 'Control and monitor your OpenMower robotic lawnmower',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0C5E2B',
    theme_color: '#0C5E2B',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
      {src: '/icon.svg', sizes: 'any', type: 'image/svg+xml'},
    ],
  };
}
