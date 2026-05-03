/**
 * GameUI.tsx
 * HUD overlay.
 *
 * Fixes:
 *  • currentTarget now derived from schools[currentMissionIndex] — not find().
 *  • DeliveryFlash is a polished pop-scale + glow animation with sound cue.
 *  • Keyboard hint hidden on narrow screens (mobile uses on-screen controls).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, MISSION_DURATION } from './useGameStore';

// ── CSS keyframes injected once ───────────────────────────────────────────────
const FLASH_CSS = `
@keyframes deliveryPop {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
  40%  { transform: translate(-50%,-50%) scale(1.12); opacity: 1; }
  65%  { transform: translate(-50%,-50%) scale(0.96); }
  80%  { transform: translate(-50%,-50%) scale(1.04); }
  100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
}
@keyframes deliveryFade {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes pulseRing {
  0%   { box-shadow: 0 0 0 0 rgba(102,187,106,0.7); }
  70%  { box-shadow: 0 0 0 18px rgba(102,187,106,0); }
  100% { box-shadow: 0 0 0 0 rgba(102,187,106,0); }
}
`;

let cssInjected = false;
function injectCss() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = FLASH_CSS;
  document.head.appendChild(s);
}

// ── Timer bar ─────────────────────────────────────────────────────────────────
function TimerBar({ timeLeft }: { timeLeft: number }) {
  const pct   = Math.max(0, (timeLeft / MISSION_DURATION) * 100);
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: 'width 0.3s linear, background 0.5s' }}
      />
    </div>
  );
}

// ── Delivery flash ─────────────────────────────────────────────────────────────
function DeliveryFlash() {
  injectCss();
  const { deliveryCount, schools } = useGameStore();
  const [visible, setVisible]     = useState(false);
  const [lastSchool, setLastSchool] = useState('');
  const prevCount = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (deliveryCount > prevCount.current) {
      // Which school was just delivered?
      const just = schools.find(s => s.delivered && s.id === deliveryCount - 1);
      setLastSchool(just?.name ?? '');
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 2400);
      prevCount.current = deliveryCount;
    }
    return () => clearTimeout(timerRef.current);
  }, [deliveryCount, schools]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', top: '42%', left: '50%',
        zIndex: 60, pointerEvents: 'none',
        animation: 'deliveryPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards, deliveryFade 2.4s ease forwards',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(27,94,32,0.95), rgba(46,125,50,0.92))',
          borderRadius: 20,
          padding: '18px 36px',
          border: '2px solid #81c784',
          boxShadow: '0 0 48px rgba(102,187,106,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
          textAlign: 'center',
          minWidth: 220,
          animation: 'pulseRing 0.6s ease 0.1s',
        }}
      >
        <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 6 }}>✅</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>
          Terkirim!
        </div>
        {lastSchool && (
          <div style={{ color: '#a5d6a7', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
            {lastSchool}
          </div>
        )}
        <div style={{ color: '#c8e6c9', fontSize: 13, marginTop: 2 }}>
          Makanan bergizi telah sampai 🎉
        </div>
      </div>
    </div>
  );
}

// ── Win / Lose overlays ───────────────────────────────────────────────────────
function EndOverlay() {
  const { phase, score, resetGame } = useGameStore();
  if (phase !== 'win' && phase !== 'lose') return null;

  const win = phase === 'win';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="text-center rounded-2xl px-10 py-8 border"
        style={{
          background: win ? 'rgba(27,94,32,0.95)' : 'rgba(183,28,28,0.95)',
          borderColor: win ? '#81c784' : '#ef9a9a',
          boxShadow: `0 0 60px ${win ? 'rgba(102,187,106,0.4)' : 'rgba(239,83,80,0.4)'}`,
          maxWidth: 380,
        }}
      >
        <div className="text-5xl mb-3">{win ? '🏆' : '⏰'}</div>
        <h2 className="text-white font-black text-2xl mb-1">
          {win ? 'Misi Selesai!' : 'Waktu Habis!'}
        </h2>
        <p className="text-white/70 text-sm mb-4">
          {win
            ? 'Semua sekolah telah menerima makanan bergizi.'
            : 'Kamu belum sempat mengantarkan semua paket.'}
        </p>
        <div
          className="text-3xl font-black mb-5"
          style={{ color: win ? '#ffd54f' : '#ff8a65' }}
        >
          {score.toLocaleString()} poin
        </div>
        <button
          onClick={resetGame}
          className="px-8 py-3 rounded-full font-bold text-white text-base cursor-pointer"
          style={{
            background: win ? '#2e7d32' : '#c62828',
            border: `2px solid ${win ? '#81c784' : '#ef9a9a'}`,
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}
        >
          Main Lagi
        </button>
      </div>
    </div>
  );
}

// ── Main HUD ──────────────────────────────────────────────────────────────────
export function GameUI() {
  const { phase, score, timeLeft, schools, deliveryCount, currentMissionIndex } = useGameStore();

  if (phase === 'win' || phase === 'lose') return <EndOverlay />;
  if (phase !== 'playing') return null;

  // Use currentMissionIndex as single source of truth
  const currentTarget = schools[currentMissionIndex] && !schools[currentMissionIndex].delivered
    ? schools[currentMissionIndex]
    : null;
  const remaining = schools.filter(s => !s.delivered).length;

  return (
    <>
      {/* ── Top-left: Score + Timer ── */}
      <div
        className="fixed top-4 left-4 z-40 text-white select-none"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        <div className="bg-black/65 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[11rem] border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Skor</span>
            <span className="text-lg font-bold">{score.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-widest">Waktu</span>
            <span className={`text-lg font-bold tabular-nums ${timeLeft < 20 ? 'text-red-400 animate-pulse' : ''}`}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
          <TimerBar timeLeft={timeLeft} />
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between">
            <span className="text-xs text-white/60">Pengiriman</span>
            <span className="text-sm font-bold text-emerald-300">{deliveryCount} / {schools.length}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-xs text-white/60">Sisa</span>
            <span className={`text-sm font-bold ${remaining === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
              {remaining} sekolah
            </span>
          </div>
        </div>

        {/* School checklist */}
        <div className="mt-2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
          {schools.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              <span className={`text-sm leading-none ${s.delivered ? 'text-emerald-400' : i === currentMissionIndex ? 'text-amber-400' : 'text-white/30'}`}>
                {s.delivered ? '✓' : i === currentMissionIndex ? '▶' : '○'}
              </span>
              <span className={`text-xs ${s.delivered ? 'text-emerald-300 line-through opacity-60' : i === currentMissionIndex ? 'text-white font-semibold' : 'text-white/60'}`}>
                {s.name}
              </span>
              {i === currentMissionIndex && !s.delivered && (
                <span className="text-xs text-amber-400 ml-auto animate-pulse">← sekarang</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom-center: current mission (shifts up on mobile to clear joystick) ── */}
      {currentTarget && (
        <div className="fixed bottom-36 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 select-none">
          <div
            className="flex items-center gap-3 rounded-full px-6 py-2.5 border shadow-lg"
            style={{
              background: 'rgba(27,94,32,0.88)',
              borderColor: 'rgba(102,187,106,0.5)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span className="text-xl">📦</span>
            <div>
              <p className="text-xs text-emerald-400 font-semibold leading-tight">Antar ke</p>
              <p className="text-white font-bold">{currentTarget.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom-left: Keyboard hints (hidden on very small screens) ── */}
      <div className="fixed bottom-4 left-4 z-40 select-none hidden sm:block">
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

      <DeliveryFlash />
    </>
  );
}
