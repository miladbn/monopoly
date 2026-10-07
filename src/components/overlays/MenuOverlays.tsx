import { useState } from 'react';
import PlayerAppearancePicker from '../PlayerAppearancePicker';
import { AI_DIFFICULTIES, type AiDifficulty } from '../../game/ai';
import { Game, money, netWorth } from '../../game/engine';
import { summarizeGame } from '../../game/history';
import { hasSoloSave } from '../../game/persist';
import {
  loadPlayerName,
  loadPlayerProfile,
  savePlayerName,
  savePlayerProfile,
  type PlayerAppearance,
} from '../../game/playerProfile';
import type { HighScore } from '../../game/useGame';
import { Modal } from './Modal';

export function StartScreen({
  scores,
  onStart,
  onContinue,
  onMultiplayer,
  showTelegram,
  dailyBest,
}: {
  scores: HighScore[];
  onStart: (
    name: string,
    opponents: number,
    appearance: PlayerAppearance,
    opts?: { daily?: boolean; difficulty?: AiDifficulty },
  ) => void;
  onContinue?: () => void;
  onMultiplayer?: () => void;
  showTelegram?: boolean;
  dailyBest?: { score: number; won: boolean } | null;
}) {
  const [name, setName] = useState(() => loadPlayerName());
  const [opp, setOpp] = useState(3);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal');
  const [appearance, setAppearance] = useState(loadPlayerProfile);
  const canContinue = hasSoloSave();
  const go = (daily = false) => {
    savePlayerName(name);
    savePlayerProfile(appearance);
    onStart(name.trim() || 'You', daily ? 3 : opp, appearance, { daily, difficulty: daily ? 'normal' : difficulty });
  };
  return (
    <Modal dim={0.88}>
      <div className="popin panel step-frame scroll relative max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto rounded-xl p-3.5 sm:p-6">
        <div className="sunburst" aria-hidden />
        <div className="relative text-center">
          <h1 className="deco brand-in text-[2rem] font-bold leading-none gold-text sm:text-5xl">Deco City</h1>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--mist)] sm:mt-2 sm:text-[13px]">
            Buy the board. Build the sets. Bankrupt the table.
          </p>
        </div>

        <div className="relative mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--mist)]" htmlFor="tycoon-name">
              Your name
            </label>
            <input
              id="tycoon-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 14))}
              onKeyDown={(e) => e.key === 'Enter' && go(false)}
              placeholder="Tycoon"
              className="field"
              autoComplete="nickname"
            />
          </div>
          <div>
            <div className="mb-1 block text-[12px] font-medium text-[var(--mist)]">Rivals</div>
            <div className="flex gap-2" role="group" aria-label="Number of AI rivals">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOpp(n)}
                  className={`btn flex-1 py-2 text-sm sm:py-2.5 ${opp === n ? 'btn-gold' : 'btn-dark'}`}
                  aria-pressed={opp === n}
                >
                  {n} AI
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 block text-[12px] font-medium text-[var(--mist)]">AI difficulty</div>
            <div className="flex gap-2" role="group" aria-label="AI difficulty">
              {AI_DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`btn flex-1 py-2 text-sm sm:py-2.5 ${difficulty === d.id ? 'btn-gold' : 'btn-dark'}`}
                  aria-pressed={difficulty === d.id}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <PlayerAppearancePicker
            value={appearance}
            onChange={(next) => {
              setAppearance(next);
              savePlayerProfile(next);
            }}
            compact
          />
          {canContinue && onContinue && (
            <button type="button" onClick={onContinue} className="btn btn-gold pulse-glow w-full py-3 text-base sm:py-3.5">
              Continue saved game
            </button>
          )}
          <button
            type="button"
            onClick={() => go(false)}
            className={`btn w-full py-3 text-base sm:py-3.5 ${canContinue && onContinue ? 'btn-dark' : 'btn-gold pulse-glow'}`}
          >
            Play solo
          </button>
          <button type="button" onClick={() => go(true)} className="btn btn-dark w-full py-2.5 text-sm sm:py-3">
            Daily challenge
            {dailyBest ? ` · best ${dailyBest.score.toLocaleString()}` : ''}
          </button>
          {showTelegram && onMultiplayer && (
            <button type="button" onClick={onMultiplayer} className="btn btn-dark w-full py-2.5 text-sm sm:py-3">
              Play with friends
            </button>
          )}
        </div>

        <p className="relative mt-3 hidden text-center text-[11px] leading-relaxed text-[var(--mist)]/80 sm:mt-5 sm:block">
          Space rolls · B buys · A auctions · E ends turn · P pauses
        </p>

        <div className="relative mt-3 border-t border-[var(--brass)]/15 pt-3 sm:mt-5 sm:pt-4">
          <div className="deco mb-1.5 text-center text-[12px] text-[var(--brass)] sm:mb-2">Hall of fame</div>
          {scores.length === 0 ? (
            <p className="py-1.5 text-center text-[12px] text-[var(--mist)]/70 sm:py-2">No scores yet. Claim the first seat.</p>
          ) : (
            <div className="space-y-1">
              {scores.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                  <span className="w-4 text-center font-bold text-[var(--brass)]">{i + 1}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.won && <span className="text-[10px] text-[var(--brass)]">won</span>}
                  <span className="font-bold tabular-nums text-emerald-300/90">{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function PauseOverlay({ onResume, onRestart, onMenu }: { onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <Modal onClose={onResume} label="Paused">
      <div className="popin panel w-full max-w-xs rounded-xl p-6 text-center">
        <div className="deco text-3xl gold-text">Paused</div>
        <div className="mt-5 space-y-2">
          <button type="button" onClick={onResume} className="btn btn-gold w-full py-2.5">Resume</button>
          <button type="button" onClick={onRestart} className="btn btn-dark w-full py-2.5">Restart</button>
          <button type="button" onClick={onMenu} className="btn btn-dark w-full py-2.5">Main menu</button>
        </div>
        <p className="mt-4 text-[11px] text-[var(--mist)]">Press P or Esc to resume</p>
      </div>
    </Modal>
  );
}

export function GameOverOverlay({
  g,
  last,
  scores,
  onRestart,
  onMenu,
  onShare,
  onRematch,
  rematchBusy,
  seriesLabel,
  newTitles,
  isHost,
  isSpectator,
  meId = 0,
}: {
  g: Game;
  last: HighScore | null;
  scores: HighScore[];
  onRestart: () => void;
  onMenu: () => void;
  onShare?: () => void;
  onRematch?: () => void;
  rematchBusy?: boolean;
  seriesLabel?: string | null;
  newTitles?: string[];
  isHost?: boolean;
  isSpectator?: boolean;
  meId?: number;
}) {
  const winner = g.winner !== null ? g.players[g.winner] : null;
  const won = last ? !!last.won : false;
  const bustedCount = g.players.filter((p) => p.bankrupt && p.id !== meId).length;
  const hist = summarizeGame(g);
  return (
    <Modal dim={0.85} label="Game over">
      <div className="popin panel scroll max-h-full w-full max-w-sm overflow-y-auto rounded-xl p-6 text-center">
        <div className={`deco text-3xl font-bold sm:text-4xl ${isSpectator ? 'gold-text' : won ? 'gold-text' : 'text-[#e07a88]'}`}>
          {isSpectator ? 'Match over' : won ? 'Victory' : 'Bankrupt'}
        </div>
        <p className="mt-2 text-[13px] text-[var(--mist)]">
          {isSpectator
            ? winner
              ? `${winner.name} rules Deco City.`
              : 'The match has ended.'
            : won
              ? 'You own Deco City.'
              : winner
                ? `${winner.name} rules Deco City.`
                : 'The bank wins.'}
        </p>
        {seriesLabel && (
          <p className="mt-2 text-[13px] font-semibold text-[var(--brass)]">Series · {seriesLabel}</p>
        )}
        {newTitles && newTitles.length > 0 && (
          <div className="mt-3 rounded-lg bg-[var(--brass)]/15 px-3 py-2 text-[12px] text-[var(--champagne)]">
            New title{newTitles.length > 1 ? 's' : ''}: {newTitles.join(', ')}
          </div>
        )}

        {last && (
          <div className="mt-5 rounded-lg bg-black/35 p-4">
            <div className="text-[12px] font-medium text-[var(--mist)]">Final score</div>
            <div className="deco mt-1 text-5xl font-bold tabular-nums text-emerald-300/95">{last.score.toLocaleString()}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--mist)]">
              <div>
                <div className="font-bold text-[var(--ivory)]">{money(last.worth)}</div>net worth
              </div>
              <div>
                <div className="font-bold text-[var(--ivory)]">{last.rounds}</div>rounds
              </div>
              <div>
                <div className="font-bold text-[var(--ivory)]">{bustedCount}</div>busted
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-1">
          {g.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
              <span aria-hidden>{p.token}</span>
              <span className="flex-1 truncate text-left" style={{ color: p.color }}>{p.name}</span>
              <span className={`tabular-nums ${p.bankrupt ? 'text-[#e07a88]' : 'text-emerald-300/90'}`}>
                {p.bankrupt ? 'Out' : money(netWorth(g, p.id))}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] text-[var(--mist)]">
          <div className="rounded-md bg-black/25 px-1 py-1.5">
            <div className="font-bold text-[var(--ivory)]">{hist.purchases}</div>buys
          </div>
          <div className="rounded-md bg-black/25 px-1 py-1.5">
            <div className="font-bold text-[var(--ivory)]">{hist.auctions}</div>auctions
          </div>
          <div className="rounded-md bg-black/25 px-1 py-1.5">
            <div className="font-bold text-[var(--ivory)]">{hist.trades}</div>trades
          </div>
          <div className="rounded-md bg-black/25 px-1 py-1.5">
            <div className="font-bold text-[var(--ivory)]">{hist.jailEvents}</div>jail
          </div>
        </div>

        {scores.length > 0 && (
          <div className="mt-5 border-t border-[var(--brass)]/15 pt-4">
            <div className="deco mb-2 text-[12px] text-[var(--brass)]">Hall of fame</div>
            <div className="space-y-1">
              {scores.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] ${
                    last && s.score === last.score && s.date === last.date ? 'bg-[var(--brass)]/20' : 'bg-black/25'
                  }`}
                >
                  <span className="w-4 font-bold text-[var(--brass)]">{i + 1}</span>
                  <span className="flex-1 truncate text-left">{s.name}</span>
                  {s.won && <span className="text-[10px] text-[var(--brass)]">won</span>}
                  <span className="font-bold tabular-nums text-emerald-300/90">{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {onShare && (
            <button type="button" onClick={onShare} className="btn btn-dark w-full py-2.5">
              Share result
            </button>
          )}
          {onRematch && isHost && (
            <button
              type="button"
              disabled={rematchBusy}
              onClick={onRematch}
              className="btn btn-gold w-full py-2.5"
            >
              {rematchBusy ? 'Starting rematch…' : 'Rematch (best of 3)'}
            </button>
          )}
          {onRematch && !isHost && (
            <p className="text-[12px] text-[var(--mist)]">Waiting for host to rematch…</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onRestart} className="btn btn-gold flex-1 py-2.5">
              {onRematch ? 'Leave' : 'Play again'}
            </button>
            <button type="button" onClick={onMenu} className="btn btn-dark flex-1 py-2.5">Menu</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
