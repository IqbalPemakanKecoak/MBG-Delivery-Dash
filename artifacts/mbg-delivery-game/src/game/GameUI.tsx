/**
 * GameUI.tsx
 * Heads-Up Display shown during active gameplay.
 * Displays: score, countdown timer, current mission, delivery list.
 */
import React from 'react';
import { useGameStore } from './useGameStore';

// ── Timer bar ────────────────────────────────────────────────────────────────

function TimerBar({ timeLeft, max = 75 }: { timeLeft: number; max?: number }) {
  const pct = Math.max(0, (timeLeft / max) * 100);
  const color =
    pct > 50 ? '#22c55e'  // green
    : pct > 25 ? '#f59e0b' // amber
    : '#ef4444';           // red
  return (
    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Main HUD ─────────────────────────────────────────────────────────────────

export function GameUI() {
  const { phase, score, timeLeft, schools, deliveryCount } = useGameStore();

  // Only show during active play
  if (phase !== 'playing') return null;

  const currentTarget = schools.find(s => !s.delivered);

  return (
    <>
      {/* ── Top-left: Score + Timer ── */}
      <div
        className="fixed top-4 left-4 z-40 text-white select-none"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 min-w-44 border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Skor</span>
            <span className="text-lg font-bold text-white">{score.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-widest">Waktu</span>
            <span className={`text-lg font-bold ${timeLeft < 20 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
          <TimerBar timeLeft={timeLeft} />
        </div>
      </div>

      {/* ── Top-right: Delivery progress ── */}
      <div className="fixed top-4 right-4 z-40 select-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-2">
            Pengiriman {deliveryCount}/{schools.length}
          </p>
          <div className="space-y-1">
            {schools.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`text-base ${s.delivered ? 'text-emerald-400' : 'text-white/30'}`}>
                  {s.delivered ? '✓' : '○'}
                </span>
                <span className={`text-xs ${s.delivered ? 'text-emerald-300 line-through' : 'text-white/70'}`}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom-center: Current mission ── */}
      {currentTarget && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none">
          <div className="bg-emerald-900/80 backdrop-blur-sm rounded-full px-5 py-2 border border-emerald-500/40 flex items-center gap-3">
            <span className="text-amber-400 text-lg">📦</span>
            <div>
              <p className="text-xs text-emerald-400 font-semibold">Tujuan Berikutnya</p>
              <p className="text-white font-bold text-sm">{currentTarget.name}</p>
            </div>
            <span className="text-emerald-400 text-sm">→</span>
          </div>
        </div>
      )}

      {/* ── Bottom-left: Controls hint ── */}
      <div className="fixed bottom-4 left-4 z-40 select-none">
        <div className="text-white/40 text-xs space-y-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          <p>W / ↑  Maju</p>
          <p>S / ↓  Mundur</p>
          <p>A / ←  Kiri</p>
          <p>D / →  Kanan</p>
        </div>
      </div>
    </>
  );
}
