# Telegram Mini App setup (Deco City)

Live site: https://monopoly-fawn-rho.vercel.app/  
Bot: [@monopoly_gamee_online_bot](https://t.me/monopoly_gamee_online_bot)

## 1. Bot token (keep secret)

Your token belongs only in **Vercel env vars** and a local **`.env`** file (gitignored).  
If the token was ever pasted in chat or committed, revoke it in [@BotFather](https://t.me/BotFather) with `/revoke` and set the new value.

## 2. Configure the Mini App

In BotFather for `@monopoly_gamee_online_bot`:

1. `/newapp` (or Bot Settings → Configure Mini App)
2. Set the Web App URL to: `https://monopoly-fawn-rho.vercel.app/`
3. Short name e.g. `app` → invite links look like  
   `https://t.me/monopoly_gamee_online_bot/app?startapp=ROOMID`
4. Optional: `/setmenubutton` → same URL

## 3. Vercel environment variables

In the Vercel project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `BOT_TOKEN` | from BotFather |
| `WEBAPP_URL` | `https://monopoly-fawn-rho.vercel.app` |
| `BOT_USERNAME` | `monopoly_gamee_online_bot` |
| `MINI_APP_SHORT_NAME` | e.g. `app` |
| `UPSTASH_REDIS_REST_URL` | from [Upstash](https://upstash.com/) Redis |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
| `REQUIRED_CHANNELS` | channels players must join, comma-separated |
| `WELCOME_MESSAGE` | welcome text on `/start` |
| `WELCOME_COMMENT` | short comment under the welcome (also the bot's short description) |

`REQUIRED_CHANNELS` examples:

```
@deco_city,@deco_news
@deco_city|https://t.me/deco_city|Deco City News
```

Add the bot as an **admin** in each channel (so it can call `getChatMember`). Until `REQUIRED_CHANNELS` is set, the join check is skipped.

Create a free Upstash Redis database and paste the REST credentials. Without Redis, rooms only live in memory on one serverless instance (not reliable in production).

Redeploy after saving env vars.

## 4. Set the Telegram webhook

After deploy:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://monopoly-fawn-rho.vercel.app/api/telegram"
```

Check:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

Example invite after a room is created:  
`https://t.me/monopoly_gamee_online_bot/app?startapp=ABC123`

## 5. Bot commands

| Command | Where | Effect |
|---------|--------|--------|
| `/start` | DM | Welcome message, comment, and Open Game. If channels are required, Join buttons appear first. |
| `/newgame` | DM or group | Create room + Mini App / invite buttons |
| `/join` | Group | Open the group's lobby room |
| `/status` | DM/group | Show lobby (`/status CODE` optional) |
| `/startgame` | DM/group | Host starts; AI fills empty seats to 4 |

Invite link format:

`https://t.me/<BOT_USERNAME>/<MINI_APP_SHORT_NAME>?startapp=<ROOMID>`

Players can also share `https://monopoly-fawn-rho.vercel.app/?room=<ROOMID>` (must open inside Telegram for auth).

## 6. Group play

1. Add the bot to a group
2. Disable privacy mode if commands are ignored: BotFather → Bot Settings → Group Privacy → Turn off
3. `/newgame` in the group → members tap **Join game**
4. Host `/startgame` or taps **START GAME** in the Mini App lobby

## 7. Local development

```bash
npm install
npm run dev
```

API routes need Vercel (`vercel dev`) or a deployed backend — Vite alone serves the SPA. For full local API:

```bash
npx vercel dev
```

Copy `.env.example` to `.env` and fill values (Vercel CLI loads them).
