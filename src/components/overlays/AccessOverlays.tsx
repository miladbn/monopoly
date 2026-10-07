import type { BotReport } from '../../telegram/api';
import { Modal } from './Modal';

export function ChannelGate({
  welcome,
  comment,
  channels,
  checking,
  error,
  onRecheck,
  onOpen,
}: {
  welcome: string;
  comment: string;
  channels: { title: string; url: string }[];
  checking: boolean;
  error: string | null;
  onRecheck: () => void;
  onOpen: (url: string) => void;
}) {
  return (
    <Modal dim={0.92} z={80}>
      <div className="popin panel step-frame scroll relative max-h-full w-full max-w-md overflow-y-auto rounded-xl p-6">
        <div className="sunburst" aria-hidden />
        <div className="relative text-center">
          <h1 className="deco brand-in text-4xl font-bold leading-none gold-text">Deco City</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ivory)]/90">
            {welcome || 'Build an empire, trade deeds, and play with friends in Telegram.'}
          </p>
          {comment && (
            <p className="mt-2 text-[13px] text-[var(--champagne)]/80">{comment}</p>
          )}
        </div>
        <p className="relative mt-5 text-center text-[13px] font-medium text-[var(--mist)]">
          {channels.length === 0 && checking
            ? 'Checking channel membership…'
            : 'Join each channel below, then continue.'}
        </p>
        <div className="relative mt-3 space-y-2">
          {channels.map((ch) => (
            <button
              key={ch.url || ch.title}
              type="button"
              disabled={!ch.url || checking}
              onClick={() => ch.url && onOpen(ch.url)}
              className="btn btn-dark w-full py-3 text-sm"
            >
              Join {ch.title}
            </button>
          ))}
        </div>
        {error && (
          <div className="relative mt-3 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
        )}
        <button type="button" disabled={checking} onClick={onRecheck} className="btn btn-gold relative mt-4 w-full py-3">
          {checking ? 'Checking…' : "I've joined — continue"}
        </button>
      </div>
    </Modal>
  );
}

function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return new Date(at).toLocaleDateString();
}

export function BotReportOverlay({
  report,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  report: BotReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const counts = report?.counts;
  const tiles = [
    { label: 'Players', value: counts?.users },
    { label: 'Bot starts', value: counts?.starts },
    { label: 'App opens', value: counts?.opens },
    { label: 'Rooms', value: counts?.rooms },
    { label: 'Games', value: counts?.games },
  ];
  return (
    <Modal dim={0.92} z={70}>
      <div className="popin panel scroll max-h-full w-full max-w-md overflow-y-auto rounded-xl p-6">
        <div className="text-center">
          <h2 className="deco text-3xl font-bold leading-none gold-text">Bot report</h2>
          <p className="mt-1 text-[12px] text-[var(--mist)]">
            {report?.bot.username ? `@${report.bot.username}` : 'Deco City'}
          </p>
        </div>

        {loading && !report && (
          <p className="mt-6 text-center text-sm text-[var(--mist)]">Loading the report…</p>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
        )}

        {report && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-lg bg-black/30 px-3 py-2.5">
                  <div className="text-[12px] font-medium text-[var(--mist)]">{tile.label}</div>
                  <div className="text-xl font-extrabold tabular-nums text-[var(--champagne)]">
                    {(tile.value ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="rounded-lg bg-black/30 px-3 py-2.5">
                <div className="text-[12px] font-medium text-[var(--mist)]">Webhook</div>
                <div className="text-sm font-extrabold text-[var(--champagne)]">
                  {report.webhook.set ? 'Connected' : 'Not set'}
                </div>
                <div className="text-[11px] text-[var(--mist)]">{report.webhook.pending.toLocaleString()} pending</div>
              </div>
            </div>
            {report.webhook.lastError && (
              <p className="mt-2 text-[12px] text-[#f0b4bb]">Last webhook error: {report.webhook.lastError}</p>
            )}

            {report.channels.length > 0 && (
              <div className="mt-5">
                <div className="text-[12px] font-medium text-[var(--mist)]">Channels</div>
                <div className="mt-1.5 space-y-1">
                  {report.channels.map((ch) => (
                    <div key={ch.title} className="flex items-center justify-between rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                      <span>{ch.title}</span>
                      <span className="tabular-nums text-[var(--mist)]">
                        {ch.members === null ? '—' : `${ch.members.toLocaleString()} members`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="text-[12px] font-medium text-[var(--mist)]">Recent players</div>
              {report.recent.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-[var(--mist)]">No players recorded yet.</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {report.recent.map((row, i) => (
                    <div key={`${row.id}-${row.at}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                      <span className="min-w-0 truncate">
                        {row.name}
                        {row.username ? <span className="text-[var(--mist)]"> @{row.username}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--mist)]">
                        {row.event === 'start' ? 'start' : 'app'} · {ago(row.at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" disabled={loading} onClick={onRefresh} className="btn btn-dark flex-1 py-3 text-sm">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-gold flex-1 py-3">
            Play
          </button>
        </div>
      </div>
    </Modal>
  );
}
