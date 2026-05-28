'use client';

import {quaternionToThree} from '@/lib/quaternion';
import {useLatestImu} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Environment, Grid, OrbitControls, useGLTF} from '@react-three/drei';
import {Canvas, useFrame} from '@react-three/fiber';
import {Component, Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import * as THREE from 'three';
import ProceduralMower from './ProceduralMower';

const MODEL_PATH = '/models/tango_e5.glb';

// Bridge ROS REP-103 (X-forward, Y-left, Z-up) into three.js's default
// (X-right, Y-up, -Z-forward). A single rotation that maps the body
// frame onto the world frame: rotate -90° around X to lift Z to Y, then
// rotate the result so that +X stays forward in the camera-friendly
// scene. The actual orientation quaternion is applied to the body group
// inside this adapter, so it stays expressed in the ROS frame.
function RosToThreeAdapter({children}: {children: React.ReactNode}) {
  return <group rotation={[-Math.PI / 2, 0, 0]}>{children}</group>;
}

interface MowerModelProps {
  fallback: boolean;
}

function MowerModel({fallback}: MowerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef(new THREE.Quaternion());
  const mowerId = useSelectedMower((s) => s?.id);
  const sample = useLatestImu(mowerId);

  // The IMU stream may briefly publish a non-unit quaternion (filter just
  // started, or pre-bias-calibration). Renormalise here so we never feed
  // three.js a degenerate rotation. Update happens in an effect because
  // mutating a ref during render is not allowed.
  useEffect(() => {
    if (!sample) return;
    const q = quaternionToThree(sample);
    q.normalize();
    targetRef.current.copy(q);
  }, [sample]);

  // Slerp toward the latest sample at ~0.2 per frame. At 60 fps that
  // converges in ~150 ms, which feels live without the visible 30 Hz step
  // jitter that direct assignment would produce.
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const blend = Math.min(1, delta * 12);
    g.quaternion.slerp(targetRef.current, blend);
  });

  return (
    <RosToThreeAdapter>
      <group ref={groupRef}>{fallback ? <ProceduralMower /> : <GltfMower />}</group>
    </RosToThreeAdapter>
  );
}

function GltfMower() {
  // useGLTF suspends until the file is loaded; an error boundary in
  // ImuVisualizer falls back to ProceduralMower if the asset is absent.
  const {scene} = useGLTF(MODEL_PATH);
  return <primitive object={scene} />;
}

useGLTF.preload?.(MODEL_PATH);

// Boundary that downgrades to the procedural model on any GLB load error
// (404, decode failure, missing draco decoder, …). Keeps the page usable
// in CI and in forks without the licensed asset.
interface ModelErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, {hasError: boolean}> {
  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false};
  }
  static getDerivedStateFromError() {
    return {hasError: true};
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function ImuVisualizer() {
  const [useFallback, setUseFallback] = useState(false);

  return (
    <Canvas
      shadows
      camera={{position: [1.4, 1.0, 1.4], fov: 45, near: 0.05, far: 50}}
      style={{width: '100%', height: '100%'}}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Suspense fallback={<MowerModel fallback />}>
        {useFallback ? (
          <MowerModel fallback />
        ) : (
          <ModelErrorBoundary onError={() => setUseFallback(true)}>
            <MowerModel fallback={false} />
          </ModelErrorBoundary>
        )}
      </Suspense>

      {/* World-frame floor + grid — grid lives in three.js Y-up space. */}
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
