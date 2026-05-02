/**
 * Checkpoints.tsx
 * Renders visual markers for each school / delivery point.
 *
 * Each school has:
 *  • A glowing red/yellow sphere floating above (delivery target indicator)
 *  • A ground zone ring (pulses for the active target)
 *  • A simplified school building
 *  • A floating name label
 *  • After delivery: sphere turns green, ring turns green, building gains a tick
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

// ── Single checkpoint marker ──────────────────────────────────────────────────
interface MarkerProps {
  position: [number, number, number];
  name: string;
  delivered: boolean;
  isTarget: boolean;
  index: number;
}

function CheckpointMarker({ position, name, delivered, isTarget, index }: MarkerProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef   = useRef<THREE.Mesh>(null);
  const lightRef  = useRef<THREE.PointLight>(null);

  // Animate the sphere and ring each frame
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 1.3; // offset so each school is out of phase

    if (sphereRef.current) {
      // Bob up and down
      sphereRef.current.position.y = 7.5 + Math.sin(t * 1.6) * 0.4;
      // Spin slowly
      sphereRef.current.rotation.y = t * 0.8;
    }

    // Pulse ring for current target
    if (ringRef.current && isTarget && !delivered) {
      const pulse = 1 + Math.sin(t * 3.5) * 0.15;
      ringRef.current.scale.setScalar(pulse);
    }

    // Pulse light
    if (lightRef.current && !delivered) {
      lightRef.current.intensity = isTarget
        ? 2.0 + Math.sin(t * 4) * 0.8
        : 0.6;
    }
  });

  const [x, , z] = position;

  // Colours driven by state
  const sphereColor = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef5350';
  const ringColor   = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef9a9a';
  const lightColor  = delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef5350';
  const roofColor   = delivered ? '#66bb6a' : '#e53935';
  const wallColor   = delivered ? '#a5d6a7' : '#ffcc02';

  return (
    <group position={[x, 0, z]}>

      {/* ── Ground zone ── */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[3.5, 4.0, 36]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={delivered ? 0.4 : 0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Filled zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[3.5, 36]} />
        <meshBasicMaterial
          color={delivered ? '#a5d6a7' : isTarget ? '#fff9c4' : '#ffcdd2'}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── School building ── */}
      {/* Main walls */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.0, 3.6, 4.0]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 3.9, 0]} castShadow>
        <coneGeometry args={[3.2, 1.5, 4]} />
        <meshLambertMaterial color={roofColor} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.8, 2.01]}>
        <boxGeometry args={[0.9, 1.6, 0.06]} />
        <meshLambertMaterial color="#795548" />
      </mesh>
      {/* Windows */}
      <mesh position={[-1.2, 2.0, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.06]} />
        <meshLambertMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      <mesh position={[1.2, 2.0, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.06]} />
        <meshLambertMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      {/* Flag pole */}
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5, 6]} />
        <meshLambertMaterial color="#9e9e9e" />
      </mesh>

      {/* ── Floating target sphere ── */}
      <mesh ref={sphereRef} position={[0, 7.5, 0]} castShadow>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshStandardMaterial
          color={sphereColor}
          emissive={sphereColor}
          emissiveIntensity={delivered ? 0.3 : isTarget ? 0.8 : 0.5}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Glow point light at sphere position */}
      {!delivered && (
        <pointLight
          ref={lightRef}
          position={[0, 7.5, 0]}
          color={lightColor}
          intensity={1.5}
          distance={15}
        />
      )}

      {/* ── Delivered checkmark sphere ── */}
      {delivered && (
        <mesh position={[0, 7.5, 0]}>
          <sphereGeometry args={[0.65, 16, 16]} />
          <meshStandardMaterial
            color="#66bb6a"
            emissive="#66bb6a"
            emissiveIntensity={0.4}
          />
        </mesh>
      )}

      {/* ── Name label ── */}
      <Text
        position={[0, 9.8, 0]}
        fontSize={0.75}
        color={delivered ? '#a5d6a7' : isTarget ? '#ffd54f' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#000000"
      >
        {delivered ? '✓ ' : isTarget ? '📦 ' : ''}{name}
      </Text>
    </group>
  );
}

// ── Checkpoints collection ────────────────────────────────────────────────────
export function Checkpoints() {
  const { schools } = useGameStore();
  const currentTarget = schools.find(s => !s.delivered);

  return (
    <>
      {schools.map((school, i) => (
        <CheckpointMarker
          key={school.id}
          index={i}
          position={school.position}
          name={school.name}
          delivered={school.delivered}
          isTarget={currentTarget?.id === school.id}
        />
      ))}
    </>
  );
}
