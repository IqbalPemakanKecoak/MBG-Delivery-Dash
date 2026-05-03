/**
 * MiniMap.tsx
 * HTML-canvas mini-map overlay.
 *
 * Fixes & additions:
 *  • isTarget now uses currentMissionIndex, not find(s => !s.delivered).
 *  • Draws a dashed GPS line from the player dot to the active target.
 *  • Stale-closure fix: currentMissionIndex synced into a ref for the RAF loop.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

const HORIZONTAL_Z = [-22, 0, 22, 44];
const VERTICAL_X   = [-44, -22, 0, 22, 44];
const ROAD_HW      = 4;
const RIVER        = { x: -10, z: 20, w: 52, h: 18 };
const WORLD_MIN    = -65;
const WORLD_SIZE   = 130;
const MAP_PX       = 190;
const SCALE        = MAP_PX / WORLD_SIZE;

function wx(x: number) { return (x - WORLD_MIN) * SCALE; }
function wz(z: number) { return (z - WORLD_MIN) * SCALE; }

interface MiniMapProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  yawRef:      React.MutableRefObject<number>;
}

export function MiniMap({ positionRef, yawRef }: MiniMapProps) {
  const { phase, schools, currentMissionIndex } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // Stale-closure fix for RAF loop
  const missionIdxRef = useRef(currentMissionIndex);
  useEffect(() => { missionIdxRef.current = currentMissionIndex; }, [currentMissionIndex]);
  const schoolsRef = useRef(schools);
  useEffect(() => { schoolsRef.current = schools; }, [schools]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const W = canvas.width, H = canvas.height;
      const sc = schoolsRef.current;
      const mi = missionIdxRef.current;

      // Background
      ctx.fillStyle = '#1b5e20';
      ctx.fillRect(0, 0, W, H);

      // Roads
      ctx.fillStyle = '#424242';
      for (const rz of HORIZONTAL_Z) ctx.fillRect(0, wz(rz - ROAD_HW), W, ROAD_HW * 2 * SCALE);
      for (const rx of VERTICAL_X)   ctx.fillRect(wx(rx - ROAD_HW), 0, ROAD_HW * 2 * SCALE, H);

      // Centre-lines
      ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 0.7; ctx.setLineDash([3, 3]);
      for (const rz of HORIZONTAL_Z) { ctx.beginPath(); ctx.moveTo(0, wz(rz)); ctx.lineTo(W, wz(rz)); ctx.stroke(); }
      for (const rx of VERTICAL_X)   { ctx.beginPath(); ctx.moveTo(wx(rx), 0); ctx.lineTo(wx(rx), H); ctx.stroke(); }
      ctx.setLineDash([]);

      // River
      ctx.fillStyle = 'rgba(30,136,229,0.75)';
      ctx.fillRect(wx(RIVER.x), wz(RIVER.z), RIVER.w * SCALE, RIVER.h * SCALE);

      // Player position
      const pos = positionRef.current;
      const yaw = yawRef.current;
      const px  = wx(pos.x);
      const pz  = wz(pos.z);

      // GPS dashed line from player to active target
      const activeSchool = sc[mi];
      if (activeSchool && !activeSchool.delivered) {
        const tx = wx(activeSchool.position[0]);
        const tz = wz(activeSchool.position[2]);
        ctx.save();
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(tx, tz); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.restore();
      }

      // School markers
      for (let i = 0; i < sc.length; i++) {
        const s       = sc[i];
        const sx      = wx(s.position[0]);
        const sz      = wz(s.position[2]);
        const isTarget = (i === mi) && !s.delivered;

        if (isTarget) { ctx.save(); ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 10; }

        ctx.fillStyle = s.delivered ? '#66bb6a' : isTarget ? '#ffd54f' : '#ef9a9a';
        ctx.beginPath(); ctx.arc(sx, sz, isTarget ? 6 : 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = s.delivered ? '#a5d6a7' : '#fff';
        ctx.fillRect(sx - 3, sz - 3, 6, 6);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(s.id + 1), sx, sz + 2.5);

        if (isTarget) ctx.restore();
      }

      // Player arrow
      const adx = -Math.sin(yaw) * 12;
      const adz = -Math.cos(yaw) * 12;
      ctx.save();
      ctx.shadowColor = '#ef5350'; ctx.shadowBlur = 6;
      ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px + adx, pz + adz); ctx.stroke();
      ctx.fillStyle = '#ef5350';
      ctx.beginPath(); ctx.arc(px, pz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, pz, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [positionRef, yawRef]);   // schools + index read from refs, no re-start needed

  if (phase !== 'playing') return null;

  return (
    <div
      className="fixed top-4 right-4 z-40 select-none"
      style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}
    >
      <div className="bg-black/70 backdrop-blur-sm rounded-t-xl px-3 py-1 border border-white/10 border-b-0">
        <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest text-center">
          🗺 Peta Kota
        </p>
      </div>
      <canvas
        ref={canvasRef}
        width={MAP_PX} height={MAP_PX}
        className="block border border-white/10"
        style={{ background: '#1b5e20' }}
      />
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
