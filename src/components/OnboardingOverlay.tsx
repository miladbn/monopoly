import { settings } from '../game/settings';
import { Modal } from './Overlays';

export default function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const finish = () => {
    settings.setOnboarded();
    onDone();
  };
  return (
    <Modal dim={0.9} z={90}>
      <div className="popin panel w-full max-w-sm rounded-xl p-5">
        <h2 className="deco text-center text-2xl gold-text">How to play</h2>
        <ol className="mt-4 space-y-3 text-[13px] leading-relaxed text-[var(--ivory)]">
          <li>
            <span className="font-bold text-[var(--brass)]">1.</span> Roll the dice and move around the board.
          </li>
          <li>
            <span className="font-bold text-[var(--brass)]">2.</span> Buy properties — or send them to auction.
          </li>
          <li>
            <span className="font-bold text-[var(--brass)]">3.</span> Complete colour sets, build houses, charge rent.
          </li>
          <li>
            <span className="font-bold text-[var(--brass)]">4.</span> Bankrupt every rival to win Deco City.
          </li>
        </ol>
        <p className="mt-4 text-center text-[12px] text-[var(--mist)]">
          On mobile, use Feed / Deeds under the Roll button when you need them.
        </p>
        <button type="button" className="btn btn-gold mt-5 w-full py-3" onClick={finish}>
          Got it — play
        </button>
      </div>
    </Modal>
  );
}
