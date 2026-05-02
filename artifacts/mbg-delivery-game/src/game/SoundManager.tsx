/**
 * SoundManager.tsx
 * Creates procedural ambient audio using the Web Audio API.
 * No audio files needed — all sounds are synthesised in-browser.
 *
 * Sounds produced:
 *  • Wind  — low-pass filtered white noise, gentle swell
 *  • Birds — periodic high chirps using short sine bursts
 *  • Traffic — band-pass filtered noise at medium frequency
 *  • Water  — louder, higher-pitched noise when near river zone
 */
import { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';

// River zone: x in [-10, 40], z in [20, 60]
const RIVER_X_MIN = -10, RIVER_X_MAX = 40;
const RIVER_Z_MIN = 20,  RIVER_Z_MAX = 60;

function isNearRiver(pos: THREE.Vector3): boolean {
  return (
    pos.x >= RIVER_X_MIN && pos.x <= RIVER_X_MAX &&
    pos.z >= RIVER_Z_MIN && pos.z <= RIVER_Z_MAX
  );
}

interface SoundManagerProps {
  playerPositionRef: React.RefObject<THREE.Vector3>;
}

export function SoundManager({ playerPositionRef }: SoundManagerProps) {
  const { phase } = useGameStore();
  const ctxRef = useRef<AudioContext | null>(null);
  const windGainRef   = useRef<GainNode | null>(null);
  const waterGainRef  = useRef<GainNode | null>(null);
  const lfoRef        = useRef<OscillatorNode | null>(null);
  const startedRef    = useRef(false);
  const birdTimerRef  = useRef(0);

  // ── Build audio graph ────────────────────────────────────────────────────
  const startAudio = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // Helper: create a white-noise buffer source
    function makeNoise(seconds = 2): AudioBufferSourceNode {
      const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      return src;
    }

    // ── Wind ─────────────────────────────────────────────────────────────
    const windNoise = makeNoise();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;
    windGainRef.current = windGain;

    // Slow LFO swell on wind gain
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    lfo.start();
    lfoRef.current = lfo;

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windNoise.start();

    // ── Traffic ───────────────────────────────────────────────────────────
    const trafficNoise = makeNoise();
    const trafficFilter = ctx.createBiquadFilter();
    trafficFilter.type = 'bandpass';
    trafficFilter.frequency.value = 280;
    trafficFilter.Q.value = 0.6;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = 0.025;
    trafficNoise.connect(trafficFilter);
    trafficFilter.connect(trafficGain);
    trafficGain.connect(ctx.destination);
    trafficNoise.start();

    // ── Water ─────────────────────────────────────────────────────────────
    const waterNoise = makeNoise();
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'highpass';
    waterFilter.frequency.value = 700;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0; // starts silent, raised near river
    waterGainRef.current = waterGain;
    waterNoise.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(ctx.destination);
    waterNoise.start();
  }, []);

  // ── Chirp helper ─────────────────────────────────────────────────────────
  const playBirdChirp = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Randomish chirp pitch
    osc.frequency.setValueAtTime(2600 + Math.random() * 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3200 + Math.random() * 600, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  }, []);

  // ── Start audio on first play ─────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') {
      startAudio();
    }
    return () => {
      if (phase === 'intro' || phase === 'win' || phase === 'lose') {
        // Fade out and suspend
        const ctx = ctxRef.current;
        if (ctx) ctx.suspend();
      }
    };
  }, [phase, startAudio]);

  // Resume context after it may have been suspended
  useEffect(() => {
    if (phase === 'playing' && ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume();
    }
  }, [phase]);

  // ── Per-frame: birds + water proximity ───────────────────────────────────
  useFrame((_, delta) => {
    if (phase !== 'playing') return;

    // Bird chirps every ~4-8s
    birdTimerRef.current -= delta;
    if (birdTimerRef.current <= 0) {
      playBirdChirp();
      // Occasionally a double chirp
      if (Math.random() > 0.5) setTimeout(playBirdChirp, 120);
      birdTimerRef.current = 3 + Math.random() * 5;
    }

    // Water volume proximity
    if (waterGainRef.current && playerPositionRef.current) {
      const near = isNearRiver(playerPositionRef.current);
      const target = near ? 0.07 : 0;
      const current = waterGainRef.current.gain.value;
      waterGainRef.current.gain.value = current + (target - current) * 0.05;
    }
  });

  return null;
}
