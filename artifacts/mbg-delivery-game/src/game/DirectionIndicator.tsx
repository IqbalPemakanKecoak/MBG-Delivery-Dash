/**
 * DirectionIndicator.tsx
 * Compass arrow pointing to the active delivery target.
 *
 * Stale-closure fix:
 *   The RAF loop closure captures only `positionRef`, `yawRef`, and `targetRef`.
 *   `targetRef` is a plain ref kept in sync with Zustand state via a separate
 *   useEffect — so the loop itself never closes over `schools` or
 *   `currentMissionIndex` and never becomes stale.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore, School } from './useGameStore';

interface Props {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function DirectionIndicator({ positionRef, yawRef }: Props) {
  const { phase, schools, currentMissionIndex } = useGameStore();

  const arrowRef = useRef<SVGSVGElement>(null);
  const distRef  = useRef<HTMLSpanElement>(null);
  const rafRef   = useRef<number>(0);

  // ── Target ref: kept in sync, read by the RAF loop ───────────────────────
  const targetRef = useRef<School | null>(null);
  useEffect(() => {
    const active = schools[currentMissionIndex];
    targetRef.current = (!active || active.delivered) ? null : active;
  }, [schools, currentMissionIndex]);

  // ── RAF loop — only depends on phase and the two position refs ────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    function tick() {
      const target = targetRef.current;
      if (!target) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const pos = positionRef.current;
      const yaw = yawRef.current;

      const dx   = target.position[0] - pos.x;
      const dz   = target.position[2] - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Player forward vector (XZ)
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);

      // Normalised direction to target
      const inv = 1 / (dist || 1);
      const nx  = dx * inv;
      const nz  = dz * inv;

      // 2D cross (+ = right) and dot (+ = ahead) → arrow rotation angle
      const cross = fx * nz - fz * nx;
      const dot   = fx * nx + fz * nz;
      const angle = Math.atan2(cross, dot);

      if (arrowRef.current) {
        arrowRef.current.style.transform = `rotate(${angle}rad)`;
      }
      if (distRef.current) {
        distRef.current.textContent =
          dist < 100 ? `${Math.round(dist * 10)} m`
                     : `${(dist * 10 / 1000).toFixed(1)} km`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, positionRef, yawRef]);   // ← no schools / currentMissionIndex

  if (phase !== 'playing') return null;

  const target = schools[currentMissionIndex];
  if (!target || target.delivered) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 select-none flex flex-col items-center gap-1">
      {/* Compass ring */}
      <div
        style={{
          width: 58, height: 58,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.65)',
          border: '2px solid rgba(255,213,79,0.7)',
          boxShadow: '0 0 18px rgba(255,213,79,0.35)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg
          ref={arrowRef}
          width="30" height="30"
          viewBox="0 0 24 24"
          style={{ transition: 'transform 0.08s ease-out', willChange: 'transform' }}
        >
          <line x1="12" y1="20" x2="12" y2="7"
            stroke="#ffd54f" strokeWidth="2.5" strokeLinecap="round" />
          <polyline points="7,11 12,4 17,11"
            fill="none" stroke="#ffd54f" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>

      {/* School name pill */}
      <div
        style={{
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,213,79,0.4)',
          color: '#ffd54f',
          backdropFilter: 'blur(4px)',
          borderRadius: 999,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
          maxWidth: 144,
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
        style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)',
          textShadow: '0 1px 4px rgba(0,0,0,1)' }}
      >
        — m
      </span>
    </div>
  );
}
