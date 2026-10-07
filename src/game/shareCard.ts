import type { Game } from './engine';
import { money, netWorth } from './engine';

/** Draw a shareable victory / result PNG into a data URL. */
export function renderShareCard(opts: {
  g: Game;
  meId: number;
  won: boolean;
  score?: number;
  title?: string;
}): string {
  const { g, meId, won, score } = opts;
  const me = g.players[meId];
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#1f4a3d');
  grad.addColorStop(0.55, '#0f2a24');
  grad.addColorStop(1, '#0a1412');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(201,168,76,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  ctx.fillStyle = '#c9a84c';
  ctx.font = '700 72px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Deco City', canvas.width / 2, 180);

  ctx.fillStyle = '#efe4c4';
  ctx.font = '600 48px Manrope, sans-serif';
  ctx.fillText(opts.title || (won ? 'Victory' : 'Game over'), canvas.width / 2, 280);

  ctx.font = '500 36px Manrope, sans-serif';
  ctx.fillStyle = '#b4c9c1';
  ctx.fillText(me?.name || 'Tycoon', canvas.width / 2, 360);

  const token = me?.token || '🎩';
  ctx.font = '120px sans-serif';
  ctx.fillText(token, canvas.width / 2, 520);

  ctx.fillStyle = '#7ee787';
  ctx.font = '700 64px Manrope, sans-serif';
  const worth = me ? netWorth(g, meId) : 0;
  ctx.fillText(score != null ? `Score ${score.toLocaleString()}` : money(worth), canvas.width / 2, 640);

  ctx.fillStyle = '#b4c9c1';
  ctx.font = '500 28px Manrope, sans-serif';
  ctx.fillText(`Round ${g.round} · ${g.players.filter((p) => !p.bankrupt).length} standing`, canvas.width / 2, 720);

  let y = 820;
  g.players.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.font = '500 30px Manrope, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.token} ${p.name}`, 160, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = p.bankrupt ? '#e07a88' : '#efe4c4';
    ctx.fillText(p.bankrupt ? 'Out' : money(netWorth(g, p.id)), canvas.width - 160, y);
    y += 56;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(201,168,76,0.7)';
  ctx.font = '500 24px Manrope, sans-serif';
  ctx.fillText('Play Deco City in Telegram', canvas.width / 2, canvas.height - 90);

  return canvas.toDataURL('image/png');
}

export async function shareOrDownloadCard(dataUrl: string, filename = 'deco-city.png') {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Deco City', text: 'My Deco City result' });
      return;
    }
  } catch {
    /* fall through */
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
