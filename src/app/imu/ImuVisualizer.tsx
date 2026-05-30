'use client';

import {writeQuaternionToThree} from '@/lib/quaternion';
import {getLiveImuSample, useImuStore} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Grid, OrbitControls, useGLTF} from '@react-three/drei';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Suspense, useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import ProceduralMower from './ProceduralMower';

const MODEL_PATH = '/models/tango_e5.glb';

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
  const targetRef = useRef(new THREE.Quaternion());
  const mowerId = useSelectedMower((s) => s?.id);
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

  return (
    <RosToThreeAdapter>
      <group ref={groupRef}>
        <group visible={!gltfReady}>
          <ProceduralMower />
        </group>
        {glbAvailable && (
          <Suspense fallback={null}>
            <GltfMower onReady={() => setGltfReady(true)} />
          </Suspense>
        )}
      </group>
    </RosToThreeAdapter>
  );
}

interface GltfMowerProps {
  onReady: () => void;
}

function GltfMower({onReady}: GltfMowerProps) {
  const {scene} = useGLTF(MODEL_PATH);
  // GLTF meshes load with castShadow=false and single-sided materials. Flip
  // both once on import: castShadow so the body drops a shadow onto the floor,
  // and side=DoubleSide so faces with open/inverted normals don't vanish when
  // the camera looks at the model from below.
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of materials) {
        if (m) m.side = THREE.DoubleSide;
      }
    });
    onReady();
  }, [scene, onReady]);
  return <primitive object={scene} />;
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
        // ACESFilmic tone mapping for a natural look with clip-safe highlights;
        // exposure nudged up so the scene isn't dark. Lights below compensate
        // for the curve's highlight compression.
        gl={{toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15}}
        eventSource={containerRef as React.RefObject<HTMLElement>}
        eventPrefix="offset"
      >
        {/* Hemi + ambient + directional gives PBR materials enough volume
            without an HDRI. We deliberately do NOT use drei's <Environment
            preset> here: it fetches an HDR from raw.githack.com, which an
            offline robot can't reach, and the extra Suspense source used to
            re-mount OrbitControls and trap pointer captures. These three
            intensities are the brightness knobs (paired with the Canvas
            toneMappingExposure above) — keep directional modest or the
            metallic blade disc starts to specular-clip. */}
        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#a8c8ff', '#5a4f3a', 0.6]} />
        <directionalLight
          position={[3, 5, 2]}
          intensity={1.1}
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
    </div>
  );
}
