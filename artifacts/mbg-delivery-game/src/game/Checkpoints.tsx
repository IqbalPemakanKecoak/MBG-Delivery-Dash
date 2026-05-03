/**
 * Checkpoints.tsx
 * Visual markers for each school delivery point.
 *
 * Fix: `isTarget` now uses `currentMissionIndex` (single source of truth),
 * not `schools.find(s => !s.delivered)` which could differ after out-of-order
 * delivery (now impossible, but the display was also wrong independently).
 *
 * GPS pulse: active target ring pulses with a bright glow and a wider scale.
 * A vertical "beacon" pillar of light shines up from the active target.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

interface MarkerProps {
  position: [number, number, number];
  name: string;
  delivered: boolean;
  isTarget: boolean;
  index: number;
}

function CheckpointMarker({ position, name, delivered, isTarget, index }: MarkerProps) {
  const sphereRef  = useRef<THREE.Mesh>(null);
  const ringRef    = useRef<THREE.Mesh>(null);
  const beaconRef  = useRef<THREE.Mesh>(null);
  const lightRef   = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 1.3;

    // Floating sphere: bob + spin
    if (sphereRef.current) {
      sphereRef.current.position.y = 7.5 + Math.sin(t * 1.6) * 0.4;
      sphereRef.current.rotation.y = t * 0.8;
    }

    // Active target: pulsing ring + stronger scale
    if (ringRef.current) {
      if (isTarget && !delivered) {
        const pulse = 1 + Math.sin(t * 3.2) * 0.18;
        ringRef.current.scale.setScalar(pulse);
      } else {
        ringRef.current.scale.setScalar(1);
      }
    }

    // Beacon pillar (active only)
    if (beaconRef.current) {
      const alpha = isTarget && !delivered ? 0.25 + Math.sin(t * 2.5) * 0.15 : 0;
      (beaconRef.current.material as THREE.MeshBasicMaterial).opacity = alpha;
    }

    // Point light pulse
    if (lightRef.current && !delivered) {
      lightRef.current.intensity = isTarget
        ? 2.2 + Math.sin(t * 4) * 0.9
        : 0.5;
    }
  });

  const [x, , z] = position;
  const sphereColor = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef5350';
  const ringColor   = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef9a9a';
  const lightColor  = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef5350';
  const roofColor   = delivered ? '#66bb6a' : '#e53935';
  const wallColor   = delivered ? '#a5d6a7' : '#ffcc02';

  return (
    <group position={[x, 0, z]}>

      {/* Ground ring (pulsing for active) */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[3.5, 4.2, 36]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={delivered ? 0.3 : isTarget ? 0.9 : 0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Filled zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[3.5, 36]} />
        <meshBasicMaterial
          color={delivered ? '#a5d6a7' : isTarget ? '#fff9c4' : '#ffcdd2'}
          transparent opacity={0.16} side={THREE.DoubleSide}
        />
      </mesh>

      {/* GPS beacon pillar (active target only) */}
      <mesh ref={beaconRef} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.15, 0.8, 12, 8, 1, true]} />
        <meshBasicMaterial
          color={isTarget ? '#ffd54f' : '#ffffff'}
          transparent opacity={0} side={THREE.DoubleSide}
        />
      </mesh>

      {/* School building */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 3.6, 4.0]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      <mesh position={[0, 3.9, 0]} castShadow>
        <coneGeometry args={[3.2, 1.5, 4]} />
        <meshLambertMaterial color={roofColor} />
      </mesh>
      <mesh position={[0, 0.8, 2.01]}>
        <boxGeometry args={[0.9, 1.6, 0.06]} />
        <meshLambertMaterial color="#795548" />
      </mesh>
      <mesh position={[-1.2, 2.0, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.06]} />
        <meshLambertMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      <mesh position={[1.2, 2.0, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.06]} />
        <meshLambertMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5, 6]} />
        <meshLambertMaterial color="#9e9e9e" />
      </mesh>

      {/* Floating sphere */}
      <mesh ref={sphereRef} position={[0, 7.5, 0]} castShadow>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={sphereColor}
          emissiveIntensity={delivered ? 0.3 : isTarget ? 0.9 : 0.45}
          roughness={0.3} metalness={0.2}
        />
      </mesh>

      {!delivered && (
        <pointLight
          ref={lightRef}
          position={[0, 7.5, 0]}
          color={lightColor}
          intensity={1.5}
          distance={18}
        />
      )}

      {/* Label */}
      <Text
        position={[0, 9.8, 0]}
        fontSize={0.75}
        color={delivered ? '#a5d6a7' : isTarget ? '#ffd54f' : '#ffffff'}
        anchorX="center" anchorY="middle"
        outlineWidth={0.06} outlineColor="#000000"
      >
        {delivered ? '✓ ' : isTarget ? '📦 ' : ''}{name}
      </Text>
    </group>
  );
}

export function Checkpoints() {
  // Use currentMissionIndex — single source of truth
  const { schools, currentMissionIndex } = useGameStore();

  return (
    <>
      {schools.map((school, i) => (
        <CheckpointMarker
          key={school.id}
          index={i}
          position={school.position}
          name={school.name}
          delivered={school.delivered}
          isTarget={i === currentMissionIndex && !school.delivered}
        />
      ))}
    </>
  );
}
