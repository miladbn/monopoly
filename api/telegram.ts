import type { VercelRequest, VercelResponse } from '@vercel/node';

function webappUrl(): string {
  return (process.env.WEBAPP_URL || 'https://monopoly-fawn-rho.vercel.app').replace(/\/$/, '');
}

function botUsername(): string {
  return (process.env.BOT_USERNAME || 'monopoly_gamee_online_bot').replace(/^@/, '');
}

function miniAppShortName(): string {
  return process.env.MINI_APP_SHORT_NAME || 'app';
}

function inviteLink(roomId: string): string {
  const user = botUsername();
  const short = miniAppShortName();
  if (user) return `https://t.me/${user}/${short}?startapp=${roomId}`;
  return `${webappUrl()}/?room=${roomId}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'deco-city-telegram' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { Bot, InlineKeyboard } = await import('grammy');
    const { createRoom, getGroupRoomId, getRoom, startRoom, toPublicRoom } = await import('../server/rooms');
    const { displayName } = await import('../server/telegramAuth');

    const token = process.env.BOT_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'BOT_TOKEN missing' });
      return;
    }

    const bot = new Bot(token);

    const openGameKeyboard = (roomId?: string) => {
      const url = roomId ? `${webappUrl()}/?room=${roomId}` : webappUrl();
      return new InlineKeyboard().webApp(roomId ? 'Join game' : 'Open Deco City', url);
    };

    const inviteKeyboard = (roomId: string) => {
      const link = inviteLink(roomId);
      return new InlineKeyboard()
        .webApp('Play now', `${webappUrl()}/?room=${roomId}`)
        .row()
        .url(
          'Share invite',
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my Deco City game!')}`,
        );
    };

    bot.command('start', async (ctx) => {
      const payload = ctx.match?.trim();
      if (payload && /^[A-Z0-9]{4,8}$/i.test(payload)) {
        const roomId = payload.toUpperCase();
        await ctx.reply(`🏠 Room *${roomId}*\nTap below to join the lobby.`, {
          parse_mode: 'Markdown',
          reply_markup: openGameKeyboard(roomId),
        });
        return;
      }
      await ctx.reply(
        '🏙 *DECO CITY*\nBuild empires with friends in Telegram.\n\n' +
          '• `/newgame` — create a room (DM or group)\n' +
          '• `/join` — join the open group room\n' +
          '• `/status` — lobby status\n' +
          '• `/startgame` — host starts (AI fills empty seats)',
        { parse_mode: 'Markdown', reply_markup: openGameKeyboard() },
      );
    });

    bot.command('newgame', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const chatId = ctx.chat?.type === 'private' ? undefined : ctx.chat?.id;
      const room = await createRoom({
        hostTelegramId: from.id,
        hostName: displayName(from),
        chatId,
        maxPlayers: 4,
      });
      const link = inviteLink(room.id);
      const where = chatId ? 'this group' : 'your private lobby';
      await ctx.reply(
        `🎲 New Deco City room *${room.id}* created in ${where}.\n` +
          `Players: 1/${room.maxPlayers}\n` +
          `Invite: ${link}\n\n` +
          `Friends open the Mini App, then host runs /startgame (or Start in the app).`,
        { parse_mode: 'Markdown', reply_markup: inviteKeyboard(room.id) },
      );
    });

    bot.command('join', async (ctx) => {
      const chat = ctx.chat;
      if (!chat || chat.type === 'private') {
        await ctx.reply('Use /join in a group that has an open room, or open an invite link.');
        return;
      }
      const roomId = await getGroupRoomId(chat.id);
      if (!roomId) {
        await ctx.reply('No open room here. Ask someone to run /newgame.');
        return;
      }
      const room = await getRoom(roomId);
      if (!room || room.status !== 'lobby') {
        await ctx.reply('No lobby available. Start a new one with /newgame.');
        return;
      }
      await ctx.reply(`🏠 Room *${room.id}* — ${room.players.length}/${room.maxPlayers} players.\nTap to join.`, {
        parse_mode: 'Markdown',
        reply_markup: openGameKeyboard(room.id),
      });
    });

    bot.command('status', async (ctx) => {
      let roomId: string | null = null;
      if (ctx.chat && ctx.chat.type !== 'private') {
        roomId = await getGroupRoomId(ctx.chat.id);
      }
      const match = ctx.match?.trim().toUpperCase();
      if (match) roomId = match;
      if (!roomId) {
        await ctx.reply('No room linked. Pass a code: `/status ABC123`', { parse_mode: 'Markdown' });
        return;
      }
      const room = await getRoom(roomId);
      if (!room) {
        await ctx.reply('Room not found.');
        return;
      }
      const pub = toPublicRoom(room);
      const list = pub.players
        .map((p) => `• ${p.name}${p.ready ? ' ✅' : ''}${p.telegramId === room.hostTelegramId ? ' (host)' : ''}`)
        .join('\n');
      await ctx.reply(`Room *${room.id}* — *${room.status}*\n${list || 'Empty'}\n\n${inviteLink(room.id)}`, {
        parse_mode: 'Markdown',
        reply_markup: openGameKeyboard(room.id),
      });
    });

    bot.command('startgame', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      let roomId: string | null = null;
      if (ctx.chat && ctx.chat.type !== 'private') {
        roomId = await getGroupRoomId(ctx.chat.id);
      }
      const match = ctx.match?.trim().toUpperCase();
      if (match) roomId = match;
      if (!roomId) {
        await ctx.reply('No room found. Create one with /newgame or pass a code.');
        return;
      }
      try {
        const room = await startRoom(roomId, from.id, true);
        await ctx.reply(
          `🚀 Game *${room.id}* started with ${room.runtime?.game?.players?.length ?? '?'} tycoons (AI fills empty seats)!\nOpen the Mini App to play.`,
          { parse_mode: 'Markdown', reply_markup: openGameKeyboard(room.id) },
        );
      } catch (e) {
        await ctx.reply(e instanceof Error ? e.message : 'Could not start');
      }
    });

    bot.catch((err) => console.error('Bot error', err));

    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Webhook failed',
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  }
}
