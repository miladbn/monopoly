let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = localStorage.getItem('deco-city-muted') === '1';

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur = 0.08, vol = 0.25, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gn = c.createGain();
  gn.gain.value = vol;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  src.connect(f).connect(gn).connect(master);
  src.start(c.currentTime + delay);
}

export const sfx = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    localStorage.setItem('deco-city-muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  unlock() {
    ac();
  },
  click: () => noise(0.05, 0.18),
  step: () => tone(620, 0.05, 'triangle', 0.08),
  dice: () => {
    noise(0.07, 0.2);
    noise(0.06, 0.16, 0.07);
    noise(0.05, 0.12, 0.14);
  },
  cash: () => {
    tone(880, 0.1, 'triangle', 0.22);
    tone(1320, 0.14, 'triangle', 0.18, 0.07);
  },
  pay: () => {
    tone(260, 0.22, 'sawtooth', 0.18, 0, 110);
    noise(0.12, 0.14);
  },
  buy: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.2, i * 0.06));
  },
  build: () => tone(440, 0.09, 'square', 0.14, 0, 880),
  card: () => noise(0.22, 0.12),
  jail: () => {
    [440, 330, 247].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.16, i * 0.09));
  },
  bust: () => {
    [330, 262, 196, 131].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.2, i * 0.12));
  },
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, i * 0.1));
  },
};
