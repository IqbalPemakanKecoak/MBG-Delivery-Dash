/**
 * Game.tsx
 * Root game canvas. Composes all scene systems and HTML overlays.
 *
 * Shared non-reactive refs (written by Player, read by overlays):
 *   playerPosRef — THREE.Vector3  current truck position
 *   playerYawRef — number         current facing angle (radians)
 */
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

import { Controls, Player } from './Player';
import { World } from './World';
import { Trees } from './Trees';
import { Checkpoints } from './Checkpoints';
import { DayNightCycle } from './DayNightCycle';
import { SoundManager } from './SoundManager';
import { MiniMap } from './MiniMap';
import { GameUI } from './GameUI';
import { Narration } from './Narration';
import { DirectionIndicator } from './DirectionIndicator';
import { useGameStore } from './useGameStore';

const KEY_MAP = [
  { name: Controls.forward, keys: ['ArrowUp',    'KeyW'] },
  { name: Controls.back,    keys: ['ArrowDown',  'KeyS'] },
  { name: Controls.left,    keys: ['ArrowLeft',  'KeyA'] },
  { name: Controls.right,   keys: ['ArrowRight', 'KeyD'] },
];

// Timer lives inside Canvas so it can use useFrame
function TimerTicker() {
  const { tickTimer } = useGameStore();
  useFrame((_, delta) => tickTimer(delta));
  return null;
}

interface SceneProps {
  posRef: React.MutableRefObject<THREE.Vector3>;
  yawRef: React.MutableRefObject<number>;
}

function SceneContents({ posRef, yawRef }: SceneProps) {
  return (
    <>
      <DayNightCycle />
      <World />
      <Trees />
      <Checkpoints />
      <Player positionRef={posRef} yawRef={yawRef} />
      <SoundManager playerPositionRef={posRef} />
      <TimerTicker />
    </>
  );
}

export function Game() {
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerYawRef = useRef<number>(0);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          camera={{ position: [0, 8, 16], fov: 65, near: 0.1, far: 300 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <SceneContents posRef={playerPosRef} yawRef={playerYawRef} />
        </Canvas>
      </KeyboardControls>

      {/* HTML overlays — rendered over the canvas */}
      <GameUI />
      <MiniMap positionRef={playerPosRef} yawRef={playerYawRef} />
      <DirectionIndicator positionRef={playerPosRef} yawRef={playerYawRef} />
      <Narration />
    </div>
  );
}
