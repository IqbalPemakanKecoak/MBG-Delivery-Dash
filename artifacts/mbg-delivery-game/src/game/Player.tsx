/**
 * Player.tsx — Delivery Truck
 *
 * Changes in this revision:
 *  • BUILDING_AABBS imported directly (single source of truth from World.tsx).
 *  • DELIVER_R tuned to 3.5 units.
 *  • Delivery only fires when schoolId === schools[currentMissionIndex].id —
 *    no out-of-order delivery possible.
 *  • Wheel rotation: 6 refs collected in an array, spun in the main useFrame
 *    proportional to velRef. One useFrame does everything.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';
import { BUILDING_AABBS } from './World';           // ← single import, no fn call

export enum Controls {
  forward = 'forward',
  back    = 'back',
  left    = 'left',
  right   = 'right',
}

// ── Tuning constants ──────────────────────────────────────────────────────────
const SPEED      = 12;    // forward speed  (units/s)
const REVERSE    = 6;     // reverse speed  (units/s)
const TURN_SPEED = 1.4;   // radians/s
const ACCEL      = 4;     // velocity smoothing
const DELIVER_R  = 3.5;   // delivery trigger radius (units)
const MAP_LIMIT  = 65;
const WHEEL_R    = 0.55;  // wheel radius for angular-velocity calculation

// ── AABB collision resolver ───────────────────────────────────────────────────
function resolveCollision(pos: THREE.Vector3, radius = 1.8): THREE.Vector3 {
  const out = pos.clone();
  for (const box of BUILDING_AABBS) {
    if (out.x > box.minX && out.x < box.maxX &&
        out.z > box.minZ && out.z < box.maxZ) {
      const dL = Math.abs(out.x - box.minX);
      const dR = Math.abs(out.x - box.maxX);
      const dF = Math.abs(out.z - box.minZ);
      const dB = Math.abs(out.z - box.maxZ);
      const m  = Math.min(dL, dR, dF, dB);
      if      (m === dL) out.x = box.minX - radius;
      else if (m === dR) out.x = box.maxX + radius;
      else if (m === dF) out.z = box.minZ - radius;
      else               out.z = box.maxZ + radius;
    }
  }
  out.x = THREE.MathUtils.clamp(out.x, -MAP_LIMIT, MAP_LIMIT);
  out.z = THREE.MathUtils.clamp(out.z, -MAP_LIMIT, MAP_LIMIT);
  return out;
}

// ── Wheel positions in model-local space [x, z] ───────────────────────────────
// (model group is rotated Math.PI, so local +Z = world backward)
const WHEEL_POSITIONS: [number, number][] = [
  [-1.7,  3.0], [ 1.7,  3.0],   // front
  [-1.7, -1.0], [ 1.7, -1.0],   // mid
  [-1.7, -3.5], [ 1.7, -3.5],   // rear
];

// ── Props ──────────────────────────────────────────────────────────────────────
interface PlayerProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function Player({ positionRef, yawRef }: PlayerProps) {
  const groupRef   = useRef<THREE.Group>(null);     // physics / transform group
  const velRef     = useRef(0);                     // current linear velocity

  // Six wheel group refs — indexed to match WHEEL_POSITIONS
  const wheelRefs  = useRef<(THREE.Group | null)[]>(new Array(6).fill(null));

  // Headlight spot targets
  const targetLRef = useRef<THREE.Group>(null);
  const targetRRef = useRef<THREE.Group>(null);
  const headLRef   = useRef<THREE.SpotLight>(null);
  const headRRef   = useRef<THREE.SpotLight>(null);

  const [, getKeys] = useKeyboardControls<Controls>();
  const { phase, schools, currentMissionIndex, deliverPackage } = useGameStore();

  // Wire SpotLight.target after mount (must be Objects in the scene)
  useEffect(() => {
    if (headLRef.current && targetLRef.current)
      headLRef.current.target = targetLRef.current;
    if (headRRef.current && targetRRef.current)
      headRRef.current.target = targetRRef.current;
  }, []);

  useEffect(() => {
    positionRef.current.set(0, 0, 0);
    yawRef.current = 0;
  }, [positionRef, yawRef]);

  useFrame((state, delta) => {
    if (phase !== 'playing') return;
    const group = groupRef.current;
    if (!group) return;

    const keys = getKeys();

    // ── Turning (only when moving — natural truck steering) ─────────────────
    if (Math.abs(velRef.current) > 0.3) {
      const dir = velRef.current > 0 ? 1 : -1;
      if (keys.left)  yawRef.current += TURN_SPEED * delta * dir;
      if (keys.right) yawRef.current -= TURN_SPEED * delta * dir;
    }

    // ── Velocity ─────────────────────────────────────────────────────────────
    const targetVel = keys.forward ? SPEED : keys.back ? -REVERSE : 0;
    velRef.current += (targetVel - velRef.current) * Math.min(1, delta * ACCEL);

    // ── Movement: forward = -Z when yaw=0 ───────────────────────────────────
    const fwd = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current),
    );
    const candidate = group.position.clone().addScaledVector(fwd, velRef.current * delta);
    candidate.y = 0;
    const resolved = resolveCollision(candidate);

    group.position.copy(resolved);
    group.rotation.y = yawRef.current;

    // ── Wheel spin — angular velocity = linear velocity / wheel radius ───────
    // Positive velocity → wheels spin forward (rotation.x increases)
    const angularVel = (velRef.current / WHEEL_R) * delta;
    for (const wRef of wheelRefs.current) {
      if (wRef) wRef.rotation.x += angularVel;
    }

    // ── Share position and yaw with HUD / MiniMap / SoundManager ────────────
    positionRef.current.copy(resolved);

    // ── Camera — placed BEHIND the truck ────────────────────────────────────
    const camOffset = new THREE.Vector3(
      Math.sin(yawRef.current) * 16,
      8,
      Math.cos(yawRef.current) * 16,
    );
    state.camera.position.lerp(resolved.clone().add(camOffset), 0.07);
    state.camera.lookAt(resolved.x, 2.0, resolved.z);

    // ── Delivery: ONLY fire for the current mission target ───────────────────
    const active = schools[currentMissionIndex];
    if (active && !active.delivered) {
      const dx = resolved.x - active.position[0];
      const dz = resolved.z - active.position[2];
      if (Math.sqrt(dx * dx + dz * dz) < DELIVER_R) {
        deliverPackage(active.id);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/*
       * Visual model rotated Math.PI so the cabin faces the movement direction.
       * All meshes, wheels, and lights are children here.
       */}
      <group rotation={[0, Math.PI, 0]}>

        {/* Chassis */}
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.45, 8.5]} />
          <meshLambertMaterial color="#263238" />
        </mesh>

        {/* Cargo box */}
        <mesh position={[0, 2.0, -1.6]} castShadow>
          <boxGeometry args={[3.0, 3.2, 5.0]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        {/* Blue branding stripe */}
        <mesh position={[0, 2.0, -4.11]}>
          <boxGeometry args={[2.8, 1.0, 0.04]} />
          <meshLambertMaterial color="#1565c0" />
        </mesh>
        {/* Door edge lines */}
        <mesh position={[0, 0.58, -4.12]}>
          <boxGeometry args={[2.9, 0.06, 0.04]} />
          <meshLambertMaterial color="#bdbdbd" />
        </mesh>
        <mesh position={[0, 3.42, -4.12]}>
          <boxGeometry args={[2.9, 0.06, 0.04]} />
          <meshLambertMaterial color="#bdbdbd" />
        </mesh>

        {/* Cabin */}
        <mesh position={[0, 1.7, 2.8]} castShadow>
          <boxGeometry args={[3.0, 2.8, 2.4]} />
          <meshLambertMaterial color="#1565c0" />
        </mesh>
        {/* Windshield */}
        <mesh position={[0, 2.4, 4.01]}>
          <boxGeometry args={[2.4, 1.2, 0.06]} />
          <meshLambertMaterial color="#b3e5fc" transparent opacity={0.7} />
        </mesh>
        {/* Roof visor */}
        <mesh position={[0, 3.3, 3.5]}>
          <boxGeometry args={[3.1, 0.2, 1.6]} />
          <meshLambertMaterial color="#0d47a1" />
        </mesh>
        {/* Bumper */}
        <mesh position={[0, 0.6, 4.05]}>
          <boxGeometry args={[3.1, 0.5, 0.2]} />
          <meshLambertMaterial color="#9e9e9e" />
        </mesh>
        {/* Headlight lenses */}
        <mesh position={[-0.9, 1.2, 4.01]}>
          <boxGeometry args={[0.7, 0.35, 0.06]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
        <mesh position={[0.9, 1.2, 4.01]}>
          <boxGeometry args={[0.7, 0.35, 0.06]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
        {/* Side mirrors */}
        <mesh position={[-1.65, 2.6, 3.2]}>
          <boxGeometry args={[0.3, 0.18, 0.5]} />
          <meshLambertMaterial color="#37474f" />
        </mesh>
        <mesh position={[1.65, 2.6, 3.2]}>
          <boxGeometry args={[0.3, 0.18, 0.5]} />
          <meshLambertMaterial color="#37474f" />
        </mesh>
        {/* Exhaust */}
        <mesh position={[-1.6, 3.6, 1.5]}>
          <cylinderGeometry args={[0.1, 0.1, 2.5, 7]} />
          <meshLambertMaterial color="#616161" />
        </mesh>

        {/* ── Six wheels — refs collected for rotation in useFrame ── */}
        {WHEEL_POSITIONS.map(([wx, wz], i) => (
          <group
            key={i}
            ref={el => { wheelRefs.current[i] = el; }}
            position={[wx, 0.55, wz]}
          >
            {/* Tyre — cylinder lying along X axis */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.42, 14]} />
              <meshLambertMaterial color="#1a1a1a" />
            </mesh>
            {/* Hub */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.28, 0.28, 0.44, 8]} />
              <meshLambertMaterial color="#bdbdbd" />
            </mesh>
          </group>
        ))}

        {/* ── Headlights (SpotLights as children = move with truck) ── */}
        <spotLight
          ref={headLRef}
          position={[-0.9, 1.2, 4.1]}
          angle={0.35}
          penumbra={0.5}
          intensity={6}
          color="#fffde7"
          distance={50}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <group ref={targetLRef} position={[-0.9, 0, 20]} />

        <spotLight
          ref={headRRef}
          position={[0.9, 1.2, 4.1]}
          angle={0.35}
          penumbra={0.5}
          intensity={6}
          color="#fffde7"
          distance={50}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <group ref={targetRRef} position={[0.9, 0, 20]} />

        {/* Tail lights */}
        <pointLight position={[-1.0, 1.2, -4.2]} color="#ef5350" intensity={1.5} distance={6} />
        <pointLight position={[ 1.0, 1.2, -4.2]} color="#ef5350" intensity={1.5} distance={6} />
        <mesh position={[-1.0, 1.2, -4.12]}>
          <boxGeometry args={[0.5, 0.25, 0.04]} />
          <meshBasicMaterial color="#ef5350" />
        </mesh>
        <mesh position={[1.0, 1.2, -4.12]}>
          <boxGeometry args={[0.5, 0.25, 0.04]} />
          <meshBasicMaterial color="#ef5350" />
        </mesh>

      </group>
    </group>
  );
}
