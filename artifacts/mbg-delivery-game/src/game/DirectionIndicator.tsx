/**
 * DirectionIndicator.tsx
 * An HTML overlay compass that always points toward the active delivery target.
 *
 * How it works:
 *  1. Every animation frame, read player position (positionRef) and yaw (yawRef).
 *  2. Compute the world-space vector from player to the active school.
 *  3. Project that vector onto the player's local XZ frame using dot/cross product.
 *  4. The resulting angle (0 = directly ahead, +90° = right, -90° = left) is
 *     applied as a CSS transform rotation to the arrow SVG.
 *  5. Distance is displayed in metres (1 world unit ≈ 10 m).
 *
 * No Three.js or React re-renders inside the animation loop — only direct DOM
 * style mutation for maximum performance.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

interface DirectionIndicatorProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function DirectionIndicator({ positionRef, yawRef }: DirectionIndicatorProps) {
  const { phase, schools, currentMissionIndex } = useGameStore();

  const arrowRef    = useRef<SVGSVGElement>(null);
  const distRef     = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number>(0);

  useEffect(() => {
    if (phase !== 'playing') return;

    function tick() {
      const target = schools[currentMissionIndex];
      if (!target || target.delivered) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const pos = positionRef.current;
      const yaw = yawRef.current;

      // World-space vector from player to target (XZ only)
      const dx = target.position[0] - pos.x;
      const dz = target.position[2] - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Player's forward direction in world XZ
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);

      // Normalised direction to target
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);

      // 2D cross product (positive = target is to the right)
      const cross = fx * nz - fz * nx;
      // Dot product (positive = target is ahead)
      const dot   = fx * nx + fz * nz;

      // Angle to rotate the up-pointing arrow clockwise
      const angle = Math.atan2(cross, dot);

      // Update DOM directly — zero React overhead
      if (arrowRef.current) {
        arrowRef.current.style.transform = `rotate(${angle}rad)`;
      }
      if (distRef.current) {
        distRef.current.textContent = dist < 1000
          ? `${Math.round(dist * 10)} m`
          : `${(dist * 10 / 1000).toFixed(1)} km`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, schools, currentMissionIndex, positionRef, yawRef]);

  if (phase !== 'playing') return null;

  const target = schools[currentMissionIndex];
  if (!target || target.delivered) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 select-none flex flex-col items-center gap-1"
    >
      {/* Arrow container */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: '50%',
          border: '2px solid rgba(255,213,79,0.6)',
          boxShadow: '0 0 16px rgba(255,213,79,0.3)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* SVG arrow — points UP by default, rotated by JS */}
        <svg
          ref={arrowRef}
          width="28"
          height="28"
          viewBox="0 0 24 24"
          style={{ transition: 'transform 0.1s ease-out', willChange: 'transform' }}
        >
          {/* Arrow shaft */}
          <line x1="12" y1="20" x2="12" y2="6" stroke="#ffd54f" strokeWidth="2.5" strokeLinecap="round" />
          {/* Arrow head */}
          <polyline points="7,10 12,4 17,10" fill="none" stroke="#ffd54f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>

      {/* School name */}
      <div
        className="text-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,213,79,0.4)',
          color: '#ffd54f',
          backdropFilter: 'blur(4px)',
          maxWidth: 140,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {target.name}
      </div>

      {/* Distance */}
      <span
        ref={distRef}
        className="text-xs font-mono"
        style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
      >
        — m
      </span>
    </div>
  );
}
