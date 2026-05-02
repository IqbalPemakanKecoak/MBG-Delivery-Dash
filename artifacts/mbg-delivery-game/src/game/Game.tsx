/**
 * Game.tsx
 * Main game canvas. Composes all subsystems:
 *  World → Trees → Checkpoints → Player → DayNightCycle → SoundManager
 *
 * KeyboardControls wraps the Canvas so input works even without focus tricks.
 */
import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

import { Controls } from './Player';
import { Player } from './Player';
import { World } from './World';
import { Trees } from './Trees';
import { Checkpoints } from './Checkpoints';
import { DayNightCycle } from './DayNightCycle';
import { SoundManager } from './SoundManager';
import { GameUI } from './GameUI';
import { Narration } from './Narration';
import { useGameStore } from './useGameStore';

// ── Key mappings ──────────────────────────────────────────────────────────────
const KEY_MAP = [
  { name: Controls.forward, keys: ['ArrowUp',    'KeyW'] },
  { name: Controls.back,    keys: ['ArrowDown',  'KeyS'] },
  { name: Controls.left,    keys: ['ArrowLeft',  'KeyA'] },
  { name: Controls.right,   keys: ['ArrowRight', 'KeyD'] },
];

// ── Timer ticker (inside Canvas) ──────────────────────────────────────────────
import { useFrame } from '@react-three/fiber';

function TimerTicker() {
  const { tickTimer } = useGameStore();
  useFrame((_, delta) => tickTimer(delta));
  return null;
}

// ── Scene contents ────────────────────────────────────────────────────────────
function SceneContents({ posRef }: { posRef: React.MutableRefObject<THREE.Vector3> }) {
  return (
    <>
      <DayNightCycle />
      <World />
      <Trees />
      <Checkpoints />
      <Player positionRef={posRef} />
      <SoundManager playerPositionRef={posRef} />
      <TimerTicker />
    </>
  );
}

// ── Main Game component ───────────────────────────────────────────────────────
export function Game() {
  // Shared ref for player position — passed to SoundManager
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          camera={{ position: [0, 8, 14], fov: 65, near: 0.1, far: 300 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <SceneContents posRef={playerPosRef} />
        </Canvas>
      </KeyboardControls>

      {/* HTML overlay: HUD + Narration panels */}
      <GameUI />
      <Narration />
    </div>
  );
}
