/**
 * World.tsx
 * Builds the 3D town environment.
 *
 * AABB refactor: BUILDING_AABBS is a single pre-computed module-level constant.
 * Player.tsx imports it directly — no duplicate calls, no useMemo needed.
 */
import * as THREE from 'three';

// ── Shared type ───────────────────────────────────────────────────────────────
export interface AABB {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
}

// ── Road definitions [x, z, width, depth] ────────────────────────────────────
const ROADS: [number, number, number, number][] = [
  [  0, -22, 130,  8],
  [  0,   0, 130,  8],
  [  0,  22, 130,  8],
  [  0,  44, 130,  8],
  [-44,   0,   8, 130],
  [-22,   0,   8, 130],
  [  0,   0,   8, 130],
  [ 22,   0,   8, 130],
  [ 44,   0,   8, 130],
];

// ── Building definitions [x, z, w, h, d, colour] ─────────────────────────────
const BUILDINGS: [number, number, number, number, number, string][] = [
  [-55, -38,  8, 12,  8, '#8d6e63'], [-60, -28,  7, 16,  7, '#a1887f'],
  [-55, -15,  9, 10,  9, '#795548'], [-60,  -5,  8, 14,  8, '#6d4c41'],
  [-16, -38,  9, 18,  7, '#607d8b'], [ -6, -42,  7, 12,  9, '#546e7a'],
  [  8, -38,  8, 15,  8, '#455a64'], [ 16, -44,  6, 20,  7, '#37474f'],
  [ 32, -38,  9, 14,  8, '#78909c'], [ 42, -44,  7, 18,  9, '#546e7a'],
  [ 52, -38,  8, 12,  7, '#607d8b'], [ 52, -15,  9, 10,  8, '#455a64'],
  [-55, 10,   8, 12,  8, '#8bc34a'], [-60, 18,   7, 10,  7, '#7cb342'],
  [-55, 32,   9,  8,  9, '#689f38'],
  [ 52, 10,   8, 14,  8, '#ff8a65'], [ 56, 18,   7, 18,  7, '#ff7043'],
  [ 52, 32,   9, 10,  9, '#f4511e'],
  [-38, 10,   8, 12,  8, '#ce93d8'], [-30, 32,   7, 10,  7, '#ba68c8'],
  [ 32, 10,   9, 14,  8, '#80cbc4'], [ 38, 32,   8, 12,  7, '#4db6ac'],
  [-52, 52,   8, 10,  8, '#aed581'], [-38, 54,   7, 14,  9, '#c5e1a5'],
  [-10, 54,   9,  8,  8, '#dce775'], [  4, 52,   8, 12,  8, '#e6ee9c'],
  [ 26, 54,   7, 10,  7, '#f9a825'], [ 46, 52,   8, 16,  8, '#ffb300'],
  [-30, -16,  6,  8,  6, '#b0bec5'], [ 14, -16,  7, 10,  7, '#90a4ae'],
  [-10, 32,   8,  6,  8, '#ef9a9a'], [  6, 32,   7,  8,  7, '#e57373'],
];

// ── Single source of truth for collision boxes ────────────────────────────────
// Exported as a constant — computed once at module load, shared everywhere.
export const BUILDING_AABBS: AABB[] = BUILDINGS.map(([x, z, w, , d]) => ({
  minX: x - w / 2 - 0.5,
  maxX: x + w / 2 + 0.5,
  minZ: z - d / 2 - 0.5,
  maxZ: z + d / 2 + 0.5,
}));

// Keep function export for backward compat (no longer called internally)
export function computeBuildingAABBs(): AABB[] { return BUILDING_AABBS; }

// ── World scene ────────────────────────────────────────────────────────────────
export function World() {
  return (
    <>
      <fog attach="fog" args={['#87ceeb', 60, 160]} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#4caf50" />
      </mesh>

      {/* Roads */}
      {ROADS.map(([x, z, w, d], i) => (
        <mesh key={`road-${i}`} position={[x, 0.01, z]} receiveShadow>
          <boxGeometry args={[w, 0.08, d]} />
          <meshLambertMaterial color="#616161" />
        </mesh>
      ))}
      {/* Road centre-line dashes */}
      {ROADS.slice(0, 4).map(([x, z, w], i) => (
        <mesh key={`dash-${i}`} position={[x, 0.06, z]}>
          <boxGeometry args={[w * 0.9, 0.01, 0.25]} />
          <meshLambertMaterial color="#fdd835" />
        </mesh>
      ))}

      {/* River */}
      <mesh position={[15, 0.01, 40]}>
        <boxGeometry args={[54, 0.04, 20]} />
        <meshLambertMaterial color="#795548" />
      </mesh>
      <mesh position={[15, 0.02, 40]} receiveShadow>
        <boxGeometry args={[52, 0.12, 18]} />
        <meshLambertMaterial color="#1e88e5" transparent opacity={0.75} />
      </mesh>

      {/* Buildings */}
      {BUILDINGS.map(([x, z, w, h, d, color], i) => (
        <mesh key={`bld-${i}`} position={[x, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}

      {/* Invisible boundary walls */}
      {([
        [[  0, 2,  70], [140, 6,  1]],
        [[  0, 2, -70], [140, 6,  1]],
        [[ 70, 2,   0], [1,   6, 140]],
        [[-70, 2,   0], [1,   6, 140]],
      ] as [[number,number,number],[number,number,number]][]).map((b, i) => (
        <mesh key={`wall-${i}`} position={b[0]}>
          <boxGeometry args={b[1]} />
          <meshLambertMaterial transparent opacity={0} />
        </mesh>
      ))}
    </>
  );
}
