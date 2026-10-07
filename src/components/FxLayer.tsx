import { useEffect, useRef } from 'react';
import { fx } from '../game/fx';

export default function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d', { alpha: true })!;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.floor(window.innerWidth * dpr);
      cv.height = Math.floor(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      fx.step(ctx, window.innerWidth, window.innerHeight);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" />;
}
