/**
 * Player.tsx — Delivery Truck
 *
 * WHY W WAS BACKWARDS:
 * The truck model's cabin faced local +Z, but movement used direction (-sin, 0, -cos)
 * which is -Z when yaw=0. The truck was driving tail-first.
 * FIX: wrap all mesh parts in an inner <group rotation-y={Math.PI}>. This spins the
 * visual model 180° so the cabin now faces -Z = the actual movement direction.
 * The physics group (groupRef) remains untouched — position and yaw are still correct.
 *
 * HEADLIGHTS:
 * Two SpotLights live inside the rotated model group as children. Because they are
 * child objects they automatically move and rotate with the truck. Their target groups
 * are also children placed far ahead in model space, so the beams always point forward.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';
import { computeBuildingAABBs, AABB } from './World';

// ── Control enum (must match keyMap in Game.tsx) ─────────────────────────────
export enum Controls {
  forward = 'forward',
  back    = 'back',
  left    = 'left',
  right   = 'right',
}

// ── Truck constants ───────────────────────────────────────────────────────────
const SPEED      = 12;   // units/s – slower than a motorbike
const REVERSE    = 6;    // reverse speed
const TURN_SPEED = 1.4;  // rad/s – wide turns like a real truck
const ACCEL      = 4;    // acceleration smoothing factor
const DELIVER_R  = 5.0;  // delivery trigger radius (units)
const MAP_LIMIT  = 65;

// Pre-build AABBs once — stable ref, never rebuilt
const BUILDING_AABBS: AABB[] = computeBuildingAABBs();

// ── AABB collision resolver ───────────────────────────────────────────────────
function resolveCollision(pos: THREE.Vector3, radius = 1.8): THREE.Vector3 {
  const out = pos.clone();
  for (const box of BUILDING_AABBS) {
    const inX = out.x > box.minX && out.x < box.maxX;
    const inZ = out.z > box.minZ && out.z < box.maxZ;
    if (inX && inZ) {
      const dL = Math.abs(out.x - box.minX);
      const dR = Math.abs(out.x - box.maxX);
      const dF = Math.abs(out.z - box.minZ);
      const dB = Math.abs(out.z - box.maxZ);
      const m  = Math.min(dL, dR, dF, dB);
      if (m === dL)      out.x = box.minX - radius;
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

// ── Truck wheel helper ────────────────────────────────────────────────────────
function Wheel({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  // expose to parent via userData for spin access
  return (
    <group ref={ref} position={[x, 0.55, z]} userData={{ wheelGroup: true }}>
      {/* Tyre */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.42, 14]} />
        <meshLambertMaterial color="#1a1a1a" />
      </mesh>
      {/* Hub */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.44, 8]} />
        <meshLambertMaterial color="#bdbdbd" />
      </mesh>
    </group>
  );
}

