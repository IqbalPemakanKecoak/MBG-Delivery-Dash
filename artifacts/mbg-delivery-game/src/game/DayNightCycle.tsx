/**
 * DayNightCycle.tsx
 * Smoothly cycles between dawn → day → dusk → night over 120 seconds.
 * Controls:
 *  • Directional light (sun/moon) position and colour
 *  • Ambient light intensity and colour
 *  • Background (fog) colour for sky feel
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

// Total cycle length in seconds
const CYCLE = 120;

// Helper: lerp between two hex colours
function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

// Colour stops keyed to normalised time [0..1]
const SKY_STOPS = [
  { t: 0.00, color: new THREE.Color('#1a1035') }, // night
  { t: 0.20, color: new THREE.Color('#f4a261') }, // dawn
  { t: 0.30, color: new THREE.Color('#87ceeb') }, // morning
  { t: 0.55, color: new THREE.Color('#4fa3e3') }, // midday
  { t: 0.75, color: new THREE.Color('#e07b39') }, // dusk
  { t: 0.85, color: new THREE.Color('#3a1a55') }, // twilight
  { t: 1.00, color: new THREE.Color('#1a1035') }, // night
];

function sampleSkyColor(t: number): THREE.Color {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t);
      return lerpColor(a.color, b.color, local);
    }
  }
  return SKY_STOPS[0].color;
}

export function DayNightCycle() {
  const { phase } = useGameStore();
  const elapsed = useRef(30); // start at t=0.25 (morning)
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);

  useFrame((state, delta) => {
    if (phase === 'playing') elapsed.current = (elapsed.current + delta) % CYCLE;

    const t = elapsed.current / CYCLE;             // [0..1]
    const sunAngle = t * Math.PI * 2 - Math.PI / 2; // full circle
    const sunHeight = Math.sin(sunAngle);           // -1 (night) to +1 (noon)
    const dayFactor = Math.max(0, sunHeight);        // 0..1

    // Sun position
    if (sunRef.current) {
      sunRef.current.position.set(
        Math.cos(sunAngle) * 80,
        sunHeight * 80,
        Math.sin(sunAngle) * 40,
      );
      // Sun colour: warm at dawn/dusk, white at noon, dimmed at night
      const isNight = sunHeight < 0;
      sunRef.current.color.set(isNight ? '#6688cc' : (dayFactor < 0.3 ? '#f4a261' : '#fffde7'));
      sunRef.current.intensity = isNight ? 0.15 : 0.4 + dayFactor * 1.0;
    }

    // Ambient
    if (ambRef.current) {
      const skyCol = sampleSkyColor(t);
      ambRef.current.color.set(skyCol);
      ambRef.current.intensity = 0.3 + dayFactor * 0.6;
    }

    // Background fog colour for sky feel
    if (state.scene.fog instanceof THREE.Fog) {
      const skyCol = sampleSkyColor(t);
      state.scene.fog.color.set(skyCol);
      state.scene.background = skyCol;
    }
  });

  return (
    <>
      {/* Sun / moon */}
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      {/* Ambient fill light */}
      <ambientLight ref={ambRef} />
    </>
  );
}
