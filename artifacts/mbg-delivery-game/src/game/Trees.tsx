/**
 * Trees.tsx
 * Performance-optimised tree animation.
 *
 * Old approach: each Tree had its own useFrame → 43 useFrame subscriptions.
 * New approach: ONE useFrame in Trees iterates all canopy refs with a shared
 * clock value. This cuts draw-call overhead dramatically.
 *
 * Canopy refs are stored in a fixed-size array initialised at module level
 * and populated via callback refs — no re-renders, no extra hooks.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// [x, z, scale, windPhaseOffset]
const TREE_DATA: [number, number, number, number][] = [
  [-52, -52, 1.0, 0.00], [-45, -48, 1.2, 0.31], [-38, -55, 0.9, 0.87],
  [-55, -35, 1.1, 1.20], [-50, -20, 1.0, 2.10], [-53,  -5, 0.8, 0.55],
  [-48,  12, 1.3, 1.80], [-54,  28, 1.0, 0.73], [-50,  44, 1.1, 2.40],
  [-46,  52, 0.9, 0.12], [-38,  56, 1.2, 1.60], [-25,  54, 1.0, 0.45],
  [ -8,  56, 0.8, 2.70], [  8,  55, 1.1, 1.05], [ 24,  56, 0.9, 0.90],
  [ 42,  54, 1.0, 2.20], [ 54,  48, 1.2, 0.66], [ 56,  32, 0.8, 1.35],
  [ 55,  14, 1.1, 0.20], [ 54,  -2, 1.0, 1.90], [ 56, -18, 0.9, 0.50],
  [ 54, -34, 1.2, 2.50], [ 50, -50, 1.0, 0.80], [ 38, -55, 1.1, 1.45],
  [ 22, -55, 0.9, 0.35], [  5, -54, 1.0, 2.05], [-12, -53, 1.2, 0.60],
  [-34, -30, 0.8, 0.95], [-15, -34, 0.9, 1.70], [  6, -34, 0.8, 0.25],
  [ 28, -34, 1.0, 2.35], [ 36, -12, 0.9, 0.85], [ 36,   8, 0.8, 1.55],
  [-22,  12, 0.9, 0.40], [-36,  10, 0.8, 2.15], [-36,  -8, 0.9, 0.10],
  [ -6,  22, 0.8, 1.30], [ 14,  22, 0.9, 0.75], [ 14, -10, 0.8, 2.80],
  [-14, -10, 0.9, 0.65], [-14,  -5, 1.0, 1.15], [ 30,  30, 0.9, 0.50],
  [-30,  30, 0.8, 1.85], [-30, -40, 1.0, 0.30],
];

export function Trees() {
  // One ref slot per tree — populated by callback refs below
  const canopyRefs = useRef<(THREE.Mesh | null)[]>(
    new Array(TREE_DATA.length).fill(null)
  );

  // ── Single shared useFrame for all 44 trees ───────────────────────────────
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < TREE_DATA.length; i++) {
      const mesh = canopyRefs.current[i];
      if (!mesh) continue;
      const phase = TREE_DATA[i][3];
      // Gentle two-axis sway simulating wind
      mesh.rotation.z = Math.sin(t * 0.8 + phase) * 0.04;
      mesh.rotation.x = Math.sin(t * 0.6 + phase + 1.2) * 0.02;
    }
  });

  return (
    <>
      {TREE_DATA.map(([x, z, scale, _phase], i) => {
        const trunkH  = 1.8 * scale;
        const canopyH = 2.4 * scale;
        const canopyR = 1.3 * scale;

        return (
          <group key={i} position={[x, 0, z]}>
            {/* Trunk */}
            <mesh position={[0, trunkH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.18 * scale, 0.22 * scale, trunkH, 7]} />
              <meshLambertMaterial color="#795548" />
            </mesh>

            {/* Lower canopy — ref collected for wind animation */}
            <mesh
              ref={el => { canopyRefs.current[i] = el; }}
              position={[0, trunkH + canopyH * 0.45, 0]}
              castShadow
            >
              <coneGeometry args={[canopyR, canopyH, 8]} />
              <meshLambertMaterial color="#2e7d32" />
            </mesh>

            {/* Upper canopy tip (static — moves with parent group naturally) */}
            <mesh position={[0, trunkH + canopyH * 0.78, 0]} castShadow>
              <coneGeometry args={[canopyR * 0.65, canopyH * 0.6, 8]} />
              <meshLambertMaterial color="#388e3c" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
