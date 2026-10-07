interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spin: number;
  rot: number;
  grav: number;
  kind: 'rect' | 'circle' | 'ring';
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

const particles: Particle[] = [];
const texts: FloatText[] = [];
const MAX_P = 420;

let shakeAmt = 0;
let shakeDecay = 0.9;
let flash = 0;
let flashColor = '255,255,255';
let shakeTarget: HTMLElement | null = null;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const fx = {
  setShakeTarget(el: HTMLElement | null) {
    shakeTarget = el;
  },
  shake(amount = 8, decay = 0.88) {
    shakeAmt = Math.min(34, Math.max(shakeAmt, amount));
    shakeDecay = decay;
  },
  flash(color = '255,255,255', amount = 0.35) {
    flash = Math.max(flash, amount);
    flashColor = color;
  },
  burst(
    x: number,
    y: number,
    opts: { count?: number; colors?: string[]; speed?: number; size?: number; grav?: number; spread?: number; kind?: Particle['kind'] } = {},
  ) {
    const {
      count = 18,
      colors = ['#e9c46a', '#fff3cf', '#ffd166'],
      speed = 4.5,
      size = 5,
      grav = 0.18,
      spread = Math.PI * 2,
      kind = 'rect',
    } = opts;
    for (let i = 0; i < count; i++) {
      if (particles.length > MAX_P) break;
      const a = rnd(-spread / 2, spread / 2) + (spread >= Math.PI * 2 ? 0 : -Math.PI / 2);
      const sp = rnd(speed * 0.35, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp * (spread >= Math.PI * 2 ? 1 : 1),
        vy: Math.sin(a) * sp,
        life: 0,
        max: rnd(38, 78),
        size: rnd(size * 0.6, size * 1.5),
        color: colors[(Math.random() * colors.length) | 0],
        spin: rnd(-0.3, 0.3),
        rot: rnd(0, Math.PI),
        grav,
        kind,
      });
    }
  },
  ring(x: number, y: number, color = '#e9c46a') {
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      max: 26,
      size: 8,
      color,
      spin: 0,
      rot: 0,
      grav: 0,
      kind: 'ring',
    });
  },
  text(x: number, y: number, text: string, color = '#ffd166', size = 26) {
    texts.push({ x, y, vy: -1.5, life: 0, max: 72, text, color, size });
  },
  confetti(x: number, y: number) {
    fx.burst(x, y, {
      count: 46,
      colors: ['#e9c46a', '#ff6b6b', '#5ac8fa', '#7ee787', '#f2cf35', '#e95ba1'],
      speed: 9,
      size: 6,
      grav: 0.28,
    });
  },
  step(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      if (p.life > p.max) {
        particles.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.max;
      if (p.kind === 'ring') {
        const r = 6 + (1 - t) * 54;
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * t + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      p.vy += p.grav;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      if (p.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life++;
      if (t.life > t.max) {
        texts.splice(i, 1);
        continue;
      }
      const k = t.life / t.max;
      t.y += t.vy;
      t.vy *= 0.97;
      const pop = t.life < 8 ? 0.6 + (t.life / 8) * 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `800 ${t.size * pop}px Manrope, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    if (flash > 0.002) {
      ctx.fillStyle = `rgba(${flashColor},${flash})`;
      ctx.fillRect(0, 0, w, h);
      flash *= 0.86;
    } else flash = 0;

    if (shakeTarget) {
      if (shakeAmt > 0.3) {
        const a = shakeAmt;
        shakeTarget.style.transform = `translate3d(${rnd(-a, a)}px, ${rnd(-a, a)}px, 0) rotate(${rnd(-a, a) * 0.08}deg)`;
        shakeAmt *= shakeDecay;
      } else if (shakeAmt !== 0) {
        shakeAmt = 0;
        shakeTarget.style.transform = '';
      }
    }
  },
};

export function elCenter(sel: string): { x: number; y: number } {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
