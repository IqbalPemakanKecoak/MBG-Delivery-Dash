/**
 * Player.tsx — Delivery Truck
 *
 * Vehicle feel improvements:
 *  • Smooth steering: steerRef lerps toward ±1, giving a gradual turn-in/out.
 *  • Inertia: ACCEL split into ACCEL_ON (throttle) and ACCEL_OFF (coast/brake)
 *    so the truck has a natural rolling feel when you release the pedal.
 *  • mobileInput is merged with keyboard getKeys() so both inputs work together.
 *
 * Wheel rotation:
 *  • 6 group refs stored in wheelRefs array.
 *  • Main useFrame spins them: rotation.x += (vel / WHEEL_R) * delta.
 *
 * Delivery:
 *  • Only fires for schools[currentMissionIndex] — no out-of-order delivery.
 *  • DELIVER_R = 3.5 units.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';
import { BUILDING_AABBS } from './World';
import { mobileInput } from './mobileControls';

export enum Controls {
  forward = 'forward',
  back    = 'back',
  left    = 'left',
  right   = 'right',
}

// ── Tuning ────────────────────────────────────────────────────────────────────
const SPEED      = 12;    // max forward speed (units/s)
const REVERSE    = 6;     // max reverse speed
const TURN_SPEED = 1.5;   // max yaw rate (rad/s)
const ACCEL_ON   = 5;     // throttle-on smoothing
const ACCEL_OFF  = 2.5;   // coast / release inertia (lower = longer roll)
const STEER_RATE = 7;     // steering smoothing (higher = sharper)
const DELIVER_R  = 3.5;
const MAP_LIMIT  = 65;
const WHEEL_R    = 0.55;

// ── Wheel positions in model-local space [x, z] ───────────────────────────────
const WHEEL_POS: [number, number][] = [
  [-1.7,  3.0], [ 1.7,  3.0],
  [-1.7, -1.0], [ 1.7, -1.0],
  [-1.7, -3.5], [ 1.7, -3.5],
];

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

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlayerProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function Player({ positionRef, yawRef }: PlayerProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const velRef     = useRef(0);
  const steerRef   = useRef(0);   // smooth steering value [-1, +1]
  const wheelRefs  = useRef<(THREE.Group | null)[]>(new Array(6).fill(null));
  const targetLRef = useRef<THREE.Group>(null);
  const targetRRef = useRef<THREE.Group>(null);
  const headLRef   = useRef<THREE.SpotLight>(null);
  const headRRef   = useRef<THREE.SpotLight>(null);

  const [, getKeys] = useKeyboardControls<Controls>();
  const { phase, schools, currentMissionIndex, deliverPackage } = useGameStore();

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

    const kb = getKeys();

    // ── Merge keyboard + mobile input ────────────────────────────────────────
    const fwd = kb.forward || mobileInput.forward;
    const bwd = kb.back    || mobileInput.back;
    const lft = kb.left    || mobileInput.left;
    const rgt = kb.right   || mobileInput.right;

    // ── Smooth steering [-1 = full right turn, +1 = full left turn] ─────────
    const steerTarget = lft ? 1 : rgt ? -1 : 0;
    steerRef.current += (steerTarget - steerRef.current) * Math.min(1, delta * STEER_RATE);

    // Apply turn (only while moving for natural truck feel)
    if (Math.abs(velRef.current) > 0.3) {
      const dir = velRef.current > 0 ? 1 : -1;
      yawRef.current += TURN_SPEED * delta * dir * steerRef.current;
    }

    // ── Velocity with asymmetric inertia ─────────────────────────────────────
    const targetVel = fwd ? SPEED : bwd ? -REVERSE : 0;
    const accel = (Math.abs(targetVel) > Math.abs(velRef.current) || targetVel !== 0)
      ? ACCEL_ON
      : ACCEL_OFF;
    velRef.current += (targetVel - velRef.current) * Math.min(1, delta * accel);

    // ── Movement ─────────────────────────────────────────────────────────────
    const fwdVec = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current),
    );
    const candidate = group.position.clone()
      .addScaledVector(fwdVec, velRef.current * delta);
    candidate.y = 0;
    const resolved = resolveCollision(candidate);

    group.position.copy(resolved);
    group.rotation.y = yawRef.current;

    // ── Wheel spin ────────────────────────────────────────────────────────────
    const angVel = (velRef.current / WHEEL_R) * delta;
    for (const w of wheelRefs.current) {
      if (w) w.rotation.x += angVel;
    }

    // ── Share position ────────────────────────────────────────────────────────
    positionRef.current.copy(resolved);

    // ── Camera ───────────────────────────────────────────────────────────────
    const camOff = new THREE.Vector3(
      Math.sin(yawRef.current) * 16,
      8,
      Math.cos(yawRef.current) * 16,
    );
    state.camera.position.lerp(resolved.clone().add(camOff), 0.07);
    state.camera.lookAt(resolved.x, 2.0, resolved.z);

    // ── Delivery (active target only) ────────────────────────────────────────
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
        <mesh position={[0, 2.0, -4.11]}>
          <boxGeometry args={[2.8, 1.0, 0.04]} />
          <meshLambertMaterial color="#1565c0" />
        </mesh>
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
        <mesh position={[0, 2.4, 4.01]}>
          <boxGeometry args={[2.4, 1.2, 0.06]} />
          <meshLambertMaterial color="#b3e5fc" transparent opacity={0.7} />
        </mesh>
        <mesh position={[0, 3.3, 3.5]}>
          <boxGeometry args={[3.1, 0.2, 1.6]} />
          <meshLambertMaterial color="#0d47a1" />
        </mesh>
        <mesh position={[0, 0.6, 4.05]}>
          <boxGeometry args={[3.1, 0.5, 0.2]} />
          <meshLambertMaterial color="#9e9e9e" />
        </mesh>
        <mesh position={[-0.9, 1.2, 4.01]}>
          <boxGeometry args={[0.7, 0.35, 0.06]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
        <mesh position={[0.9, 1.2, 4.01]}>
          <boxGeometry args={[0.7, 0.35, 0.06]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
        <mesh position={[-1.65, 2.6, 3.2]}>
          <boxGeometry args={[0.3, 0.18, 0.5]} />
          <meshLambertMaterial color="#37474f" />
        </mesh>
        <mesh position={[1.65, 2.6, 3.2]}>
          <boxGeometry args={[0.3, 0.18, 0.5]} />
          <meshLambertMaterial color="#37474f" />
        </mesh>
        <mesh position={[-1.6, 3.6, 1.5]}>
          <cylinderGeometry args={[0.1, 0.1, 2.5, 7]} />
          <meshLambertMaterial color="#616161" />
        </mesh>

        {/* Six wheels */}
        {WHEEL_POS.map(([wx, wz], i) => (
          <group
            key={i}
            ref={el => { wheelRefs.current[i] = el; }}
            position={[wx, 0.55, wz]}
          >
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.42, 14]} />
              <meshLambertMaterial color="#1a1a1a" />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.28, 0.28, 0.44, 8]} />
              <meshLambertMaterial color="#bdbdbd" />
            </mesh>
          </group>
        ))}

        {/* Headlights */}
        <spotLight ref={headLRef} position={[-0.9, 1.2, 4.1]}
          angle={0.35} penumbra={0.5} intensity={6} color="#fffde7"
          distance={50} castShadow shadow-mapSize={[512, 512]} />
        <group ref={targetLRef} position={[-0.9, 0, 20]} />
        <spotLight ref={headRRef} position={[0.9, 1.2, 4.1]}
          angle={0.35} penumbra={0.5} intensity={6} color="#fffde7"
          distance={50} castShadow shadow-mapSize={[512, 512]} />
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
