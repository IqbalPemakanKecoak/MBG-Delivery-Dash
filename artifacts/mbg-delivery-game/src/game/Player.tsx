/**
 * Player.tsx
 * Controls the motorbike player:
 *  • WASD / arrow keys for movement via @react-three/drei KeyboardControls
 *  • AABB collision detection against buildings
 *  • Third-person follow camera
 *  • Delivery trigger when within 3 units of a school checkpoint
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

// ── Constants ────────────────────────────────────────────────────────────────
const SPEED       = 18;   // units/s
const TURN_SPEED  = 2.0;  // rad/s
const DELIVER_R   = 4.0;  // delivery trigger radius (units)
const MAP_LIMIT   = 65;   // keep player within ±65 on X and Z

// Pre-build AABBs once (same each frame – stable ref)
const BUILDING_AABBS: AABB[] = computeBuildingAABBs();

// ── Collision helper ─────────────────────────────────────────────────────────
function resolveCollision(pos: THREE.Vector3, radius = 1.2): THREE.Vector3 {
  const out = pos.clone();
  for (const box of BUILDING_AABBS) {
    const inX = out.x > box.minX && out.x < box.maxX;
    const inZ = out.z > box.minZ && out.z < box.maxZ;
    if (inX && inZ) {
      // Push out along the shallowest axis
      const dLeft  = Math.abs(out.x - box.minX);
      const dRight = Math.abs(out.x - box.maxX);
      const dFront = Math.abs(out.z - box.minZ);
      const dBack  = Math.abs(out.z - box.maxZ);
      const minD   = Math.min(dLeft, dRight, dFront, dBack);
      if (minD === dLeft)  out.x = box.minX - radius;
      else if (minD === dRight) out.x = box.maxX + radius;
      else if (minD === dFront) out.z = box.minZ - radius;
      else                      out.z = box.maxZ + radius;
    }
  }
  // Map boundary clamp
  out.x = THREE.MathUtils.clamp(out.x, -MAP_LIMIT, MAP_LIMIT);
  out.z = THREE.MathUtils.clamp(out.z, -MAP_LIMIT, MAP_LIMIT);
  return out;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlayerProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
}

// ── Player component ─────────────────────────────────────────────────────────
export function Player({ positionRef }: PlayerProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const wheelFRef  = useRef<THREE.Mesh>(null);
  const wheelBRef  = useRef<THREE.Mesh>(null);
  const velRef     = useRef(0);           // current forward speed
  const yawRef     = useRef(0);           // facing angle (radians)

  const [, getKeys] = useKeyboardControls<Controls>();
  const { phase, schools, deliverPackage } = useGameStore();

  // Sync positionRef on mount
  useEffect(() => {
    positionRef.current.set(0, 0, 0);
  }, [positionRef]);

  useFrame((state, delta) => {
    if (phase !== 'playing') return;
    const group = groupRef.current;
    if (!group) return;

    const keys = getKeys();

    // ── Rotation ──────────────────────────────────────────────────────────
    if (keys.left)  yawRef.current += TURN_SPEED * delta;
    if (keys.right) yawRef.current -= TURN_SPEED * delta;

    // ── Acceleration ──────────────────────────────────────────────────────
    const targetSpeed = keys.forward ? SPEED : keys.back ? -SPEED * 0.5 : 0;
    velRef.current += (targetSpeed - velRef.current) * Math.min(1, delta * 6);

    // ── Move ──────────────────────────────────────────────────────────────
    const dir = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current),
    );
    const candidate = group.position.clone().addScaledVector(dir, velRef.current * delta);
    candidate.y = 0;
    const resolved  = resolveCollision(candidate);

    group.position.copy(resolved);
    group.rotation.y = yawRef.current;

    // ── Wheel spin ────────────────────────────────────────────────────────
    const spin = (velRef.current / 1.2) * delta;
    if (wheelFRef.current) wheelFRef.current.rotation.x += spin;
    if (wheelBRef.current) wheelBRef.current.rotation.x += spin;

    // ── Expose position for sound/delivery checks ─────────────────────────
    positionRef.current.copy(resolved);

    // ── Delivery trigger ──────────────────────────────────────────────────
    for (const school of schools) {
      if (school.delivered) continue;
      const dx = resolved.x - school.position[0];
      const dz = resolved.z - school.position[2];
      if (Math.sqrt(dx * dx + dz * dz) < DELIVER_R) {
        deliverPackage(school.id);
      }
    }

    // ── Camera follow ─────────────────────────────────────────────────────
    const camOffset = new THREE.Vector3(
      Math.sin(yawRef.current) * 14,
      7,
      Math.cos(yawRef.current) * 14,
    );
    const camTarget = resolved.clone().add(camOffset);
    state.camera.position.lerp(camTarget, 0.08);
    state.camera.lookAt(resolved.x, 1.5, resolved.z);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* ── Body ── */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.7, 0.5, 1.8]} />
        <meshLambertMaterial color="#1565c0" />
      </mesh>

      {/* ── Fuel box / cargo */}
      <mesh position={[0, 1.0, 0.3]} castShadow>
        <boxGeometry args={[0.55, 0.45, 0.9]} />
        <meshLambertMaterial color="#0d47a1" />
      </mesh>

      {/* ── Delivery box ── */}
      <mesh position={[0, 1.2, -0.6]} castShadow>
        <boxGeometry args={[0.6, 0.5, 0.6]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      {/* Box lid */}
      <mesh position={[0, 1.47, -0.6]}>
        <boxGeometry args={[0.62, 0.05, 0.62]} />
        <meshLambertMaterial color="#e3f2fd" />
      </mesh>

      {/* ── Rider helmet ── */}
      <mesh position={[0, 1.45, 0.55]} castShadow>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshLambertMaterial color="#4caf50" />
      </mesh>

      {/* ── Handlebars ── */}
      <mesh position={[0, 0.95, 0.9]}>
        <boxGeometry args={[0.9, 0.06, 0.06]} />
        <meshLambertMaterial color="#424242" />
      </mesh>

      {/* ── Front wheel ── */}
      <mesh ref={wheelFRef} position={[0, 0.28, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.14, 14]} />
        <meshLambertMaterial color="#212121" />
      </mesh>
      <mesh position={[0, 0.28, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.16, 8]} />
        <meshLambertMaterial color="#757575" />
      </mesh>

      {/* ── Rear wheel ── */}
      <mesh ref={wheelBRef} position={[0, 0.28, -0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.14, 14]} />
        <meshLambertMaterial color="#212121" />
      </mesh>
      <mesh position={[0, 0.28, -0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.16, 8]} />
        <meshLambertMaterial color="#757575" />
      </mesh>

      {/* ── Exhaust pipe ── */}
      <mesh position={[0.36, 0.4, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 6]} />
        <meshLambertMaterial color="#9e9e9e" />
      </mesh>

      {/* ── Headlight ── */}
      <mesh position={[0, 0.8, 1.0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#fffde7" />
      </mesh>
    </group>
  );
}
