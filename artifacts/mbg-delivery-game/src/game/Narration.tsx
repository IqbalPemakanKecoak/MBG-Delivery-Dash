/**
 * Narration.tsx
 * Full-screen overlay panels for the three story moments:
 *  • Opening  – before the journey begins
 *  • Mid-game – a quiet reflection after the 2nd delivery
 *  • Ending   – a message of hope when all packages are delivered
 */
import React, { useEffect, useState } from 'react';
import { useGameStore } from './useGameStore';

// ── Text content ─────────────────────────────────────────────────────────────

const OPENING = {
  title: 'Makanan Bergizi Gratis',
  subtitle: 'Sebuah Perjalanan Kecil yang Berarti',
  body: [
    'Di ujung pagi yang masih basah oleh embun, seorang mahasiswa mengangkat helm dan menyalakan motornya.',
    'Di jok belakang, tersimpan kotak-kotak makan bergizi — sederhana, namun penuh harapan.',
    'Hari ini, ia bukan sekadar pengendara. Ia adalah jembatan antara cita-cita bangsa dan perut kecil yang lapar.',
    'Setiap sekolah adalah tujuan. Setiap kotak yang tersampaikan adalah doa yang terwujud.',
  ],
  button: 'Mulai Perjalanan',
};

const MID = {
  title: 'Di Tengah Perjalanan',
  body: [
    'Angin berhembus pelan di antara pohon-pohon yang bergoyang.',
    'Dari jauh, terdengar suara anak-anak menyambut kotak makan mereka — tawa kecil yang menghangatkan.',
    'Lelah itu ada. Tapi di balik setiap tikungan, selalu ada wajah yang menunggu dengan senyum.',
    'Teruslah bergerak. Masih ada sekolah yang menanti. Masih ada harapan yang harus diantarkan.',
  ],
  button: 'Lanjutkan',
};

const ENDING_WIN = {
  title: 'Terima Kasih, Pahlawan Kecil',
  body: [
    'Semua kotak telah sampai. Semua sekolah telah dikunjungi.',
    'Di balik motor sederhana itu, tersimpan tekad yang tidak sederhana.',
    'Generasi yang sehat dimulai dari sepiring makanan bergizi. Dan kamu ikut andil di dalamnya.',
    'Ingatlah — perubahan besar dimulai dari langkah-langkah kecil seperti ini.',
    'Indonesia yang kuat tumbuh dari anak-anak yang sehat dan penuh semangat.',
  ],
  button: 'Main Lagi',
};

const ENDING_LOSE = {
  title: 'Waktu Habis...',
  body: [
    'Tidak semua perjalanan berjalan sesuai rencana.',
    'Tapi setiap usaha adalah benih yang ditanam — meski belum berbuah hari ini, ia akan tumbuh esok hari.',
    'Anak-anak itu masih menunggu. Coba lagi, dan kali ini lebih cepat.',
  ],
  button: 'Coba Lagi',
};

// ── Helper component for a styled narration panel ───────────────────────────

interface PanelProps {
  title: string;
  subtitle?: string;
  body: string[];
  button: string;
  onClose: () => void;
  bgClass?: string;
}

function NarrationPanel({ title, subtitle, body, button, onClose, bgClass = 'bg-emerald-950' }: PanelProps) {
  const [visible, setVisible] = useState(false);

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(5, 30, 15, 0.93)', backdropFilter: 'blur(6px)' }}
    >
      <div className="max-w-xl w-full mx-4 text-center">
        {/* Decorative top leaf */}
        <div className="text-4xl mb-4">🌿</div>

        <h1 className="text-3xl font-bold text-emerald-300 mb-1 leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-emerald-500 text-sm mb-6 italic">{subtitle}</p>
        )}

        <div className="space-y-4 mb-8">
          {body.map((line, i) => (
            <p key={i} className="text-emerald-100 text-base leading-relaxed" style={{ opacity: 0.9 }}>
              {line}
            </p>
          ))}
        </div>

        <button
          onClick={onClose}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full transition-all duration-200 shadow-lg hover:shadow-emerald-500/40 hover:scale-105 active:scale-95"
        >
          {button}
        </button>

        {/* HIPMI UNSIQ logo watermark */}
        <p className="text-emerald-800 text-xs mt-8">HIPMI Perguruan Tinggi UNSIQ • MBG Delivery Game</p>
      </div>
    </div>
  );
}

// ── Main Narration component ─────────────────────────────────────────────────

export function Narration() {
  const { phase, startGame, advanceMission, resetGame } = useGameStore();

  if (phase === 'intro') {
    return (
      <NarrationPanel
        title={OPENING.title}
        subtitle={OPENING.subtitle}
        body={OPENING.body}
        button={OPENING.button}
        onClose={startGame}
      />
    );
  }

  if (phase === 'midNarration') {
    return (
      <NarrationPanel
        title={MID.title}
        body={MID.body}
        button={MID.button}
        onClose={advanceMission}
      />
    );
  }

  if (phase === 'win') {
    return (
      <NarrationPanel
        title={ENDING_WIN.title}
        body={ENDING_WIN.body}
        button={ENDING_WIN.button}
        onClose={resetGame}
      />
    );
  }

  if (phase === 'lose') {
    return (
      <NarrationPanel
        title={ENDING_LOSE.title}
        body={ENDING_LOSE.body}
        button={ENDING_LOSE.button}
        onClose={resetGame}
      />
    );
  }

  return null;
}
