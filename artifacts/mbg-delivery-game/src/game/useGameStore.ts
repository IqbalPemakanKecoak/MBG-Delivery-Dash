/**
 * useGameStore.ts
 * Central game state managed with Zustand.
 * Tracks phase, score, timer, missions, and schools.
 */
import { create } from 'zustand';

// ── Game phases ──────────────────────────────────────────────────────────────
export type GamePhase =
  | 'intro'          // Opening narration before play
  | 'playing'        // Active delivery mission
  | 'midNarration'   // Reflective pause shown mid-game
  | 'win'            // All packages delivered
  | 'lose';          // Timer ran out

// ── School / checkpoint data ─────────────────────────────────────────────────
export interface School {
  id: number;
  name: string;
  position: [number, number, number]; // World-space position
  delivered: boolean;
}

// ── The 5 schools spread across the small town ───────────────────────────────
const INITIAL_SCHOOLS: School[] = [
  { id: 0, name: 'SDN 01 Harapan',   position: [ 48,  0, -28], delivered: false },
  { id: 1, name: 'SDN 02 Nusantara', position: [ 18,  0, -48], delivered: false },
  { id: 2, name: 'SDN 03 Bangsa',    position: [-40,  0, -18], delivered: false },
  { id: 3, name: 'SDN 04 Pancasila', position: [  8,  0,  42], delivered: false },
  { id: 4, name: 'SDN 05 Merdeka',   position: [-28,  0, -40], delivered: false },
];

// Seconds allowed per delivery mission
const MISSION_DURATION = 75;

// ── Store interface ──────────────────────────────────────────────────────────
interface GameStore {
  phase: GamePhase;
  score: number;
  timeLeft: number;
  deliveryCount: number;           // How many packages delivered so far
  currentMissionIndex: number;     // Which school we are heading to
  schools: School[];
  midNarrationShown: boolean;      // Guard so mid-narration shows only once

  setPhase: (phase: GamePhase) => void;
  startGame: () => void;
  tickTimer: (delta: number) => void;
  deliverPackage: (schoolId: number) => void;
  advanceMission: () => void;
  resetGame: () => void;
}

// ── Store implementation ─────────────────────────────────────────────────────
export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'intro',
  score: 0,
  timeLeft: MISSION_DURATION,
  deliveryCount: 0,
  currentMissionIndex: 0,
  schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
  midNarrationShown: false,

  setPhase: (phase) => set({ phase }),

  // Reset everything and begin the first mission
  startGame: () =>
    set({
      phase: 'playing',
      score: 0,
      timeLeft: MISSION_DURATION,
      deliveryCount: 0,
      currentMissionIndex: 0,
      schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
      midNarrationShown: false,
    }),

  // Count down the timer each frame; losing when it hits 0
  tickTimer: (delta: number) => {
    const { phase, timeLeft } = get();
    if (phase !== 'playing') return;
    const next = timeLeft - delta;
    if (next <= 0) {
      set({ timeLeft: 0, phase: 'lose' });
    } else {
      set({ timeLeft: next });
    }
  },

  // Mark a school as delivered and award points
  deliverPackage: (schoolId: number) => {
    const { schools, deliveryCount, timeLeft, midNarrationShown } = get();
    const already = schools.find(s => s.id === schoolId)?.delivered;
    if (already) return;

    const updated = schools.map(s =>
      s.id === schoolId ? { ...s, delivered: true } : s
    );
    const newCount = deliveryCount + 1;
    const timeBonus = Math.floor(timeLeft * 2);
    const newScore = get().score + 100 + timeBonus;
    const allDone = newCount >= INITIAL_SCHOOLS.length;

    // Show mid-game narration after the 2nd delivery
    const showMid = !midNarrationShown && newCount === 2;

    set({
      schools: updated,
      deliveryCount: newCount,
      score: newScore,
      phase: allDone ? 'win' : showMid ? 'midNarration' : 'playing',
      midNarrationShown: midNarrationShown || showMid,
    });
  },

  // Start next mission: reset timer and advance index
  advanceMission: () => {
    const { currentMissionIndex, schools } = get();
    // Find the next undelivered school
    const nextIdx = schools.findIndex(
      (s, i) => i > currentMissionIndex && !s.delivered
    );
    const resolvedIdx = nextIdx === -1
      ? schools.findIndex(s => !s.delivered)
      : nextIdx;
    set({
      currentMissionIndex: resolvedIdx === -1 ? currentMissionIndex : resolvedIdx,
      timeLeft: MISSION_DURATION,
      phase: 'playing',
    });
  },

  resetGame: () =>
    set({
      phase: 'intro',
      score: 0,
      timeLeft: MISSION_DURATION,
      deliveryCount: 0,
      currentMissionIndex: 0,
      schools: INITIAL_SCHOOLS.map(s => ({ ...s })),
      midNarrationShown: false,
    }),
}));
