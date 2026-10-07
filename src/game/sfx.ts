import { settings } from './settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let muted = settings.sfxMuted();
let musicMuted = settings.musicMuted();
let musicTimer: number | null = null;
let musicStep = 0;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = muted ? 0 : 0.5;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicMuted ? 0 : 0.12;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.3,
  delay = 0,
  slideTo?: number,
  dest: GainNode | null = sfxGain,
) {
  const c = ac();
  if (!c || !dest) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur = 0.08, vol = 0.25, delay = 0) {
  const c = ac();
  if (!c || !sfxGain) return;
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
  src.connect(f).connect(gn).connect(sfxGain);
  src.start(c.currentTime + delay);
}

const MUSIC_NOTES = [196, 233, 262, 311, 349, 311, 262, 233];

function tickMusic() {
  if (musicMuted || !musicGain) return;
  const n = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
  musicStep++;
  tone(n, 0.35, 'triangle', 0.35, 0, undefined, musicGain);
  tone(n * 1.5, 0.28, 'sine', 0.12, 0.05, undefined, musicGain);
}

export const sfx = {
  get muted() {
    return muted;
  },
  get musicMuted() {
    return musicMuted;
  },
  toggle() {
    muted = !muted;
    settings.setSfxMuted(muted);
    if (sfxGain) sfxGain.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  toggleMusic() {
    musicMuted = !musicMuted;
    settings.setMusicMuted(musicMuted);
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : 0.12;
    if (!musicMuted) this.startMusic();
    else this.stopMusic();
    return musicMuted;
  },
  unlock() {
    ac();
  },
  startMusic() {
    ac();
    if (musicTimer != null || musicMuted) return;
    tickMusic();
    musicTimer = window.setInterval(tickMusic, 900);
  },
  stopMusic() {
    if (musicTimer != null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
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
