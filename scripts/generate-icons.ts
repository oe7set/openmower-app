#!/usr/bin/env -S npx -y tsx

import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import sharp from 'sharp';
import toIco from 'to-ico';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_SVG = resolve(ROOT, 'public/icon.svg');
const BRAND_GREEN = '#0C5E2B';

const targets = {
  appIconSvg: resolve(ROOT, 'src/app/icon.svg'),
  appAppleIcon: resolve(ROOT, 'src/app/apple-icon.png'),
  appFavicon: resolve(ROOT, 'src/app/favicon.ico'),
  pwa192: resolve(ROOT, 'public/icons/icon-192.png'),
  pwa512: resolve(ROOT, 'public/icons/icon-512.png'),
  pwaMaskable: resolve(ROOT, 'public/icons/icon-maskable-512.png'),
};

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), {recursive: true});
}

// Source SVG has viewBox 1000x1000 — rendering at density 384 yields a
// ~5333px intermediate raster, plenty for crisp downscale to any icon size
// while staying well under sharp's default pixel limit.
const RENDER_DENSITY = 384;

async function renderPng(svg: Buffer, size: number): Promise<Buffer> {
  return sharp(svg, {density: RENDER_DENSITY})
    .resize(size, size, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toBuffer();
}

async function renderMaskable(svg: Buffer, size: number): Promise<Buffer> {
  // Maskable icons require the motif to live inside the inner 80% safe zone.
  // The source SVG already has a green background, so we extend the canvas by
  // 10% on each side using the same brand green — the launcher mask can clip
  // freely without ever exposing transparency or cropping the mower.
  const inner = Math.round(size * 0.8);
  const inset = sharp(svg, {density: RENDER_DENSITY})
    .resize(inner, inner, {fit: 'contain'})
    .png()
    .toBuffer();
  return sharp({
    create: {width: size, height: size, channels: 4, background: BRAND_GREEN},
  })
    .composite([{input: await inset, gravity: 'center'}])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const svg = readFileSync(SRC_SVG);

  for (const path of Object.values(targets)) ensureDir(path);

  copyFileSync(SRC_SVG, targets.appIconSvg);
  console.log(`copied  ${targets.appIconSvg}`);

  const png192 = await renderPng(svg, 192);
  const png512 = await renderPng(svg, 512);
  const pngApple = await renderPng(svg, 180);
  const pngMaskable = await renderMaskable(svg, 512);

  writeFileSync(targets.pwa192, png192);
  writeFileSync(targets.pwa512, png512);
  writeFileSync(targets.pwaMaskable, pngMaskable);
  writeFileSync(targets.appAppleIcon, pngApple);
  console.log(`wrote   ${targets.pwa192}`);
  console.log(`wrote   ${targets.pwa512}`);
  console.log(`wrote   ${targets.pwaMaskable}`);
  console.log(`wrote   ${targets.appAppleIcon}`);

  const png16 = await renderPng(svg, 16);
  const png32 = await renderPng(svg, 32);
  const png48 = await renderPng(svg, 48);
  const ico = await toIco([png16, png32, png48]);
  writeFileSync(targets.appFavicon, ico);
  console.log(`wrote   ${targets.appFavicon}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
