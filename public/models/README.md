# /public/models — local-only 3D assets

The `/imu` page renders a live 3D model of the mower whose orientation
is driven by the Madgwick-fused quaternion published on
`<prefix>imu/stream`. The model file (`tango_e5.glb`) is a **licensed
asset** and must not be committed; `.gitignore` excludes `*.glb` /
`*.gltf` / `*.bin` / `textures/` from this directory.

If the file is missing the page falls back to a procedural box-and-wheels
mockup so the rest of the UI stays usable (CI builds, forks without the
asset, etc.).

## Producing the GLB

The source asset ships as 3ds Max binary (`.max`) which browsers cannot
read. Convert once, locally:

1. Open the **scanline** `.max` (the V-Ray variant degrades on glTF
   export — V-Ray materials are vendor-specific and get reduced to
   Lambert).
2. Export with the **Babylon.js Exporter for 3ds Max** or the
   **Autodesk glTF 2.0 Exporter** plugin. Settings:
   - Format: `.glb` (binary, embedded textures — single file, no folder)
   - Units: meters
   - Up-Axis: Z (the IMU body frame is REP-103, X-forward Y-left Z-up)
3. Optional: compress with `npx gltf-pipeline -i tango_e5.glb -o
   tango_e5.glb --draco.compressionLevel=10`. Typical file size after
   Draco: 5–30 MB (down from ~100 MB raw).

## Deployment

- **Local dev:** drop `tango_e5.glb` into this directory.
- **Docker:** mount or `docker cp` into `/app/public/models/` (Next.js
  `output: 'standalone'` already copies the rest of `public/`).
- **Compose:** add `./models:/app/public/models:ro` to the `volumes`
  list of the `openmower-app` service.

The viewer loads the file via `useGLTF('/models/tango_e5.glb')` from
`@react-three/drei`; that helper internally caches by path so multiple
components share a single fetch.
