/**
 * Trees.tsx
 * Renders a set of stylised trees scattered around the town.
 * Trunks and canopies gently sway using a sine-wave shader trick
 * applied via useFrame, simulating a light breeze.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Pre-calculated tree layout (never use Math.random() in render) ───────────
// Each entry: [x, z, scale, phase-offset]
const TREE_DATA: [number, number, number, number][] = [
  [-52,  -52, 1.0, 0.00], [-45,  -48, 1.2, 0.31], [-38,  -55, 0.9, 0.87],
  [-55,  -35, 1.1, 1.20], [-50,  -20, 1.0, 2.10], [-53,   -5, 0.8, 0.55],
  [-48,   12, 1.3, 1.80], [-54,   28, 1.0, 0.73], [-50,   44, 1.1, 2.40],
  [-46,   52, 0.9, 0.12], [-38,   56, 1.2, 1.60], [-25,   54, 1.0, 0.45],
  [ -8,   56, 0.8, 2.70], [  8,   55, 1.1, 1.05], [ 24,   56, 0.9, 0.90],
  [ 42,   54, 1.0, 2.20], [ 54,   48, 1.2, 0.66], [ 56,   32, 0.8, 1.35],
  [ 55,   14, 1.1, 0.20], [ 54,   -2, 1.0, 1.90], [ 56,  -18, 0.9, 0.50],
  [ 54,  -34, 1.2, 2.50], [ 50,  -50, 1.0, 0.80], [ 38,  -55, 1.1, 1.45],
  [ 22,  -55, 0.9, 0.35], [  5,  -54, 1.0, 2.05], [-12,  -53, 1.2, 0.60],
  // Interior trees along roads
  [-34,  -30, 0.8, 0.95], [-15,  -34, 0.9, 1.70], [  6,  -34, 0.8, 0.25],
  [ 28,  -34, 1.0, 2.35], [ 36,  -12, 0.9, 0.85], [ 36,   8, 0.8, 1.55],
  [-22,   12, 0.9, 0.40], [-36,   10, 0.8, 2.15], [-36,  -8, 0.9, 0.10],
  [ -6,   22, 0.8, 1.30], [ 14,   22, 0.9, 0.75], [ 14,  -10, 0.8, 2.80],
  [-14,  -10, 0.9, 0.65], [-14,   -5, 1.0, 1.15], [ 30,   30, 0.9, 0.50],
  [-30,   30, 0.8, 1.85], [-30,  -40, 1.0, 0.30],
];

// ── Single tree instance ─────────────────────────────────────────────────────

interface TreeProps {
  x: number;
  z: number;
  scale: number;
  phase: number;
}

function Tree({ x, z, scale, phase }: TreeProps) {
  const canopyRef = useRef<THREE.Mesh>(null);

  // Sway canopy gently with sine wave
  useFrame(({ clock }) => {
    if (!canopyRef.current) return;
    const t = clock.elapsedTime;
    // Small rotation sway — looks like wind
    canopyRef.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.04;
    canopyRef.current.rotation.x = Math.sin(t * 0.6 + phase + 1.2) * 0.02;
  });

  const trunkH = 1.8 * scale;
  const canopyH = 2.4 * scale;
  const canopyR = 1.3 * scale;

  return (
    <group position={[x, 0, z]}>
      {/* Trunk */}
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.18 * scale, 0.22 * scale, trunkH, 7]} />
        <meshLambertMaterial color="#795548" />
      </mesh>
      {/* Canopy – two stacked cones for a tropical look */}
      <mesh ref={canopyRef} position={[0, trunkH + canopyH * 0.45, 0]} castShadow>
        <coneGeometry args={[canopyR, canopyH, 8]} />
        <meshLambertMaterial color="#2e7d32" />
      </mesh>
      <mesh position={[0, trunkH + canopyH * 0.78, 0]} castShadow>
        <coneGeometry args={[canopyR * 0.65, canopyH * 0.6, 8]} />
        <meshLambertMaterial color="#388e3c" />
      </mesh>
    </group>
  );
}

// ── Trees collection ─────────────────────────────────────────────────────────

export function Trees() {
  // Trees array never changes — memoised once
  const trees = useMemo(() => TREE_DATA, []);

  return (
    <>
      {trees.map(([x, z, scale, phase], i) => (
        <Tree key={i} x={x} z={z} scale={scale} phase={phase} />
      ))}
    </>
  );
}
