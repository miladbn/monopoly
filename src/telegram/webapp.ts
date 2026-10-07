export interface TgWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TgWebAppUser;
    start_param?: string;
    auth_date?: number;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (t: string) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
  };
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function getWebApp(): TgWebApp | null {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null;
}

export function isTelegram(): boolean {
  const wa = getWebApp();
  return !!(wa && (wa.initData || wa.initDataUnsafe?.user));
}

export function bootstrapTelegram(): { roomFromStart?: string } {
  const wa = getWebApp();
  if (!wa) {
    const params = new URLSearchParams(window.location.search);
    return { roomFromStart: params.get('room') || undefined };
  }
  try {
    wa.ready();
    wa.expand();
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(window.location.search);
  const roomFromStart = wa.initDataUnsafe?.start_param || params.get('room') || undefined;
  return { roomFromStart: roomFromStart || undefined };
}

export function telegramDisplayName(): string {
  const u = getWebApp()?.initDataUnsafe?.user;
  if (!u) return localStorage.getItem('deco-city-name') || 'You';
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return (n || u.username || 'You').slice(0, 14);
}

export function getInitData(): string {
  return getWebApp()?.initData || '';
}

export function openExternal(url: string): void {
  const wa = getWebApp();
  if (url.includes('t.me') && wa?.openTelegramLink) {
    wa.openTelegramLink(url);
    return;
  }
  if (wa?.openLink) {
    wa.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
