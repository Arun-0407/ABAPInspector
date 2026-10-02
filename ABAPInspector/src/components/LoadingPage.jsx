import { useState, useEffect } from 'react';

// Cumulative % complete at each step (steps 1-7)
const STEP_PCT = [0, 0.04, 0.09, 0.14, 0.20, 0.82, 0.94, 1.0];
const TYPICAL_S = 120;

function getEstRemaining(elapsed, step) {
  const pct = STEP_PCT[Math.min(step, STEP_PCT.length - 1)];
  if (pct < 0.04 || elapsed < 8) return null;
  const estTotal = Math.max(elapsed / pct, TYPICAL_S);
  return Math.max(0, Math.round(estTotal - elapsed));
}

function fmtTime(s) {
  if (s == null) return null;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `~${m}m ${ss}s` : `~${ss}s`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch {}
}

export default function LoadingPage({ progress, modelLabel, isDone }) {
  const { step = 0, total = 7, message = 'Initializing…' } = progress;
  const [elapsed, setElapsed] = useState(0);
  const [displayMsg, setDisplayMsg] = useState(message);
  const [msgKey, setMsgKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setDisplayMsg(message);
    setMsgKey(k => k + 1);
  }, [message]);

  useEffect(() => {
    if (isDone) playBeep();
  }, [isDone]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const estRem = getEstRemaining(elapsed, step);
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  if (isDone) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div style={{ animation: 'pop-in 0.4s cubic-bezier(.16,1,.3,1) forwards' }}>
          <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p className="text-2xl font-bold text-white text-center">Analysis Complete!</p>
          <p className="text-slate-400 text-center mt-2 text-sm">Loading your report…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-blue-600/8 blur-3xl pointer-events-none" style={{ animation: 'orb-float 7s ease-in-out infinite' }} />
      <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-violet-600/8 blur-3xl pointer-events-none" style={{ animation: 'orb-float 9s ease-in-out infinite', animationDelay: '3s' }} />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Spinner */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          <svg className="absolute inset-0 w-full h-full" style={{ animation: 'spin 1.4s linear infinite' }} viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="56" fill="none" stroke="#1e3a5f" strokeWidth="6"/>
            <circle cx="64" cy="64" r="56" fill="none" stroke="#3b82f6" strokeWidth="6"
              strokeLinecap="round" strokeDasharray="352" strokeDashoffset="264"/>
          </svg>
          <svg className="absolute inset-0 w-full h-full" style={{ animation: 'spin 2.2s linear infinite reverse' }} viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="42" fill="none" stroke="#1d4ed8" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="264" strokeDashoffset="200" opacity="0.5"/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-9 h-9 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-5">Analyzing ABAP Program</h2>

        <div className="bg-slate-800/70 border border-slate-700/60 backdrop-blur rounded-2xl p-5 mb-4">
          {/* Timer row */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700/50">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Elapsed</div>
              <div className="font-mono text-base font-bold text-blue-400">{mm}:{ss}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Step</div>
              <div className="font-mono text-base font-bold text-slate-300">{step}/{total}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Est. Left</div>
              <div className="font-mono text-base font-bold text-amber-400">
                {estRem != null ? fmtTime(estRem) : '—'}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }} />
          </div>

          {/* Animated status */}
          <div className="min-h-[2.5rem] flex items-center justify-center">
            <p key={msgKey} className="text-slate-300 text-sm text-center leading-relaxed"
               style={{ animation: 'fade-in 0.4s ease forwards' }}>
              {displayMsg}
            </p>
          </div>

          <div className="flex justify-center gap-1.5 mt-3">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500"
                style={{ animation: `pulse-glow 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">AI analysis typically takes 2–4 minutes for large programs</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop-in { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}
