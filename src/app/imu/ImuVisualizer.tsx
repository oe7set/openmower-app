'use client';

import {degToRad, writeQuaternionToThree} from '@/lib/quaternion';
import {getLiveImuSample, useImuStore} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {ToneMappingMode, useUiStore} from '@/stores/uiStore';
import {Grid, OrbitControls, useGLTF} from '@react-three/drei';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Suspense, useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import LookControls from './LookControls';
import ProceduralMower from './ProceduralMower';

const MODEL_PATH = '/models/tango_e5.glb';

// Persisted string union (uiStore) → three.js tone-mapping constant. Kept here
// so the persisted value never depends on three's numeric enum values.
export const TONE_MAPPING: Record<ToneMappingMode, THREE.ToneMapping> = {
  neutral: THREE.NeutralToneMapping,
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  linear: THREE.LinearToneMapping,
  none: THREE.NoToneMapping,
};

// Start fetching/parsing the 13 MB GLB as soon as this module loads (during
// the dynamic import of the visualizer) so the procedural→GLB swap is quick.
useGLTF.preload(MODEL_PATH);

// Below this angular distance (~0.5°) we treat the model as "arrived" at the
// live orientation: snap to it and stop requesting frames. Live IMU noise sits
// well under this, so a physically-still robot lets the demand loop go fully
// idle (~0 rendered fps) instead of slerping toward jitter at 60 fps forever.
const SETTLE_RAD = 0.0087;

// Bridge ROS REP-103 (X-forward, Y-left, Z-up) into three.js's default
// (X-right, Y-up, -Z-forward). The orientation quaternion is applied to
// the body group inside this adapter, so it stays expressed in the ROS
// frame; the adapter alone takes care of the world-frame remap.
function RosToThreeAdapter({children}: {children: React.ReactNode}) {
  return <group rotation={[-Math.PI / 2, 0, 0]}>{children}</group>;
}

interface MowerModelProps {
  glbAvailable: boolean;
}

function MowerModel({glbAvailable}: MowerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef<THREE.Group>(null);
  const targetRef = useRef(new THREE.Quaternion());
  const mowerId = useSelectedMower((s) => s?.id);
  // Static user offsets (degrees) re-squaring a mis-oriented model. Applied to
  // the offset group nested inside the live-orientation group, so the offset
  // moves rigidly with the mesh as the robot tilts.
  const offsetX = useUiStore((s) => s.imuModelOffsetX);
  const offsetY = useUiStore((s) => s.imuModelOffsetY);
  const offsetZ = useUiStore((s) => s.imuModelOffsetZ);
  // invalidate() requests a single render in frameloop="demand" mode. We use
  // it both to drive the slerp until it converges and to wake the loop when
  // new IMU samples arrive — see useFrame / the wakeup effect below.
  const invalidate = useThree((s) => s.invalidate);
  // Tracks whether the GLB has actually finished loading. Until then we
  // keep showing the procedural fallback alongside, so the Suspense
  // boundary never causes a sibling unmount of OrbitControls/Canvas
  // event state — that re-mount used to leak a pointer capture and trap
  // sidebar clicks after the user dragged the 3D view.
  const [gltfReady, setGltfReady] = useState(false);

  // Read the live IMU sample directly inside the render loop instead of
  // subscribing via a Zustand hook. A 30 Hz hook subscription re-rendered
  // this component for no benefit — the three.js object is driven
  // imperatively here. The slerp oversamples the 30 Hz stream, so reading
  // the full-rate buffer keeps the model live without any React re-render.
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // The IMU stream may briefly publish a non-unit quaternion (filter just
    // started, or pre-bias-calibration). Renormalise so we never feed
    // three.js a degenerate rotation. Write into the reusable target ref
    // rather than allocating a quaternion every frame.
    const sample = getLiveImuSample(mowerId);
    if (sample) {
      writeQuaternionToThree(sample, targetRef.current).normalize();
    }

    const dist = g.quaternion.angleTo(targetRef.current);
    // Within the deadband: snap to the target and request NO further frame.
    // The demand loop then goes idle, freeing the main thread so App Router's
    // pending route transition can commit. (A previous 1e-4 threshold sat
    // below IMU noise, so the loop never idled and ran 60 fps forever — that
    // re-introduced the navigation slowdown.)
    if (dist < SETTLE_RAD) {
      g.quaternion.copy(targetRef.current);
      return;
    }
    // Still converging: slerp one step (blend ~0.2/frame ≈ 150 ms to arrive)
    // and keep the loop alive until we drop into the deadband above, then it
    // stops. Same self-terminating pattern drei's OrbitControls uses.
    g.quaternion.slerp(targetRef.current, Math.min(1, delta * 12));
    invalidate();
  });

  // Wake the demand-mode loop only when a NEW IMU sample is actually
  // published (the throttled imuStore notifies at ~11 Hz). The in-frame
  // invalidate above then renders the few frames needed to slerp to the new
  // target and stops. Between samples the loop is genuinely idle — that idle
  // window is what lets the route transition commit.
  useEffect(() => {
    return useImuStore.subscribe(() => invalidate());
  }, [invalidate]);

  // Apply the static orientation offsets imperatively, mirroring ToneController.
  // In frameloop="demand" the only wakeup is the IMU-sample subscription above,
  // which doesn't fire while the robot is still — so dragging a slider needs its
  // own invalidate() to render the new orientation.
  useEffect(() => {
    const o = offsetRef.current;
    if (!o) return;
    o.rotation.set(degToRad(offsetX), degToRad(offsetY), degToRad(offsetZ));
    invalidate();
  }, [offsetX, offsetY, offsetZ, invalidate]);

  return (
    <RosToThreeAdapter>
      <group ref={groupRef}>
        <group ref={offsetRef}>
          <group visible={!gltfReady}>
            <ProceduralMower />
          </group>
          {glbAvailable && (
            <Suspense fallback={null}>
              <GltfMower onReady={() => setGltfReady(true)} />
            </Suspense>
          )}
        </group>
      </group>
    </RosToThreeAdapter>
  );
}

