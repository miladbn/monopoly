import { Bot, InlineKeyboard, type Context } from 'grammy';
import {
  escHtml,
  missingChannels,
  requiredChannels,
  welcomeBody,
  welcomeComment,
  type RequiredChannel,
} from './channels';
import { createRoom, getGroupRoomId, getRoom, startRoom, toPublicRoom } from './rooms';
import { displayName } from './telegramAuth';

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

function openGameKeyboard(roomId?: string) {
  const url = roomId ? `${webappUrl()}/?room=${roomId}` : webappUrl();
  return new InlineKeyboard().webApp(roomId ? 'Join game' : 'Open Deco City', url);
}

function inviteKeyboard(roomId: string) {
  const link = inviteLink(roomId);
  return new InlineKeyboard()
    .webApp('Play now', `${webappUrl()}/?room=${roomId}`)
    .row()
    .url(
      'Share invite',
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my Deco City game!')}`,
    );
}

function channelKeyboard(channels: RequiredChannel[], roomId?: string) {
  const kb = new InlineKeyboard();
  for (const ch of channels) {
    if (!ch.url) continue;
    kb.url(`Join ${ch.title}`, ch.url).row();
  }
  kb.text("I've joined", roomId ? `cj:${roomId}` : 'cj');
  return kb;
}

function welcomeHtml(name?: string, roomId?: string): string {
  const who = name ? `, ${escHtml(name)}` : '';
  const room = roomId ? `\n\nRoom <b>${escHtml(roomId)}</b> is ready when you are.` : '';
  return (
    `🏙 <b>Welcome to DECO CITY</b>${who}!\n\n` +
    `${escHtml(welcomeBody())}\n\n` +
    `<i>${escHtml(welcomeComment())}</i>` +
    room
  );
}

function gateHtml(name: string | undefined, channels: RequiredChannel[], roomId?: string): string {
  const list = channels.map((c) => `• ${escHtml(c.title)}`).join('\n');
  return (
    `${welcomeHtml(name, roomId)}\n\n` +
    `<b>Join these channels to use the game</b>, then tap <b>I've joined</b>.\n` +
    list
  );
}

function commandsHtml(): string {
  return (
    '\n\n' +
    '• /newgame — create a room (DM or group)\n' +
    '• /join — join the open group room\n' +
    '• /status — lobby status\n' +
    '• /startgame — host starts (AI fills empty seats)'
  );
}

let botSingleton: Bot | null = null;
let profileOnce: Promise<void> | null = null;

async function publishProfile(bot: Bot): Promise<void> {
  if (process.env.SET_BOT_PROFILE === '0') return;
  const description = `${welcomeBody()}\n\n${welcomeComment()}\n\nJoin our channels, then tap Start to play.`.slice(0, 512);
  const short = welcomeComment().slice(0, 120);
  try {
    await bot.api.setMyDescription(description);
    await bot.api.setMyShortDescription(short);
  } catch (e) {
    console.error('set bot profile', e);
  }
}

async function requireChannels(ctx: Context, roomId?: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  if (!requiredChannels().length) return true;
  const missing = await missingChannels(from.id);
  if (!missing.length) return true;
  await ctx.reply(gateHtml(from.first_name, missing, roomId), {
    parse_mode: 'HTML',
    reply_markup: channelKeyboard(missing, roomId),
  });
  return false;
}

function buildBot(): Bot {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not configured');
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const from = ctx.from;
    const payload = ctx.match?.trim();
    const roomId = payload && /^[A-Z0-9]{4,8}$/i.test(payload) ? payload.toUpperCase() : undefined;
    if (from && requiredChannels().length) {
      const missing = await missingChannels(from.id);
      if (missing.length) {
        await ctx.reply(gateHtml(from.first_name, missing, roomId), {
          parse_mode: 'HTML',
          reply_markup: channelKeyboard(missing, roomId),
        });
        return;
      }
    }
    await ctx.reply(welcomeHtml(from?.first_name, roomId) + (roomId ? '' : commandsHtml()), {
      parse_mode: 'HTML',
      reply_markup: openGameKeyboard(roomId),
    });
  });

  bot.callbackQuery(/^cj(?::([A-Z0-9]{4,8}))?$/i, async (ctx) => {
    const roomId = ctx.match?.[1]?.toUpperCase();
    const missing = await missingChannels(ctx.from.id);
    if (missing.length) {
      await ctx.answerCallbackQuery({
        text: 'Join every channel first, then tap again.',
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({ text: 'Welcome — you can play now.' });
    const text = welcomeHtml(ctx.from.first_name, roomId) + (roomId ? '' : commandsHtml());
    const extra = { parse_mode: 'HTML' as const, reply_markup: openGameKeyboard(roomId) };
    try {
      await ctx.editMessageText(text, extra);
    } catch {
      await ctx.reply(text, extra);
    }
  });

  bot.command('newgame', async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    if (!(await requireChannels(ctx))) return;
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
    if (!(await requireChannels(ctx))) return;
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
    if (!(await requireChannels(ctx))) return;
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
    if (!(await requireChannels(ctx))) return;
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
      const n = Array.isArray(room.runtime?.game?.players) ? room.runtime.game.players.length : '?';
      await ctx.reply(
        `🚀 Game *${room.id}* started with ${n} tycoons (AI fills empty seats)!\nOpen the Mini App to play.`,
        { parse_mode: 'Markdown', reply_markup: openGameKeyboard(room.id) },
      );
    } catch (e) {
      await ctx.reply(e instanceof Error ? e.message : 'Could not start');
    }
  });

  bot.catch((err) => console.error('Bot error', err));
  return bot;
}

function bot(): Bot {
  if (!botSingleton) botSingleton = buildBot();
  return botSingleton;
}

export async function handleTelegramWebhook(update: unknown): Promise<void> {
  const b = bot();
  if (!profileOnce) {
    profileOnce = (async () => {
      await b.init();
      await publishProfile(b);
    })().catch((e) => {
      profileOnce = null;
      throw e;
    });
  }
  await profileOnce;
  await b.handleUpdate(update as never);
}
