/**
 * SoundManager.tsx
 * Procedural Web Audio API sound engine.
 *
 * New in this revision:
 *  • playDeliverySound() — a satisfying ascending chime that fires on each
 *    successful delivery, detected by watching deliveryCount changes.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

const RIVER_X_MIN = -10, RIVER_X_MAX = 40;
const RIVER_Z_MIN = 20,  RIVER_Z_MAX = 60;

function isNearRiver(pos: THREE.Vector3) {
  return pos.x >= RIVER_X_MIN && pos.x <= RIVER_X_MAX &&
         pos.z >= RIVER_Z_MIN && pos.z <= RIVER_Z_MAX;
}

interface Props { playerPositionRef: React.RefObject<THREE.Vector3>; }

export function SoundManager({ playerPositionRef }: Props) {
  const { phase, deliveryCount } = useGameStore();
  const ctxRef        = useRef<AudioContext | null>(null);
  const windGainRef   = useRef<GainNode | null>(null);
  const waterGainRef  = useRef<GainNode | null>(null);
  const startedRef    = useRef(false);
  const birdTimerRef  = useRef(0);
  const prevDelivery  = useRef(0);

  // ── Build audio graph ─────────────────────────────────────────────────────
  const startAudio = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    function makeNoise(secs = 2) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true; return src;
    }

    // Wind
    const windNoise  = makeNoise();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass'; windFilter.frequency.value = 420;
    const windGain   = ctx.createGain(); windGain.gain.value = 0.06;
    windGainRef.current = windGain;
    const lfo     = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(windGain.gain); lfo.start();
    windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    windNoise.start();

    // Traffic
    const tNoise  = makeNoise();
    const tFilter = ctx.createBiquadFilter(); tFilter.type = 'bandpass'; tFilter.frequency.value = 280; tFilter.Q.value = 0.6;
    const tGain   = ctx.createGain(); tGain.gain.value = 0.025;
    tNoise.connect(tFilter); tFilter.connect(tGain); tGain.connect(ctx.destination); tNoise.start();

    // Water
    const wNoise  = makeNoise();
    const wFilter = ctx.createBiquadFilter(); wFilter.type = 'highpass'; wFilter.frequency.value = 700;
    const wGain   = ctx.createGain(); wGain.gain.value = 0;
    waterGainRef.current = wGain;
    wNoise.connect(wFilter); wFilter.connect(wGain); wGain.connect(ctx.destination); wNoise.start();
  }, []);

  // ── Bird chirp ────────────────────────────────────────────────────────────
  const playBirdChirp = useCallback(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600 + Math.random() * 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 600, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.14);
  }, []);

  // ── Delivery chime (ascending major arpeggio) ─────────────────────────────
  const playDeliverySound = useCallback(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    // C5 E5 G5 C6 — bright, celebratory
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime + i * 0.11;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.5);

      // Soft reverb shimmer on the last note
      if (i === notes.length - 1) {
        const rev  = ctx.createOscillator();
        const rg   = ctx.createGain();
        rev.type = 'sine'; rev.frequency.value = freq * 2;
        rg.gain.setValueAtTime(0, t + 0.05);
        rg.gain.linearRampToValueAtTime(0.06, t + 0.1);
        rg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        rev.connect(rg); rg.connect(ctx.destination);
        rev.start(t + 0.05); rev.stop(t + 0.9);
      }
    });
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') startAudio();
    else ctxRef.current?.suspend();
  }, [phase, startAudio]);

  useEffect(() => {
    if (phase === 'playing' && ctxRef.current?.state === 'suspended')
      ctxRef.current.resume();
  }, [phase]);

  // ── Delivery sound trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (deliveryCount > prevDelivery.current) {
      playDeliverySound();
      prevDelivery.current = deliveryCount;
    }
  }, [deliveryCount, playDeliverySound]);

  // ── Per-frame: birds + water ──────────────────────────────────────────────
  useFrame((_, delta) => {
    if (phase !== 'playing') return;
    birdTimerRef.current -= delta;
    if (birdTimerRef.current <= 0) {
      playBirdChirp();
      if (Math.random() > 0.5) setTimeout(playBirdChirp, 120);
      birdTimerRef.current = 3 + Math.random() * 5;
    }
    if (waterGainRef.current && playerPositionRef.current) {
      const near    = isNearRiver(playerPositionRef.current);
      const target  = near ? 0.07 : 0;
      const current = waterGainRef.current.gain.value;
      waterGainRef.current.gain.value += (target - current) * 0.05;
    }
  });

  return null;
}
