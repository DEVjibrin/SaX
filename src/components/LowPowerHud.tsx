import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EyeOff, Moon, Sun, Unlink, type LucideIcon } from 'lucide-react';
import type { BatteryState } from '../hooks/useDeviceStatus';
import type { SerialStatus } from '../types/controller';
import type { LinkStats } from '../types/link';

type Stealth = 'off' | 'dim' | 'black';

const STEALTH: { id: Stealth; label: string; icon: LucideIcon }[] = [
  { id: 'off', label: 'Normal', icon: Sun },
  { id: 'dim', label: 'Dim', icon: Moon },
  { id: 'black', label: 'Blackout', icon: EyeOff },
];

const SERIAL: Record<SerialStatus, { label: string; dot: string }> = {
  disconnected: { label: 'Disconnected', dot: 'bg-white/30' },
  connecting: { label: 'Connecting', dot: 'animate-pulse bg-amber-400' },
  connected: { label: 'Connected', dot: 'bg-emerald-400' },
  error: { label: 'Error', dot: 'bg-red-400' },
};

const DOUBLE_TAP_MS = 400;

function Tile({ label, value, detail, dot }: { label: string; value: string; detail: string; dot?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-3 flex items-center gap-2 text-2xl font-semibold tabular-nums text-white">
        {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
        {value}
      </p>
      <p className="mt-1 text-xs tabular-nums text-white/40">{detail}</p>
    </div>
  );
}

interface LowPowerHudProps {
  name: string;
  badge: string;
  serialStatus: SerialStatus;
  remoteAlive: boolean;
  stats: LinkStats;
  battery: BatteryState;
  serialControl: ReactNode;
  onUnpair: () => void;
}

export default function LowPowerHud({
  name,
  badge,
  serialStatus,
  remoteAlive,
  stats,
  battery,
  serialControl,
  onUnpair,
}: LowPowerHudProps) {
  const [stealth, setStealth] = useState<Stealth>('off');
  const [hint, setHint] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    if (stealth !== 'black') return undefined;
    setHint(true);
    const timer = window.setTimeout(() => setHint(false), 3000);
    return () => window.clearTimeout(timer);
  }, [stealth]);

  const wake = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) setStealth('off');
    lastTap.current = now;
  };

  const serial = SERIAL[serialStatus];
  const percent = battery.level === null ? null : Math.round(battery.level * 100);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black text-white">
      <div
        className={`mx-auto flex min-h-full max-w-3xl flex-col px-5 py-5 transition-opacity duration-500 motion-reduce:transition-none ${
          stealth === 'dim' ? 'opacity-30' : 'opacity-100'
        }`}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-white/40">{badge}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {serialControl}
            <button
              type="button"
              onClick={onUnpair}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white outline-hidden transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Unlink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Unpair
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-6 py-10">
          <div className="grid grid-cols-2 gap-3">
            <Tile
              label="Remote"
              value={remoteAlive ? 'Receiving' : 'Signal lost'}
              detail={stats.rttMs === null ? 'Measuring delay' : `${stats.rttMs} ms round trip`}
              dot={remoteAlive ? 'bg-emerald-400' : 'bg-red-400'}
            />
            <Tile label="USB serial" value={serial.label} detail="Streaming to the board" dot={serial.dot} />
            <Tile
              label="Video"
              value={`${stats.fps} FPS`}
              detail={stats.width > 0 ? `${stats.width}×${stats.height}` : 'Waiting for video'}
            />
            <Tile
              label="Battery"
              value={percent === null ? 'Unavailable' : `${percent}%`}
              detail={
                battery.charging === null ? 'Not reported by this browser' : battery.charging ? 'Charging' : 'On battery'
              }
            />
          </div>

          <div role="radiogroup" aria-label="Display" className="mx-auto flex rounded-full border border-white/10 p-1">
            {STEALTH.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={stealth === id}
                onClick={() => setStealth(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                  stealth === id ? 'bg-white text-[#0a0a0c]' : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </main>
      </div>

      {stealth === 'black' && (
        <button
          type="button"
          aria-label="Display is blacked out. Double-tap to wake."
          onPointerUp={wake}
          className="fixed inset-0 z-50 flex cursor-default items-end justify-center bg-black pb-10 outline-hidden"
        >
          <span
            className={`text-xs text-white/30 transition-opacity duration-700 motion-reduce:transition-none ${
              hint ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Double-tap to wake
          </span>
        </button>
      )}
    </div>
  );
}
