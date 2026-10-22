import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Battery,
  Gauge,
  Maximize,
  Minimize,
  OctagonX,
  Smartphone,
  Terminal,
  Trash2,
  Usb,
  X,
  type LucideIcon,
} from 'lucide-react';
import CameraFeed from './CameraFeed';
import JoystickOverlay from './JoystickOverlay';
import { useWakeLock } from '../hooks/useDeviceStatus';
import { useRemoteLink } from '../hooks/useRemoteLink';
import { ZERO_DRIVE } from '../lib/drive';
import { NEUTRAL_TELEMETRY } from '../lib/packet';
import type { ControlMode, DriveVector, ImuReading, Telemetry } from '../types/controller';
import type { FeedStatus } from '../types/link';

const SEND_MS = 50;
const TX_SAMPLE_MS = 1000;
const MAX_ENTRIES = 80;
const LEVEL: ImuReading = { pitch: 0, roll: 0 };

type DebugDirection = 'tx' | 'rx' | 'sys';
type Health = 'ok' | 'weak' | 'lost';

interface DebugEntry {
  id: number;
  at: number;
  direction: DebugDirection;
  text: string;
}

const DIRECTION: Record<DebugDirection, { tag: string; tone: string }> = {
  tx: { tag: 'TX', tone: 'text-sky-300/70' },
  rx: { tag: 'RX', tone: 'text-emerald-300/80' },
  sys: { tag: 'SYS', tone: 'text-amber-300/70' },
};

const HEALTH: Record<Health, { label: string; text: string; dot: string }> = {
  ok: { label: 'Link OK', text: 'text-white', dot: 'bg-emerald-400' },
  weak: { label: 'Weak link', text: 'text-amber-300', dot: 'bg-amber-400' },
  lost: { label: 'No signal', text: 'text-red-400', dot: 'bg-red-500' },
};

const round1 = (value: number) => Math.round(value * 10) / 10 || 0;

const iconButton =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/60 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 aria-pressed:bg-white/10 aria-pressed:text-white';

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

const orientationApi: OrientationPermission | null =
  typeof DeviceOrientationEvent === 'undefined' ? null : (DeviceOrientationEvent as unknown as OrientationPermission);

function HealthBadge({ connected, lastRx, beat }: { connected: boolean; lastRx: number | null; beat: number }) {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const age = lastRx === null ? null : Math.max(0, now - lastRx) / 1000;
  let health: Health = 'lost';
  if (connected) health = age === null ? 'weak' : age < 3.5 ? 'ok' : age < 7 ? 'weak' : 'lost';
  const { label, text, dot } = HEALTH[health];

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="relative flex h-2.5 w-2.5">
        {health === 'ok' && (
          <span
            key={beat}
            aria-hidden="true"
            className="absolute inset-0 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_1] rounded-full bg-emerald-400/70 motion-reduce:animate-none"
          />
        )}
        <span className={`relative h-2.5 w-2.5 rounded-full ${dot}`} />
      </span>
      <Activity className="hidden h-3.5 w-3.5 text-white/40 sm:block" strokeWidth={1.5} aria-hidden="true" />
      <span className={`font-medium ${text}`}>{label}</span>
      {connected && age !== null && (
        <span aria-hidden="true" className="tabular-nums text-white/40">
          {age.toFixed(1)} s
        </span>
      )}
    </span>
  );
}

function Stat({ icon: Icon, label, value, tone = 'text-white' }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums" title={label}>
      <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only md:not-sr-only md:text-white/40">{label}</span>
      <span className={tone}>{value}</span>
    </span>
  );
}

function LiveLine({ direction, read }: { direction: DebugDirection; read: () => string }) {
  const [line, setLine] = useState('');
  const { tag, tone } = DIRECTION[direction];

  useEffect(() => {
    setLine(read());
    const timer = window.setInterval(() => setLine(read()), 100);
    return () => window.clearInterval(timer);
  }, [read]);

  return (
    <div className="flex min-h-14 gap-3 border-b border-white/5 px-3 py-2 font-mono text-[11px] leading-relaxed">
      <span className={`w-5 shrink-0 ${tone}`}>{tag}</span>
      <span className="line-clamp-3 min-w-0 break-all text-white/70">{line}</span>
    </div>
  );
}

interface DebugDrawerProps {
  entries: DebugEntry[];
  readTx: () => string;
  readRx: () => string;
  onClear: () => void;
  onClose: () => void;
}

