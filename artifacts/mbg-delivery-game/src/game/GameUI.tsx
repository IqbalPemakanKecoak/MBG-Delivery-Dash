/**
 * GameUI.tsx
 * Heads-Up Display shown during active gameplay.
 * Layout:
 *   Top-left     → Score + Timer bar
 *   Bottom-center → Current mission target
 *   Bottom-left   → Controls hint
 *   Top-right     → Mini-map (rendered by MiniMap.tsx)
 *   Center-screen → Delivery flash notification
 */
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from './useGameStore';

// ── Timer bar ─────────────────────────────────────────────────────────────────
function TimerBar({ timeLeft, max = 75 }: { timeLeft: number; max?: number }) {
  const pct   = Math.max(0, (timeLeft / max) * 100);
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Delivery flash ────────────────────────────────────────────────────────────
function DeliveryFlash() {
  const { deliveryCount } = useGameStore();
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(0);

  useEffect(() => {
    if (deliveryCount > prevCount.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2000);
      prevCount.current = deliveryCount;
      return () => clearTimeout(t);
    }
  }, [deliveryCount]);

  if (!flash) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
      <div
        className="text-center animate-bounce"
        style={{
          background: 'rgba(46, 125, 50, 0.92)',
          borderRadius: 16,
          padding: '16px 32px',
          border: '2px solid #66bb6a',
          boxShadow: '0 0 40px rgba(102, 187, 106, 0.5)',
        }}
      >
        <p className="text-4xl mb-1">✅</p>
        <p className="text-white font-bold text-lg">Terkirim!</p>
        <p className="text-emerald-300 text-sm">Makanan bergizi telah sampai</p>
      </div>
    </div>
  );
}

// ── Main HUD ──────────────────────────────────────────────────────────────────
export function GameUI() {
  const { phase, score, timeLeft, schools, deliveryCount } = useGameStore();

  if (phase !== 'playing') return null;

  const remaining    = schools.filter(s => !s.delivered).length;
  const currentTarget = schools.find(s => !s.delivered);

  return (
    <>
      {/* ── Top-left: Score + Timer ── */}
      <div
        className="fixed top-4 left-4 z-40 text-white select-none"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        <div className="bg-black/65 backdrop-blur-sm rounded-xl px-4 py-3 min-w-48 border border-white/10">
          {/* Score row */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Skor</span>
            <span className="text-lg font-bold text-white">{score.toLocaleString()}</span>
          </div>
          {/* Timer row */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-widest">Waktu</span>
            <span className={`text-lg font-bold tabular-nums ${timeLeft < 20 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
          <TimerBar timeLeft={timeLeft} />

          {/* Delivery count */}
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs text-white/60">Pengiriman</span>
            <span className="text-sm font-bold text-emerald-300">
              {deliveryCount} / {schools.length}
            </span>
          </div>

          {/* Remaining targets */}
          <div className="mt-1 flex justify-between items-center">
            <span className="text-xs text-white/60">Sisa Tujuan</span>
            <span className={`text-sm font-bold ${remaining === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
              {remaining} sekolah
            </span>
          </div>
        </div>

        {/* School checklist */}
        <div className="mt-2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
          {schools.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              <span className={`text-sm leading-none ${s.delivered ? 'text-emerald-400' : 'text-white/30'}`}>
                {s.delivered ? '✓' : '○'}
              </span>
              <span className={`text-xs ${s.delivered ? 'text-emerald-300 line-through opacity-60' : 'text-white/80'}`}>
                {s.name}
              </span>
              {!s.delivered && s.id === currentTarget?.id && (
                <span className="text-xs text-amber-400 ml-auto">← sekarang</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom-center: Current mission ── */}
      {currentTarget && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 select-none">
          <div className="bg-emerald-900/85 backdrop-blur-sm rounded-full px-6 py-2.5 border border-emerald-500/50 flex items-center gap-3 shadow-lg">
            <span className="text-xl">📦</span>
            <div>
              <p className="text-xs text-emerald-400 font-semibold leading-tight">Antar ke</p>
              <p className="text-white font-bold">{currentTarget.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom-left: Controls ── */}
      <div className="fixed bottom-4 left-4 z-40 select-none">
        <div
          className="text-white/50 text-xs space-y-0.5 bg-black/40 rounded-lg px-3 py-2 backdrop-blur-sm"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          <p className="text-white/30 text-xs font-semibold mb-1 uppercase tracking-widest">Kontrol</p>
          <p>W / ↑  Maju</p>
          <p>S / ↓  Mundur</p>
          <p>A / ←  Kiri</p>
          <p>D / →  Kanan</p>
        </div>
      </div>

      {/* ── Delivery flash ── */}
      <DeliveryFlash />
    </>
  );
}
