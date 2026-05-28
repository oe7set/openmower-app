'use client';

import {quaternionToThree} from '@/lib/quaternion';
import {useLatestImu} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Environment, Grid, OrbitControls, useGLTF} from '@react-three/drei';
import {Canvas, useFrame} from '@react-three/fiber';
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
  const sample = useLatestImu(mowerId);

  // The IMU stream may briefly publish a non-unit quaternion (filter just
  // started, or pre-bias-calibration). Renormalise so we never feed
  // three.js a degenerate rotation. Update happens in an effect because
  // mutating a ref during render is not allowed.
  useEffect(() => {
    if (!sample) return;
    const q = quaternionToThree(sample);
    q.normalize();
    targetRef.current.copy(q);
  }, [sample]);

  // Slerp toward the latest sample. At 60 fps and blend ~0.2/frame this
  // converges in ~150 ms, which feels live without the visible 30 Hz
  // step jitter that direct assignment would produce.
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const blend = Math.min(1, delta * 12);
    g.quaternion.slerp(targetRef.current, blend);
  });

  return (
    <RosToThreeAdapter>
      <group ref={groupRef}>{glbAvailable ? <GltfMower /> : <ProceduralMower />}</group>
    </RosToThreeAdapter>
  );
}

function GltfMower() {
  const {scene} = useGLTF(MODEL_PATH);
  // GLTF meshes load with castShadow=false. Flip it once on import so the
  // body of the mower drops a shadow onto the floor plane.
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) obj.castShadow = true;
    });
  }, [scene]);
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

  return (
    <Canvas
      camera={{position: [1.4, 1.0, 1.4], fov: 45, near: 0.05, far: 50}}
      style={{width: '100%', height: '100%'}}
      shadows="soft"
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.0}
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

      <Suspense fallback={<MowerModel glbAvailable={false} />}>
        <MowerModel glbAvailable={glbAvailable} />
      </Suspense>

      {/* Receives the model's drop shadow on the world-frame floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <shadowMaterial opacity={0.25} />
      </mesh>

      {/* World-frame floor grid lives in three.js Y-up space. */}
      <Grid
        position={[0, 0, 0]}
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

      <Environment preset="park" />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={0.5}
        maxDistance={6}
        target={[0, 0.15, 0]}
      />
    </Canvas>
  );
}
