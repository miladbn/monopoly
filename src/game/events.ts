import type { LogKind } from './engine';

/**
 * Typed game events for future stats / analytics / structured UI.
 * Engines can emit these alongside log lines without coupling to React.
 */
export type GameEventType =
  | 'roll'
  | 'move'
  | 'pass_go'
  | 'buy'
  | 'rent'
  | 'pay'
  | 'jail'
  | 'trade'
  | 'auction'
  | 'build'
  | 'bankrupt'
  | 'turn'
  | 'win';

export interface GameEvent {
  type: GameEventType;
  at: number;
  seat?: number;
  amount?: number;
  space?: number;
  text?: string;
  meta?: Record<string, unknown>;
}

/** Map event types to log toast kinds. */
export function eventToLogKind(type: GameEventType): LogKind {
  switch (type) {
    case 'rent':
      return 'rent';
    case 'buy':
      return 'buy';
    case 'pay':
      return 'pay';
    case 'jail':
      return 'jail';
    case 'trade':
      return 'trade';
    case 'pass_go':
      return 'go';
    case 'auction':
      return 'auction';
    case 'bankrupt':
      return 'bankrupt';
    case 'build':
      return 'build';
    default:
      return 'info';
  }
}

/** In-memory ring buffer for optional listeners (stats, FX, tests). */
const listeners = new Set<(e: GameEvent) => void>();
const recent: GameEvent[] = [];
const MAX_RECENT = 80;

export function onGameEvent(fn: (e: GameEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitGameEvent(partial: Omit<GameEvent, 'at'> & { at?: number }): GameEvent {
  const e: GameEvent = { ...partial, at: partial.at ?? Date.now() };
  recent.unshift(e);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch {
      /* ignore listener errors */
    }
  });
  return e;
}

export function recentGameEvents(): readonly GameEvent[] {
  return recent;
}