function DebugDrawer({ entries, readTx, readRx, onClear, onClose }: DebugDrawerProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const element = viewport.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [entries]);

  return (
    <aside
      aria-label="Debug console"
      className="flex h-[34dvh] max-h-72 min-h-36 shrink-0 flex-col border-t border-white/10 bg-[#0a0a0c] sm:h-auto sm:max-h-none sm:min-h-0 sm:w-80 sm:border-l sm:border-t-0 lg:w-96"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <h2 className="text-sm font-medium text-white">Debug</h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Clear debug log" onClick={onClear} className={iconButton}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button type="button" aria-label="Close debug console" onClick={onClose} className={iconButton}>
            <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>
      <LiveLine direction="tx" read={readTx} />
      <LiveLine direction="rx" read={readRx} />
      <p className="px-3 pt-2 text-[10px] text-white/30">Control packets go out 20 times a second. The log below samples them once a second.</p>
      <div
        ref={viewport}
        role="log"
        aria-live="off"
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
          stick.current = scrollHeight - scrollTop - clientHeight < 32;
        }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {entries.length === 0 ? (
          <p className="text-white/30">No packets yet.</p>
        ) : (
          entries.map((entry) => {
            const { tag, tone } = DIRECTION[entry.direction];
            return (
              <div key={entry.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-white/30">{new Date(entry.at).toTimeString().slice(0, 8)}</span>
                <span className={`w-6 shrink-0 ${tone}`}>{tag}</span>
                <span className="min-w-0 break-all text-white/80">{entry.text}</span>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default function RemoteView({ session }: { session: string | null }) {
  const { status, error, stream, hello, robot, stats, send, reconnect } = useRemoteLink(session);
  useWakeLock(true);

  const [mode, setMode] = useState<ControlMode>('manual');
  const [estop, setEstop] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [lastRx, setLastRx] = useState<number | null>(null);
  const [beat, setBeat] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const modeRef = useRef<ControlMode>('manual');
  const driveRef = useRef<DriveVector>(ZERO_DRIVE);
  const imuRef = useRef<ImuReading>(LEVEL);
  const estopRef = useRef(false);
  const rxRef = useRef('');
  const entryId = useRef(0);
  const initialRobot = useRef(robot);

  const needsPermission = typeof orientationApi?.requestPermission === 'function';
  const [tiltReady, setTiltReady] = useState(!needsPermission);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  const connected = status === 'connected';
  const tilt = hello?.tilt ?? false;
  const usbReady = robot.serial === 'connected';

  const pushLog = useCallback((direction: DebugDirection, text: string) => {
    setEntries((current) => [...current.slice(-(MAX_ENTRIES - 1)), { id: ++entryId.current, at: Date.now(), direction, text }]);
  }, []);

  const readTelemetry = useCallback(
    (): Telemetry =>
      estopRef.current ? NEUTRAL_TELEMETRY : { mode: modeRef.current, drive: driveRef.current, sensors: imuRef.current },
    [],
  );
  const readTx = useCallback(() => JSON.stringify(readTelemetry()), [readTelemetry]);
  const readRx = useCallback(() => rxRef.current || '—', []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehavior;
    root.style.overscrollBehavior = 'none';
    return () => {
      root.style.overscrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!tilt || !tiltReady) return undefined;
    const onOrientation = (event: DeviceOrientationEvent) => {
      imuRef.current = { pitch: round1(event.beta ?? 0), roll: round1(event.gamma ?? 0) };
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      imuRef.current = LEVEL;
    };
  }, [tilt, tiltReady]);

  useEffect(() => {
    if (!connected) return undefined;
    const sendTimer = window.setInterval(() => send(readTelemetry()), SEND_MS);
    const sampleTimer = window.setInterval(() => pushLog('tx', JSON.stringify(readTelemetry())), TX_SAMPLE_MS);
    return () => {
      window.clearInterval(sendTimer);
      window.clearInterval(sampleTimer);
    };
  }, [connected, send, readTelemetry, pushLog]);

  useEffect(() => {
    pushLog('sys', `Link ${status}.`);
    if (status === 'connecting') setLastRx(null);
  }, [status, pushLog]);

  useEffect(() => {
    if (!hello) return;
    const text = JSON.stringify({ type: 'hello', ...hello });
    rxRef.current = text;
    pushLog('rx', text);
    setLastRx(performance.now());
  }, [hello, pushLog]);

  useEffect(() => {
    if (robot === initialRobot.current) return;
    const text = JSON.stringify({ type: 'state', serial: robot.serial, battery: robot.battery });
    rxRef.current = text;
    pushLog('rx', text);
    setLastRx(performance.now());
    setBeat((count) => count + 1);
  }, [robot, pushLog]);

  const changeMode = useCallback(
    (next: ControlMode) => {
      driveRef.current = ZERO_DRIVE;
      modeRef.current = next;
      setMode(next);
      pushLog('sys', next === 'auto' ? 'Autonomous mode requested.' : 'Manual mode.');
    },
    [pushLog],
  );

  useEffect(() => {
    if (!connected && modeRef.current !== 'manual') changeMode('manual');
  }, [connected, changeMode]);

  const handleDrive = useCallback((drive: DriveVector) => {
    if (!estopRef.current) driveRef.current = drive;
  }, []);

  const triggerEstop = useCallback(() => {
    if (estopRef.current) return;
    estopRef.current = true;
    driveRef.current = ZERO_DRIVE;
    modeRef.current = 'manual';
    setEstop(true);
    setMode('manual');
    for (let burst = 0; burst < 3; burst += 1) send(NEUTRAL_TELEMETRY);
    pushLog('sys', 'Emergency stop. Drive zeroed and manual mode forced.');
    pushLog('tx', JSON.stringify(NEUTRAL_TELEMETRY));
  }, [send, pushLog]);

  const releaseEstop = useCallback(() => {
    estopRef.current = false;
    setEstop(false);
    pushLog('sys', 'Emergency stop released.');
  }, [pushLog]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'Escape') {
        triggerEstop();
        return;
      }
      const target = event.target instanceof Element ? event.target.closest('button, input, textarea, [role="radio"]') : null;
      if (event.code === 'Space' && !target) {
        event.preventDefault();
        triggerEstop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerEstop]);

  const enableTilt = async () => {
    const result = await orientationApi?.requestPermission?.();
    setTiltReady(result === 'granted');
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const autoBlockedReason = !connected
    ? 'Connecting to the robot.'
    : !usbReady
      ? "The robot's USB link is not connected."
      : null;
  const feedStatus: FeedStatus = stream ? 'live' : status === 'closed' || status === 'error' ? 'error' : 'starting';

  const rttTone =
    stats.rttMs === null ? 'text-white/40' : stats.rttMs < 150 ? 'text-white' : stats.rttMs < 300 ? 'text-amber-300' : 'text-red-400';
  const batteryTone =
    robot.battery === null ? 'text-white/40' : robot.battery < 0.2 ? 'text-red-400' : robot.battery < 0.4 ? 'text-amber-300' : 'text-white';

  return (
    <div className="flex h-dvh touch-manipulation select-none flex-col overflow-hidden bg-[#0a0a0c] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] font-sans tracking-tight text-white antialiased">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-white/10 px-3 py-2 sm:px-4">
        <HealthBadge connected={connected} lastRx={lastRx} beat={beat} />
        <Stat icon={Gauge} label="Latency" value={stats.rttMs === null ? '—' : `${stats.rttMs} ms`} tone={rttTone} />
        <Stat
          icon={Usb}
          label="Robot USB"
          value={connected ? (usbReady ? 'Connected' : 'Offline') : '—'}
          tone={connected && !usbReady ? 'text-amber-300' : 'text-white'}
        />
        <Stat
          icon={Battery}
          label="Robot battery"
          value={robot.battery === null ? '—' : `${Math.round(robot.battery * 100)}%`}
          tone={batteryTone}
        />
        {hello && <span className="hidden max-w-48 truncate text-xs text-white/40 lg:inline">{hello.name}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-pressed={debugOpen}
            aria-label="Toggle debug console"
            onClick={() => setDebugOpen((open) => !open)}
            className={iconButton}
          >
            <Terminal className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">Debug</span>
          </button>
          {canFullscreen && (
            <button
              type="button"
              aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
              onClick={toggleFullscreen}
              className={iconButton}
            >
              {fullscreen ? (
                <Minimize className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Maximize className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 bg-black">
          <div className="absolute inset-0">
            <CameraFeed
              fill
              stream={stream}
              status={feedStatus}
              message={error ?? 'The connection to the robot closed.'}
              waitingText={connected ? 'Waiting for video…' : 'Connecting to the robot…'}
              onRetry={reconnect}
            >
              {tilt && !tiltReady && (
                <button
                  type="button"
                  onClick={enableTilt}
                  className="absolute left-1/2 top-3 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#0a0a0c] outline-hidden focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Enable tilt
                </button>
              )}

              <button
                type="button"
                onClick={triggerEstop}
                aria-pressed={estop}
                aria-label="Emergency stop"
                title="Emergency stop (Esc or Space)"
                className={`absolute left-3 top-1/2 z-20 flex h-16 w-16 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-[10px] font-bold tracking-wide shadow-lg outline-hidden transition-transform focus-visible:ring-4 focus-visible:ring-white/60 active:scale-95 sm:h-20 sm:w-20 sm:text-xs ${
                  estop
                    ? 'border-red-300/50 bg-red-950 text-red-200 shadow-red-950/60'
                    : 'border-red-300/40 bg-red-600 text-white shadow-red-900/60 hover:bg-red-500'
                }`}
              >
                <OctagonX className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} aria-hidden="true" />
                {estop ? 'STOPPED' : 'STOP'}
              </button>

              {estop && (
                <div
                  role="alert"
                  className="absolute inset-x-3 top-14 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-950/90 px-4 py-3 text-sm text-red-100 backdrop-blur"
                >
                  <p>Emergency stop active. Drive is disabled.</p>
                  <button
                    type="button"
                    onClick={releaseEstop}
                    className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#0a0a0c] outline-hidden focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    Release
                  </button>
                </div>
              )}

              {!estop && (
                <JoystickOverlay mode={mode} autoBlockedReason={autoBlockedReason} onModeChange={changeMode} onDrive={handleDrive} />
              )}
            </CameraFeed>
          </div>
        </div>

        {debugOpen && (
          <DebugDrawer
            entries={entries}
            readTx={readTx}
            readRx={readRx}
            onClear={() => setEntries([])}
            onClose={() => setDebugOpen(false)}
          />
        )}
      </div>
    </div>
  );
}