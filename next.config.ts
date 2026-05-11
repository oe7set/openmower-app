import type {NextConfig} from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@mapbox/mapbox-gl-draw', 'mqtt'],
  // Allow hitting the dev server via IPs other than 'localhost' (e.g. 127.0.0.1
  // or the LAN address) without Next blocking its HMR WebSocket.
  allowedDevOrigins: ['127.0.0.1', '*.local', '*.lan'],
  env: {
    // Expose the app version so the Diagnostics page can display it without
    // bundling all of package.json into the client build.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
