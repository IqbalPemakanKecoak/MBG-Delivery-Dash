/**
 * MobileControls.tsx
 * On-screen touch controls for mobile / tablet players.
 *
 * Layout:
 *   Bottom-left  — Virtual joystick (steer + throttle from single stick)
 *   Bottom-right — Dedicated GAS and BRAKE buttons (for thumb-friendly play)
 *
 * Both touch AND mouse events are supported so desktop players can also use
 * the on-screen controls. Existing keyboard controls are unaffected.
 *
 * Works by writing to the shared `mobileInput` object which Player reads
 * in useFrame. No React state updates in the hot path.
 */
import { useEffect, useRef } from 'react';
import { mobileInput } from './mobileControls';

// ── Joystick radius (px) ──────────────────────────────────────────────────────
const STICK_RADIUS  = 52;   // outer ring radius
const KNOB_RADIUS   = 22;   // draggable knob radius
const DEAD_ZONE     = 0.15; // normalised dead-zone to avoid drift

// ── Joystick ──────────────────────────────────────────────────────────────────
function Joystick() {
  const baseRef  = useRef<HTMLDivElement>(null);
  const knobRef  = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null); // touch identifier

  // Centre of the base element (recalculated on each gesture start)
  const centreRef = useRef({ x: 0, y: 0 });

  function applyDelta(clientX: number, clientY: number) {
    const cx = centreRef.current.x;
    const cy = centreRef.current.y;
    let dx = clientX - cx;
    let dy = clientY - cy;

    // Clamp knob within outer ring
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }

    // Move knob visually
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Normalise to [-1, 1]
    const nx = dx / STICK_RADIUS;
    const ny = dy / STICK_RADIUS; // positive = down = backward

    mobileInput.left    = nx < -DEAD_ZONE;
    mobileInput.right   = nx >  DEAD_ZONE;
    mobileInput.forward = ny < -DEAD_ZONE;
    mobileInput.back    = ny >  DEAD_ZONE;
  }

  function reset() {
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
    mobileInput.left = mobileInput.right = mobileInput.forward = mobileInput.back = false;
    activeId.current = null;
  }

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    // ── Touch ────────────────────────────────────────────────────────────────
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (activeId.current !== null) return; // only track one finger
      const t = e.changedTouches[0];
      activeId.current = t.identifier;
      const r = base!.getBoundingClientRect();
      centreRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      applyDelta(t.clientX, t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeId.current) applyDelta(t.clientX, t.clientY);
      }
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeId.current) { reset(); break; }
      }
    }

    // ── Mouse (fallback for desktop) ─────────────────────────────────────────
    let mouseDown = false;
    function onMouseDown(e: MouseEvent) {
      mouseDown = true;
      const r = base!.getBoundingClientRect();
      centreRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      applyDelta(e.clientX, e.clientY);
    }
    function onMouseMove(e: MouseEvent) {
      if (mouseDown) applyDelta(e.clientX, e.clientY);
    }
    function onMouseUp() { if (mouseDown) { mouseDown = false; reset(); } }

    base.addEventListener('touchstart',  onTouchStart, { passive: false });
    base.addEventListener('touchmove',   onTouchMove,  { passive: false });
    base.addEventListener('touchend',    onTouchEnd,   { passive: false });
    base.addEventListener('touchcancel', onTouchEnd,   { passive: false });
    base.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      base.removeEventListener('touchstart',  onTouchStart);
      base.removeEventListener('touchmove',   onTouchMove);
      base.removeEventListener('touchend',    onTouchEnd);
      base.removeEventListener('touchcancel', onTouchEnd);
      base.removeEventListener('mousedown',   onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      className="select-none"
      style={{
        width:  STICK_RADIUS * 2,
        height: STICK_RADIUS * 2,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '2px solid rgba(255,255,255,0.25)',
        backdropFilter: 'blur(4px)',
        position: 'relative',
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      {/* Cross guide lines */}
      <div style={{
        position: 'absolute', top: '50%', left: 8, right: 8,
        height: 1, background: 'rgba(255,255,255,0.12)', transform: 'translateY(-50%)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: 8, bottom: 8,
        width: 1, background: 'rgba(255,255,255,0.12)', transform: 'translateX(-50%)',
      }} />

      {/* Knob */}
      <div
        ref={knobRef}
        style={{
          position: 'absolute',
          top: STICK_RADIUS - KNOB_RADIUS,
          left: STICK_RADIUS - KNOB_RADIUS,
          width:  KNOB_RADIUS * 2,
          height: KNOB_RADIUS * 2,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          border: '2px solid rgba(255,255,255,0.6)',
          boxShadow: '0 0 12px rgba(255,255,255,0.2)',
          transition: 'transform 0.05s ease-out',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
interface ActionBtnProps {
  label: string;
  icon: string;
  onActive: (v: boolean) => void;
  color?: string;
}

function ActionBtn({ label, icon, onActive, color = 'rgba(255,255,255,0.15)' }: ActionBtnProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function on(e: TouchEvent | MouseEvent) { e.preventDefault(); onActive(true); }
    function off(e: TouchEvent | MouseEvent) { e.preventDefault(); onActive(false); }

    el.addEventListener('touchstart',  on,  { passive: false });
    el.addEventListener('touchend',    off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown',   on);
    el.addEventListener('mouseup',     off);
    el.addEventListener('mouseleave',  off);

    return () => {
      el.removeEventListener('touchstart',  on);
      el.removeEventListener('touchend',    off);
      el.removeEventListener('touchcancel', off);
      el.removeEventListener('mousedown',   on);
      el.removeEventListener('mouseup',     off);
      el.removeEventListener('mouseleave',  off);
    };
  }, [onActive]);

  return (
    <button
      ref={ref}
      className="select-none flex flex-col items-center justify-center gap-0.5"
      style={{
        width: 60, height: 60,
        borderRadius: 14,
        background: color,
        border: '1.5px solid rgba(255,255,255,0.3)',
        backdropFilter: 'blur(4px)',
        touchAction: 'none',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>
        {label}
      </span>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function MobileControls() {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex items-end justify-between px-5 pointer-events-none">
      {/* Left — Joystick */}
      <div className="pointer-events-auto">
        <Joystick />
      </div>

      {/* Right — Gas + Brake */}
      <div className="pointer-events-auto flex flex-col gap-3">
        <ActionBtn
          label="MAJU"
          icon="▲"
          color="rgba(46,125,50,0.5)"
          onActive={v => { mobileInput.forward = v; }}
        />
        <ActionBtn
          label="MUNDUR"
          icon="▼"
          color="rgba(183,28,28,0.5)"
          onActive={v => { mobileInput.back = v; }}
        />
      </div>
    </div>
  );
}
