/**
 * Checkpoints.tsx
 * Renders visual markers for each school / delivery point.
 * Delivered schools show a green tick; pending ones show a pulsing flag.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

// ── Single checkpoint marker ─────────────────────────────────────────────────

interface MarkerProps {
  position: [number, number, number];
  name: string;
  delivered: boolean;
  isTarget: boolean;
}

function CheckpointMarker({ position, name, delivered, isTarget }: MarkerProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const poleRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Pulse ring for the current target
    if (ringRef.current && isTarget && !delivered) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
    }
    // Gentle bob for undelivered markers
    if (poleRef.current && !delivered) {
      poleRef.current.position.y = Math.sin(t * 1.5) * 0.15;
    }
  });

  const [x, , z] = position;
  const baseY = 0;

  return (
    <group position={[x, baseY, z]}>
      {/* Ground ring / zone indicator */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[2.8, 3.2, 32]} />
        <meshBasicMaterial
          color={delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#90caf9'}
          transparent
          opacity={delivered ? 0.5 : 0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Fill circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[2.8, 32]} />
        <meshBasicMaterial
          color={delivered ? '#a5d6a7' : isTarget ? '#fff9c4' : '#e3f2fd'}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Flag pole group — bobs when undelivered */}
      <group ref={poleRef}>
        {/* Pole */}
        <mesh position={[0, 3.5, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 7, 6]} />
          <meshLambertMaterial color={delivered ? '#66bb6a' : '#ef5350'} />
        </mesh>

        {/* Flag / icon */}
        {!delivered ? (
          <mesh position={[0.6, 6.5, 0]}>
            <boxGeometry args={[1.2, 0.8, 0.08]} />
            <meshLambertMaterial color={isTarget ? '#ffd54f' : '#ef5350'} />
          </mesh>
        ) : (
          /* Delivered – green checkmark flag */
          <mesh position={[0.6, 6.5, 0]}>
            <boxGeometry args={[1.2, 0.8, 0.08]} />
            <meshLambertMaterial color="#66bb6a" />
          </mesh>
        )}

        {/* School building silhouette */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[3.5, 3, 3.5]} />
          <meshLambertMaterial color={delivered ? '#a5d6a7' : '#ffcc02'} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 3.2, 0]}>
          <coneGeometry args={[2.6, 1.2, 4]} />
          <meshLambertMaterial color={delivered ? '#66bb6a' : '#e53935'} />
        </mesh>
      </group>

      {/* Floating name label */}
      <Text
        position={[0, 8.5, 0]}
        fontSize={0.7}
        color={delivered ? '#a5d6a7' : isTarget ? '#ffd54f' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {delivered ? '✓ ' : ''}{name}
      </Text>
    </group>
  );
}

// ── Checkpoints collection ────────────────────────────────────────────────────

export function Checkpoints() {
  const { schools, currentMissionIndex } = useGameStore();
  const currentTarget = schools.find(s => !s.delivered);

  return (
    <>
      {schools.map((school) => (
        <CheckpointMarker
          key={school.id}
          position={school.position}
          name={school.name}
          delivered={school.delivered}
          isTarget={currentTarget?.id === school.id}
        />
      ))}
    </>
  );
}