// ── Main player component ─────────────────────────────────────────────────────
export function Player({ positionRef, yawRef }: PlayerProps) {
  const groupRef     = useRef<THREE.Group>(null);   // physics group
  const modelRef     = useRef<THREE.Group>(null);   // visual model (rotated π)
  const velRef       = useRef(0);                   // current speed

  // Headlight targets — must be in scene as Objects so SpotLight.target works
  const targetLRef   = useRef<THREE.Group>(null);
  const targetRRef   = useRef<THREE.Group>(null);
  const headLRef     = useRef<THREE.SpotLight>(null);
  const headRRef     = useRef<THREE.SpotLight>(null);

  const [, getKeys] = useKeyboardControls<Controls>();
  const { phase, schools, deliverPackage } = useGameStore();

  // Wire SpotLight targets after mount
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

    // ── Turn (only while moving for realism) ────────────────────────────────
    const moving = Math.abs(velRef.current) > 0.3;
    if (moving) {
      // Turn direction flips when reversing (natural steering)
      const dir = velRef.current > 0 ? 1 : -1;
      if (keys.left)  yawRef.current += TURN_SPEED * delta * dir;
      if (keys.right) yawRef.current -= TURN_SPEED * delta * dir;
    }

    // ── Throttle & brake ────────────────────────────────────────────────────
    const target = keys.forward ? SPEED : keys.back ? -REVERSE : 0;
    velRef.current += (target - velRef.current) * Math.min(1, delta * ACCEL);

    // ── Movement direction: -Z when yaw=0 = FORWARD ─────────────────────────
    // After rotating the model by π the cabin faces this direction.
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

    // ── Expose shared state ──────────────────────────────────────────────────
    positionRef.current.copy(resolved);

    // ── Camera: placed BEHIND the truck (opposite of forward dir) ───────────
    // Behind = +Z when yaw=0, which is +sin, +cos
    const camOffset = new THREE.Vector3(
      Math.sin(yawRef.current) * 16,
      8,
      Math.cos(yawRef.current) * 16,
    );
    state.camera.position.lerp(resolved.clone().add(camOffset), 0.07);
    state.camera.lookAt(resolved.x, 2.0, resolved.z);

    // ── Delivery check ───────────────────────────────────────────────────────
    for (const school of schools) {
      if (school.delivered) continue;
      const dx = resolved.x - school.position[0];
      const dz = resolved.z - school.position[2];
      if (Math.sqrt(dx * dx + dz * dz) < DELIVER_R) {
        deliverPackage(school.id);
      }
    }
  });

  return (
    // Physics / transform group — only position + rotation.y are set here
    <group ref={groupRef} position={[0, 0, 0]}>

      {/*
       * Visual model group — rotated Math.PI so the CABIN (at local +Z)
       * ends up facing the actual movement direction (-Z world when yaw=0).
       * ALL meshes and lights live inside this group.
       */}
      <group ref={modelRef} rotation={[0, Math.PI, 0]}>

        {/* ── Chassis / frame ── */}
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.45, 8.5]} />
          <meshLambertMaterial color="#263238" />
        </mesh>

        {/* ── Cargo box (rear) ── */}
        <mesh position={[0, 2.0, -1.6]} castShadow>
          <boxGeometry args={[3.0, 3.2, 5.0]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        {/* BPGN logo stripe */}
        <mesh position={[0, 2.0, -4.11]}>
          <boxGeometry args={[2.8, 1.0, 0.04]} />
          <meshLambertMaterial color="#1565c0" />
        </mesh>
        {/* Cargo door lines */}
        <mesh position={[0, 0.58, -4.12]}>
          <boxGeometry args={[2.9, 0.06, 0.04]} />
          <meshLambertMaterial color="#bdbdbd" />
        </mesh>
        <mesh position={[0, 3.42, -4.12]}>
          <boxGeometry args={[2.9, 0.06, 0.04]} />
          <meshLambertMaterial color="#bdbdbd" />
        </mesh>

        {/* ── Cabin (front) ── */}
        <mesh position={[0, 1.7, 2.8]} castShadow>
          <boxGeometry args={[3.0, 2.8, 2.4]} />
          <meshLambertMaterial color="#1565c0" />
        </mesh>
        {/* Windshield */}
        <mesh position={[0, 2.4, 4.01]}>
          <boxGeometry args={[2.4, 1.2, 0.06]} />
          <meshLambertMaterial color="#b3e5fc" transparent opacity={0.7} />
        </mesh>
        {/* Cabin roof visor */}
        <mesh position={[0, 3.3, 3.5]}>
          <boxGeometry args={[3.1, 0.2, 1.6]} />
          <meshLambertMaterial color="#0d47a1" />
        </mesh>
        {/* Front bumper */}
        <mesh position={[0, 0.6, 4.05]}>
          <boxGeometry args={[3.1, 0.5, 0.2]} />
          <meshLambertMaterial color="#9e9e9e" />
        </mesh>
        {/* Headlight housings */}
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
        {/* Exhaust stack */}
        <mesh position={[-1.6, 3.6, 1.5]}>
          <cylinderGeometry args={[0.1, 0.1, 2.5, 7]} />
          <meshLambertMaterial color="#616161" />
        </mesh>

        {/* ── Wheels (6-wheel truck) ── */}
        <Wheel x={-1.7} z={ 3.0} />  {/* front-left  */}
        <Wheel x={ 1.7} z={ 3.0} />  {/* front-right */}
        <Wheel x={-1.7} z={-1.0} />  {/* mid-left    */}
        <Wheel x={ 1.7} z={-1.0} />  {/* mid-right   */}
        <Wheel x={-1.7} z={-3.5} />  {/* rear-left   */}
        <Wheel x={ 1.7} z={-3.5} />  {/* rear-right  */}

        {/*
         * ── Headlights ──
         * SpotLights are children of the model group, so they move with the truck.
         * target groups placed far forward (local +Z) tell the lights where to shine.
         * After the model's Math.PI rotation, local +Z = world -Z = forward. ✓
         */}
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
        {/* Left headlight target — far ahead in local +Z */}
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
        {/* Right headlight target */}
        <group ref={targetRRef} position={[0.9, 0, 20]} />

        {/* Tail lights glow */}
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

      </group>{/* end model group */}
    </group>
  );
}
