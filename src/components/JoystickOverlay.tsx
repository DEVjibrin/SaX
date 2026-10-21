import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Bot, Gamepad2, type LucideIcon } from 'lucide-react';
import { ZERO_DRIVE } from '../lib/drive';
import type { ControlMode, DriveVector } from '../types/controller';

const KNOB_SIZE = 48;

const MODES: { id: ControlMode; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'auto', label: 'Autonomous Mode', short: 'Auto', icon: Bot },
  { id: 'manual', label: 'Manual Joystick Control Mode', short: 'Manual', icon: Gamepad2 },
];

const round2 = (value: number) => Math.round(value * 100) / 100 || 0;
const signed = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}`;

function Stick({ onDrive }: { onDrive: (drive: DriveVector) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [vector, setVector] = useState<DriveVector>(ZERO_DRIVE);
  const [dragging, setDragging] = useState(false);

  const publish = useCallback(
    (next: DriveVector) => {
      setVector((current) => (current.steering === next.steering && current.throttle === next.throttle ? current : next));
      onDrive(next);
    },
    [onDrive],
  );

  const release = useCallback(() => {
    pointer.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
    publish(ZERO_DRIVE);
  }, [publish]);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const element = base.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const max = rect.width / 2 - KNOB_SIZE / 2;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      dx = (dx / distance) * max;
      dy = (dy / distance) * max;
    }
    setOffset({ x: dx, y: dy });
    publish({ steering: round2(dx / max), throttle: round2(-dy / max) });
  };

  useEffect(() => {
    const stop = () => {
      if (pointer.current !== null) release();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [release]);

  const ends = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current === event.pointerId) release();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={base}
        role="group"
        aria-label="Drive joystick"
        onPointerDown={(event) => {
          if (pointer.current !== null) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          move(event);
        }}
        onPointerMove={(event) => {
          if (pointer.current === event.pointerId) move(event);
        }}
        onPointerUp={ends}
        onPointerCancel={ends}
        onLostPointerCapture={ends}
        onContextMenu={(event) => event.preventDefault()}
        className="pointer-events-auto relative h-28 w-28 touch-none select-none rounded-full border border-white/15 bg-black/40 backdrop-blur sm:h-36 sm:w-36"
      >
        <div
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
          className={`absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/90 shadow-lg shadow-black/40 ${
            dragging ? '' : 'transition-transform duration-150 motion-reduce:transition-none'
          }`}
        />
      </div>
      <p className="font-mono text-[11px] tabular-nums text-white/60" aria-hidden="true">
        S {signed(vector.steering)} T {signed(vector.throttle)}
      </p>
    </div>
  );
}

interface JoystickOverlayProps {
  mode: ControlMode;
  autoBlockedReason: string | null;
  onModeChange: (mode: ControlMode) => void;
  onDrive: (drive: DriveVector) => void;
}

export default function JoystickOverlay({ mode, autoBlockedReason, onModeChange, onDrive }: JoystickOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
      <div role="radiogroup" aria-label="Control mode" className="pointer-events-auto flex rounded-full bg-black/40 p-1 backdrop-blur">
        {MODES.map(({ id, label, short, icon: Icon }) => {
          const blocked = id === 'auto' && autoBlockedReason !== null;
          const active = id === mode;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={blocked ? (autoBlockedReason ?? undefined) : label}
              disabled={blocked}
              onClick={() => onModeChange(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'bg-white text-[#0a0a0c]' : 'text-white/70 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {short}
            </button>
          );
        })}
      </div>
      {mode === 'manual' && <Stick onDrive={onDrive} />}
    </div>
  );
}