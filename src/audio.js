// Tiny synthesized sound effects (no audio files).
let ctx = null, master = null, noiseBuf = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol, freq, delay = 0, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  thwack() { noise(0.12, 0.7, 2200); tone('square', 170, 55, 0.16, 0.25); },
  pop() { tone('sine', 700 + Math.random() * 300, 1900, 0.09, 0.28); },
  boing() { tone('sine', 160, 760, 0.38, 0.35); tone('triangle', 240, 900, 0.3, 0.15, 0.03); },
  hop() { tone('sine', 300, 520, 0.08, 0.12); },
  croak() { tone('sawtooth', 150, 95, 0.16, 0.16); tone('sawtooth', 160, 100, 0.16, 0.14, 0.18); },
  thud() { tone('sine', 130, 45, 0.14, 0.32); },
  leaves() { noise(0.25, 0.35, 3000, 0, 'bandpass'); },
  splash() { noise(0.6, 0.55, 1100); tone('sine', 400, 120, 0.3, 0.12); },
  coin() { tone('square', 988, 988, 0.06, 0.1); tone('square', 1319, 1319, 0.18, 0.1, 0.06); },
  belt() { tone('square', 200, 200, 0.05, 0.08); tone('square', 260, 260, 0.05, 0.08, 0.08); },
  trumpet() { tone('sawtooth', 280, 520, 0.5, 0.18); tone('sawtooth', 420, 700, 0.45, 0.12, 0.05); },
  bonk() { tone('triangle', 500, 200, 0.12, 0.25); },
  tick() { tone('sine', 1200, 1200, 0.02, 0.05); },
  ding() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.3, 0.22, i * 0.1)); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, f, 0.22, 0.12, i * 0.13)); },
};
