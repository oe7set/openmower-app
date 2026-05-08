import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@mapbox/mapbox-gl-draw', 'mqtt'],
  // Allow hitting the dev server via IPs other than 'localhost' (e.g. 127.0.0.1
  // or the LAN address) without Next blocking its HMR WebSocket.
  allowedDevOrigins: ['127.0.0.1', '*.local', '*.lan'],
};

export default nextConfig;
