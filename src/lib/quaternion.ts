// Pure-math helpers for the IMU page. The orientation filter on the ROS
// side already does the hard work (Madgwick fusion + GPS-heading yaw
// correction). The app receives unit quaternions and only translates them
// into representations the UI cares about: human-readable Euler angles
// for the dashboard cards and a three.js Quaternion for the 3D viewer.
import * as THREE from 'three';

export interface Quaternion {
  qw: number;
  qx: number;
  qy: number;
  qz: number;
}

export interface Euler {
  /** Rotation around the body-X (forward) axis in radians. */
  roll: number;
  /** Rotation around the body-Y (left) axis in radians. */
  pitch: number;
  /** Rotation around the body-Z (up) axis in radians. */
  yaw: number;
}

// Convert a unit quaternion to ZYX-intrinsic Tait-Bryan angles
// (roll-pitch-yaw, REP-103 convention). The pitch branch clamps the
// asin argument so a marginally non-unit quaternion (rounding noise)
// can't yield NaN.
export function quaternionToEuler({qw, qx, qy, qz}: Quaternion): Euler {
  const sinrCosp = 2 * (qw * qx + qy * qz);
  const cosrCosp = 1 - 2 * (qx * qx + qy * qy);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = Math.max(-1, Math.min(1, 2 * (qw * qy - qz * qx)));
  const pitch = Math.asin(sinp);

  const sinyCosp = 2 * (qw * qz + qx * qy);
  const cosyCosp = 1 - 2 * (qy * qy + qz * qz);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return {roll, pitch, yaw};
}

// three.js Quaternion uses (x, y, z, w) order, opposite of ROS's (w, x, y, z).
export function quaternionToThree({qw, qx, qy, qz}: Quaternion): THREE.Quaternion {
  return new THREE.Quaternion(qx, qy, qz, qw);
}

// Same conversion as quaternionToThree but writes into an existing
// THREE.Quaternion instead of allocating. Used by the 60 fps render loop on
// the IMU page, where a fresh `new THREE.Quaternion()` per frame caused GC
// churn that lengthened frames the longer the page stayed open. Returns the
// same instance for chaining (e.g. `.normalize()`).
export function writeQuaternionToThree({qw, qx, qy, qz}: Quaternion, out: THREE.Quaternion): THREE.Quaternion {
  return out.set(qx, qy, qz, qw);
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
