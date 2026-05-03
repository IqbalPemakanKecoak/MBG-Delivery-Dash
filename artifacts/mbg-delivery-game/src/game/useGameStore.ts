/**
 * useGameStore.ts
 * Central game state — Zustand store.
 *
 * Mission targeting fix:
 *  • currentMissionIndex is the single source of truth for the active target.
 *  • deliverPackage() only accepts the school that matches currentMissionIndex.
 *  • After each delivery the timer resets and the index advances to the next
 *    undelivered school (searching forward, wrapping around if needed).
 *  • No out-of-order delivery is possible.
 */
import { create } from 'zustand';

export type GamePhase = 'intro' | 'playing' | 'midNarration' | 'win' | 'lose';

export interface School {
  id: number;
  name: string;
  position: [number, number, number];
  delivered: boolean;
}

const INITIAL_SCHOOLS: School[] = [
  { id: 0, name: 'SDN 01 Harapan',   position: [ 48, 0, -28], delivered: false },
  { id: 1, name: 'SDN 02 Nusantara', position: [ 18, 0, -48], delivered: false },
  { id: 2, name: 'SDN 03 Bangsa',    position: [-40, 0, -18], delivered: false },
  { id: 3, name: 'SDN 04 Pancasila', position: [  8, 0,  42], delivered: false },
  { id: 4, name: 'SDN 05 Merdeka',   position: [-28, 0, -40], delivered: false },
];

export const MISSION_DURATION = 75; // seconds per delivery

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find the index of the next undelivered school after `from`, wrapping around. */
function nextUndeliveredIndex(schools: School[], from: number): number {
  const n = schools.length;
  // Search forward from from+1
  for (let offset = 1; offset < n; offset++) {
    const i = (from + offset) % n;
    if (!schools[i].delivered) return i;
  }
  return from; // all delivered (shouldn't happen before win check)
}

// ── Store interface ────────────────────────────────────────────────────────────
interface GameStore {
  phase: GamePhase;
  score: number;
  timeLeft: number;
  deliveryCount: number;
  currentMissionIndex: number;   // index into `schools` array — the ONLY active target
  schools: School[];
  midNarrationShown: boolean;

  setPhase: (phase: GamePhase) => void;
  startGame: () => void;
  tickTimer: (delta: number) => void;
  /** Attempt delivery. Silently ignored if schoolId ≠ schools[currentMissionIndex].id. */
  deliverPackage: (schoolId: number) => void;
  /** Resume play after mid-game narration pause. */
  advanceMission: () => void;
  resetGame: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'intro',
  score: 0,
  timeLeft: MISSION_DURATION,
  deliveryCount: 0,
  currentMissionIndex: 0,
  schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
  midNarrationShown: false,

  setPhase: (phase) => set({ phase }),

  startGame: () => set({
    phase: 'playing',
    score: 0,
    timeLeft: MISSION_DURATION,
    deliveryCount: 0,
    currentMissionIndex: 0,
    schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
    midNarrationShown: false,
  }),

  tickTimer: (delta) => {
    const { phase, timeLeft } = get();
    if (phase !== 'playing') return;
    const next = timeLeft - delta;
    if (next <= 0) {
      set({ timeLeft: 0, phase: 'lose' });
    } else {
      set({ timeLeft: next });
    }
  },

  deliverPackage: (schoolId) => {
    const { schools, currentMissionIndex, deliveryCount, timeLeft, midNarrationShown, score } = get();

    // ── Guard: only accept the ACTIVE target ──────────────────────────────────
    const active = schools[currentMissionIndex];
    if (!active || active.id !== schoolId || active.delivered) return;

    // Mark it delivered
    const updatedSchools = schools.map((s, i) =>
      i === currentMissionIndex ? { ...s, delivered: true } : s
    );

    const newCount    = deliveryCount + 1;
    const timeBonus   = Math.floor(timeLeft * 2);
    const newScore    = score + 100 + timeBonus;
    const allDone     = newCount >= INITIAL_SCHOOLS.length;

    // Advance to next undelivered school (wrapping)
    const nextIndex = allDone
      ? currentMissionIndex
      : nextUndeliveredIndex(updatedSchools, currentMissionIndex);

    // Show mid-game narration after 2nd delivery (only once)
    const showMid = !midNarrationShown && newCount === 2;

    set({
      schools: updatedSchools,
      deliveryCount: newCount,
      score: newScore,
      currentMissionIndex: nextIndex,
      timeLeft: MISSION_DURATION,          // ← timer resets on every delivery
      phase: allDone ? 'win' : showMid ? 'midNarration' : 'playing',
      midNarrationShown: midNarrationShown || showMid,
    });
  },

  // Called when player dismisses the mid-narration overlay
  advanceMission: () => set({ phase: 'playing' }),

  resetGame: () => set({
    phase: 'intro',
    score: 0,
    timeLeft: MISSION_DURATION,
    deliveryCount: 0,
    currentMissionIndex: 0,
    schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
    midNarrationShown: false,
  }),
}));