interface GltfMowerProps {
  onReady: () => void;
}

function GltfMower({onReady}: GltfMowerProps) {
  const {scene} = useGLTF(MODEL_PATH);
  // GLTF meshes load with castShadow=false and single-sided materials. Fix a
  // few things once on import:
  //  - castShadow so the body drops a shadow onto the floor;
  //  - side=DoubleSide so faces with open/inverted normals don't vanish when
  //    the camera looks at the model from below;
  //  - frustumCulled=false + a recomputed bounding sphere so individual meshes
  //    don't pop out of existence as the model rotates. Exported GLBs often
  //    carry too-tight/incorrect bounds; for a single always-framed hero model
  //    culling buys nothing, so disabling it is the guaranteed fix (and the
  //    recompute repairs the underlying bounds as a belt-and-suspenders);
  //  - opaque-pass normalization for materials wrongly flagged transparent
  //    (see the per-material comment below).
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.geometry?.computeBoundingSphere();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of materials) {
        if (!m) continue;
        m.side = THREE.DoubleSide;
        // Pipeline artifact: the 3dsMax→FBX→Blender→glTF export marks several
        // solid body panels (plastic_1, green_mat, plastic_top) alphaMode=BLEND
        // because their diffuse PNGs carry a fully-opaque alpha channel. BLEND
        // puts them in three's transparent pass — depthWrite off, per-object
        // back-to-front centroid sort — so on rotation panels sort wrong:
        // background shows through, panels look see-through, textures drop out.
        // The mower has no translucent parts, so push any material that is
        // flagged transparent yet fully opaque (opacity ≥ 1) back to the opaque
        // pass. Materials with genuine opacity < 1 are left untouched.
        if (m.transparent && (m.opacity ?? 1) >= 1) {
          m.transparent = false;
          m.depthWrite = true;
          m.alphaTest = 0;
          m.needsUpdate = true; // flipping transparent changes blend/program state
        }
      }
    });
    onReady();
  }, [scene, onReady]);
  return <primitive object={scene} />;
}

