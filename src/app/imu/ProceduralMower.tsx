'use client';

// Fallback model rendered when /models/tango_e5.glb is missing. Keeps the
// IMU page functional without the proprietary asset (CI, forks, fresh
// clones) and gives an unmistakable visual cue that the real model isn't
// loaded. Geometry stays in the ROS body frame: +X forward, +Y left, +Z
// up — the visualizer wraps this in the three.js axis adapter.

import * as THREE from 'three';

interface ProceduralMowerProps {
  /** Tint of the chassis. Defaults to a neutral mower green. */
  color?: string;
}

export default function ProceduralMower({color = '#3a7d3b'}: ProceduralMowerProps) {
  // Body 0.55 m long × 0.40 m wide × 0.20 m tall (chassis only).
  // Wheels at the four corners, blade disc under the front half.
  return (
    <group>
      {/* Chassis */}
      <mesh position={[0, 0, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.4, 0.2]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Forward marker — small red wedge so orientation is unambiguous. */}
      <mesh position={[0.28, 0, 0.22]} castShadow>
        <coneGeometry args={[0.05, 0.1, 4]} />
        <meshStandardMaterial color="#d24545" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Wheels — rotated so the cylinder axis matches the Y (left/right) axis. */}
      {(
        [
          [0.18, 0.22, 0.05],
          [0.18, -0.22, 0.05],
          [-0.18, 0.22, 0.05],
          [-0.18, -0.22, 0.05],
        ] as const
      ).map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 24]} />
          <meshStandardMaterial color="#222" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Blade disc */}
      <mesh position={[0.05, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.01, 32]} />
        <meshStandardMaterial color="#666" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
