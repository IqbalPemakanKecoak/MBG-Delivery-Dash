/**
 * MiniMap.tsx
 * HTML-canvas mini-map rendered as an overlay in the top-right corner.
 *
 * Architecture:
 * • A <canvas> element is positioned over the game canvas.
 * • requestAnimationFrame redraws it every frame — no Three.js involved.
 * • Player position and facing angle come from refs (no re-renders needed).
 * • School status (delivered / not) comes from Zustand — rerenders only when
 *   a delivery happens, which is infrequent and fine.
 *
 * Map coordinates:
 * • World: X and Z range from -65 to +65 (130 units)
 * • Canvas: 190 × 190 px
 * • Scale: 190 / 130 ≈ 1.46 px per world unit
 * • wx(x) / wz(z) convert world → canvas pixels
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

// ── Map geometry (must match World.tsx) ──────────────────────────────────────
const HORIZONTAL_ROADS_Z = [-22, 0, 22, 44];  // z positions of horizontal roads
const VERTICAL_ROADS_X   = [-44, -22, 0, 22, 44]; // x positions of vertical roads
const ROAD_HALF_WIDTH    = 4;   // roads are 8 units wide

// River: x in [-10, 40], z in [20, 38]
const RIVER = { x: -10, z: 20, w: 52, h: 18 };

const WORLD_MIN  = -65;
const WORLD_SIZE = 130; // -65 to +65
const MAP_PX     = 190; // canvas size in pixels
const SCALE      = MAP_PX / WORLD_SIZE;

/** World X → canvas pixel X */
function wx(x: number) { return (x - WORLD_MIN) * SCALE; }
/** World Z → canvas pixel Y (Z increases downward on mini-map) */
function wz(z: number) { return (z - WORLD_MIN) * SCALE; }

// ── Component ─────────────────────────────────────────────────────────────────
interface MiniMapProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function MiniMap({ positionRef, yawRef }: MiniMapProps) {
  const { phase, schools } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const W = canvas.width;
      const H = canvas.height;

      // ── Background: dark green land ──────────────────────────────────────
      ctx.fillStyle = '#1b5e20';
      ctx.fillRect(0, 0, W, H);

      // ── Roads ─────────────────────────────────────────────────────────────
      ctx.fillStyle = '#424242';
      for (const rz of HORIZONTAL_ROADS_Z) {
        const y = wz(rz - ROAD_HALF_WIDTH);
        const h = ROAD_HALF_WIDTH * 2 * SCALE;
        ctx.fillRect(0, y, W, h);
      }
      for (const rx of VERTICAL_ROADS_X) {
        const x2 = wx(rx - ROAD_HALF_WIDTH);
        const w2 = ROAD_HALF_WIDTH * 2 * SCALE;
        ctx.fillRect(x2, 0, w2, H);
      }

      // ── Road centre-lines ─────────────────────────────────────────────────
      ctx.strokeStyle = '#fdd835';
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([4, 4]);
      for (const rz of HORIZONTAL_ROADS_Z) {
        const y = wz(rz);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (const rx of VERTICAL_ROADS_X) {
        const x2 = wx(rx);
        ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
      }
      ctx.setLineDash([]);

      // ── River ─────────────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(30, 136, 229, 0.75)';
      ctx.fillRect(
        wx(RIVER.x), wz(RIVER.z),
        RIVER.w * SCALE, RIVER.h * SCALE,
      );

      // ── School markers ────────────────────────────────────────────────────
      for (const s of schools) {
        const sx = wx(s.position[0]);
        const sz = wz(s.position[2]);

        // Outer glow for the active target
        const isTarget = !s.delivered && schools.find(sc => !sc.delivered)?.id === s.id;
        if (isTarget) {
          ctx.save();
          ctx.shadowColor = '#ffd54f';
          ctx.shadowBlur  = 8;
        }

        ctx.fillStyle = s.delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef9a9a';
        ctx.beginPath();
        ctx.arc(sx, sz, 5, 0, Math.PI * 2);
        ctx.fill();

        // Small school icon (a little building square)
        ctx.fillStyle = s.delivered ? '#a5d6a7' : '#fff';
        ctx.fillRect(sx - 3, sz - 3, 6, 6);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(s.id + 1), sx, sz + 2.5);

        if (isTarget) ctx.restore();
      }

      // ── Player ────────────────────────────────────────────────────────────
      const pos = positionRef.current;
      const yaw = yawRef.current;
      const px  = wx(pos.x);
      const pz  = wz(pos.z);

      // Direction arrow (forward = -sin(yaw), -cos(yaw) in world → canvas)
      const arrowLen = 13;
      const adx = -Math.sin(yaw) * arrowLen;
      const adz = -Math.cos(yaw) * arrowLen;

      ctx.save();
      ctx.shadowColor = '#ef5350';
      ctx.shadowBlur  = 6;

      // Arrow shaft
      ctx.strokeStyle = '#ef5350';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px + adx, pz + adz);
      ctx.stroke();

      // Player dot
      ctx.fillStyle = '#ef5350';
      ctx.beginPath();
      ctx.arc(px, pz, 5, 0, Math.PI * 2);
      ctx.fill();

      // White centre
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ── Border ────────────────────────────────────────────────────────────
      ctx.strokeStyle = '#33691e';
      ctx.lineWidth   = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [schools, positionRef, yawRef]);

  if (phase !== 'playing') return null;

  return (
    <div
      className="fixed top-4 right-4 z-40 select-none"
      style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}
    >
      {/* Title */}
      <div className="bg-black/70 backdrop-blur-sm rounded-t-xl px-3 py-1 border border-white/10 border-b-0">
        <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest text-center">
          🗺 Peta Kota
        </p>
      </div>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={MAP_PX}
        height={MAP_PX}
        className="block rounded-b-xl border border-white/10"
        style={{ background: '#1b5e20' }}
      />
      {/* Legend */}
      <div className="bg-black/60 backdrop-blur-sm rounded-b-xl px-2 py-1 border border-white/10 border-t-0 flex gap-3 justify-center">
        <span className="text-xs text-yellow-300 flex items-center gap-1">
          <span style={{ width: 8, height: 8, background: '#ffd54f', display: 'inline-block', borderRadius: 2 }} />
          Tujuan
        </span>
        <span className="text-xs text-emerald-400 flex items-center gap-1">
          <span style={{ width: 8, height: 8, background: '#66bb6a', display: 'inline-block', borderRadius: 2 }} />
          Selesai
        </span>
        <span className="text-xs text-red-400 flex items-center gap-1">
          <span style={{ width: 8, height: 8, background: '#ef5350', display: 'inline-block', borderRadius: '50%' }} />
          Kamu
        </span>
      </div>
    </div>
  );
}
