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
    // Slerp toward the latest sample. At 60 fps and blend ~0.2/frame this
    // converges in ~150 ms, which feels live without the visible 30 Hz
    // step jitter that direct assignment would produce.
    const blend = Math.min(1, delta * 12);
    g.quaternion.slerp(targetRef.current, blend);
    // In demand mode the loop only renders when invalidated. Keep requesting
    // frames ONLY while the slerp is still converging, then let it go fully
    // idle — the same pattern drei's OrbitControls uses for damping. Once
    // idle, the main thread frees up and App Router's pending route
    // transition can finally commit. (A previous version blindly invalidated
    // ~30 Hz via setInterval, which kept the loop hot forever and starved
    // the transition — that was the bug.)
    if (g.quaternion.angleTo(targetRef.current) > 1e-4) invalidate();
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
  // GLTF meshes load with castShadow=false. Flip it once on import so the
  // body of the mower drops a shadow onto the floor plane.
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) obj.castShadow = true;
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
        shadows="soft"
        // demand: render only when invalidate() is called (per IMU sample,
        // during slerp/damping). A continuous frameloop="always" loop never
        // yielded an idle frame, so App Router's concurrent route transition
        // could never commit — clicking a sidebar item did nothing while on
        // this page. See MowerModel for the invalidate wiring.
        frameloop="demand"
        // flat: THREE.NoToneMapping instead of the default ACESFilmic curve,
        // which compressed midtones and made the model look dark regardless
        // of light intensity. With NoToneMapping the lights below are the
        // sole brightness control.
        flat
        eventSource={containerRef as React.RefObject<HTMLElement>}
        eventPrefix="offset"
      >
        {/* Hemi + ambient + directional gives PBR materials enough volume
            without an HDRI. We deliberately do NOT use drei's <Environment
            preset> here: it fetches an HDR from raw.githack.com, which an
            offline robot can't reach, and the extra Suspense source used to
            re-mount OrbitControls and trap pointer captures. These three
            intensities are the brightness knobs (tone mapping is off, see the
            Canvas `flat` prop) — keep directional modest or the metallic
            blade disc starts to specular-clip. */}
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#a8c8ff', '#5a4f3a', 0.5]} />
        <directionalLight
          position={[3, 5, 2]}
          intensity={0.95}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
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
