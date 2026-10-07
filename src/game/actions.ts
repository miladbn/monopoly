/**
 * Shared client/server action protocol.
 * Solo maps UI `respond(type, value)` into these; MP sends them over the wire.
 */

export type GameActionType =
  | 'roll'
  | 'jail'
  | 'buy'
  | 'auction'
  | 'ack'
  | 'endturn'
  | 'build'
  | 'sellHouse'
  | 'mortgage'
  | 'unmortgage'
  | 'tradeOffer'
  | 'tradeRespond';

export interface GameAction {
  type: GameActionType;
  payload?: unknown;
  /** Client-generated id for idempotent retries (multiplayer). */
  clientActionId?: string;
}

export function newClientActionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
