import { useCallback, useEffect, useState } from 'react';
import Wordmark from './Wordmark';

const HOLD_MS = 1800;
const FADE_MS = 600;

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => setLeaving(true), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    const hold = window.setTimeout(dismiss, HOLD_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(hold);
    };
  }, [dismiss]);

  useEffect(() => {
    if (!leaving) return undefined;
    const fade = window.setTimeout(onComplete, FADE_MS);
    return () => window.clearTimeout(fade);
  }, [leaving, onComplete]);

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Skip intro"
      className={`fixed inset-0 z-[60] flex cursor-default items-center justify-center bg-[#0a0a0c] outline-none transition-opacity duration-[600ms] ease-out motion-reduce:transition-none ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`transition-all duration-[1200ms] ease-out motion-reduce:transition-none ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <Wordmark className="block animate-[pulse_2.4s_ease-in-out_infinite] text-7xl motion-reduce:animate-none sm:text-8xl" />
      </div>
    </button>
  );
}