// Procedural image-based lighting. The Tango GLB uses real PBR materials with
// metallic/glossy panels; the metallic component reflects the environment, so
// without an env map those panels resolve to near-black (the procedural
// fallback uses flat diffuse colors and doesn't need this). RoomEnvironment is
// bundled with three and the PMREM is generated in-process, so this honours the
// offline-robot constraint that ruled out drei's <Environment preset> (which
// fetches an HDR over the network). Assigned to scene.environment so every PBR
// material picks it up automatically. Strength (environmentIntensity) is owned
// by ToneController below so the look-controls slider is the single source.
function LocalEnvironment() {
  // Pull the renderer/scene through r3f's non-reactive get() accessor inside the
  // effect rather than mutating selector return values directly — assigning to
  // scene.environment on a useThree() result trips the react-hooks immutability
  // rule. get() is stable, so the effect runs once.
  const get = useThree((s) => s.get);
  useEffect(() => {
    const {gl, scene, invalidate} = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    // frameloop="demand": render once now that the lighting changed.
    invalidate();
    return () => {
      scene.environment = null;
      envMap.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

// Applies the persisted look settings (tone mapping, exposure, IBL intensity)
// to the live renderer/scene and re-renders on change. Switching gl.toneMapping
// is part of three's program cache key, so setProgram auto-recompiles materials
// on the next render — we only need to set the value and invalidate(). Exposure
// and environmentIntensity are uniforms and apply instantly.
function ToneController() {
  const get = useThree((s) => s.get);
  const toneMapping = useUiStore((s) => s.imuToneMapping);
  const exposure = useUiStore((s) => s.imuExposure);
  const envIntensity = useUiStore((s) => s.imuEnvIntensity);
  useEffect(() => {
    const {gl, scene, invalidate} = get();
    gl.toneMapping = TONE_MAPPING[toneMapping] ?? THREE.NeutralToneMapping;
    gl.toneMappingExposure = exposure;
    scene.environmentIntensity = envIntensity;
    invalidate();
  }, [get, toneMapping, exposure, envIntensity]);
  return null;
}

// Probes the GLB asset with a HEAD request before mounting useGLTF.
// Throwing inside useGLTF logs noisily in dev and leaves a stale entry
// in the drei cache; checking first keeps the console clean and lets
// the procedural fallback render immediately when the asset is absent
// (CI, forks without the licensed model, fresh dev clones).
function useGlbAvailability(): 'pending' | 'available' | 'missing' {
  const [state, setState] = useState<'pending' | 'available' | 'missing'>('pending');
  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_PATH, {method: 'HEAD'})
      .then((res) => {
        if (cancelled) return;
        setState(res.ok ? 'available' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export default function ImuVisualizer() {
  const availability = useGlbAvailability();
  const glbAvailable = availability === 'available';
  // Wrapping the Canvas in a ref-anchored container and pointing r3f's
  // event system at it (eventSource) keeps pointer listeners scoped to
  // this DOM subtree. Without it, drei's OrbitControls + r3f event
  // delegation could leak a pointer capture to the canvas element after
  // a drag, swallowing subsequent sidebar clicks.
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{position: 'relative', width: '100%', height: '100%'}}>
      <Canvas
        camera={{position: [1.4, 1.0, 1.4], fov: 45, near: 0.1, far: 20}}
        style={{width: '100%', height: '100%'}}
        // PCFSoftShadowMap (with the 512² maps below) is far cheaper than the
        // VSM-based shadows="soft" and visually indistinguishable for a small
        // hero model. The shadow map only re-renders on rendered frames, which
        // the demand loop now makes rare.
        shadows={{type: THREE.PCFSoftShadowMap}}
        // Cap the pixel ratio: the r3f default [1, 2] renders 4× the pixels on
        // a 2× display. 1.5 halves worst-case fragment work with no visible
        // quality loss for this scene.
        dpr={[1, 1.5]}
        // demand: render only when invalidate() is called (per IMU sample,
        // during slerp). The deadband in MowerModel's useFrame lets the loop
        // go fully idle when the robot is still, so the main thread frees up
        // and App Router route transitions commit promptly.
        frameloop="demand"
        // Tone mapping / exposure are applied at runtime by ToneController from
        // the persisted look settings (default: Khronos PBR Neutral @ 1.0), so
        // they're intentionally not set here.
        eventSource={containerRef as React.RefObject<HTMLElement>}
        eventPrefix="offset"
      >
        {/* Lighting is IBL (LocalEnvironment: a bundled RoomEnvironment PMREM,
            no network fetch — drei's <Environment preset> was rejected because
            it fetches an HDR an offline robot can't reach) plus a single
            directional key light. The earlier ambient + hemisphere fills were
            removed: stacked on top of IBL they flattened contrast and
            over-brightened the model. IBL strength (environmentIntensity),
            exposure and the tone mapper are the brightness knobs and live in the
            look-controls overlay; keep the directional modest or the metallic
            blade disc starts to specular-clip. */}
        <LocalEnvironment />
        <ToneController />
        <directionalLight
          position={[3, 5, 2]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-near={0.5}
          shadow-camera-far={15}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />

        <MowerModel glbAvailable={glbAvailable} />

        {/* Receives the model's drop shadow on the world-frame floor. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.25} />
        </mesh>

        {/* World-frame floor grid lives in three.js Y-up space. Dropped 2 mm
            below the shadow plane (at y=0) so the two coplanar surfaces don't
            z-fight — that tie flickered the grid/shadow when orbiting. */}
        <Grid
          position={[0, -0.002, 0]}
          args={[10, 10]}
          cellSize={0.25}
          cellThickness={0.5}
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#5a8c5a"
          cellColor="#3d3d3d"
          fadeDistance={6}
          fadeStrength={1.5}
          infiniteGrid
        />

        {/* No makeDefault: keep the controls local to this page so a
            stray reference can't survive route transitions and call
            releasePointerCapture on a detached canvas. */}
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={0.5}
          maxDistance={6}
          target={[0, 0.15, 0]}
        />
      </Canvas>

      {/* Look-controls overlay: hidden behind a toggle button, lives inside the
          same container as the Canvas so r3f's eventSource/pointer-capture
          scoping is unaffected. Writes to uiStore; ToneController applies it. */}
      <LookControls />
    </div>
  );
}
