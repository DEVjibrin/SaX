import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import CameraFeed from './CameraFeed';
import JoystickOverlay from './JoystickOverlay';
import { useWakeLock } from '../hooks/useDeviceStatus';
import { useRemoteLink } from '../hooks/useRemoteLink';
import { ZERO_DRIVE } from '../lib/drive';
import type { ControlMode, DriveVector, ImuReading } from '../types/controller';
import type { FeedStatus } from '../types/link';

const SEND_MS = 50;
const LEVEL: ImuReading = { pitch: 0, roll: 0 };
const chipClass = 'rounded-full bg-black/40 px-3 py-1 backdrop-blur';

const round1 = (value: number) => Math.round(value * 10) / 10 || 0;

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

const orientationApi: OrientationPermission | null =
  typeof DeviceOrientationEvent === 'undefined' ? null : (DeviceOrientationEvent as unknown as OrientationPermission);

export default function RemoteView({ session }: { session: string | null }) {
  const { status, error, stream, hello, robot, stats, send, reconnect } = useRemoteLink(session);
  useWakeLock(true);

  const [mode, setMode] = useState<ControlMode>('manual');
  const modeRef = useRef<ControlMode>('manual');
  const driveRef = useRef<DriveVector>(ZERO_DRIVE);
  const imuRef = useRef<ImuReading>(LEVEL);
  const needsPermission = typeof orientationApi?.requestPermission === 'function';
  const [tiltReady, setTiltReady] = useState(!needsPermission);

  const connected = status === 'connected';
  const tilt = hello?.tilt ?? false;

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
    const timer = window.setInterval(
      () => send({ mode: modeRef.current, drive: driveRef.current, sensors: imuRef.current }),
      SEND_MS,
    );
    return () => window.clearInterval(timer);
  }, [connected, send]);

  const changeMode = useCallback((next: ControlMode) => {
    driveRef.current = ZERO_DRIVE;
    modeRef.current = next;
    setMode(next);
  }, []);

  useEffect(() => {
    if (!connected && modeRef.current !== 'manual') changeMode('manual');
  }, [connected, changeMode]);

  const handleDrive = useCallback((drive: DriveVector) => {
    driveRef.current = drive;
  }, []);

  const enableTilt = async () => {
    const result = await orientationApi?.requestPermission?.();
    setTiltReady(result === 'granted');
  };

  const usbReady = robot.serial === 'connected';
  const autoBlockedReason = !connected
    ? 'Connecting to the robot.'
    : !usbReady
      ? "The robot's USB link is not connected."
      : null;
  const feedStatus: FeedStatus = stream ? 'live' : status === 'closed' || status === 'error' ? 'error' : 'starting';

  return (
    <div className="fixed inset-0 overscroll-none bg-black font-sans tracking-tight text-white antialiased">
      <CameraFeed
        fill
        stream={stream}
        status={feedStatus}
        message={error ?? 'The connection to the robot closed.'}
        waitingText={connected ? 'Waiting for video…' : 'Connecting to the robot…'}
        onRetry={reconnect}
      >
        <div className="pointer-events-none absolute right-3 top-3 flex max-w-[60%] flex-wrap justify-end gap-2 font-mono text-[11px] tabular-nums text-white/80">
          {hello && <span className={chipClass}>{hello.name}</span>}
          {connected && <span className={chipClass}>{usbReady ? 'USB connected' : 'USB not connected'}</span>}
          {stats.rttMs !== null && <span className={chipClass}>{stats.rttMs} ms</span>}
          {robot.battery !== null && <span className={chipClass}>Robot {Math.round(robot.battery * 100)}%</span>}
        </div>

        {tilt && !tiltReady && (
          <button
            type="button"
            onClick={enableTilt}
            className="absolute left-1/2 top-3 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#0a0a0c] outline-hidden focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Enable tilt
          </button>
        )}

        <JoystickOverlay mode={mode} autoBlockedReason={autoBlockedReason} onModeChange={changeMode} onDrive={handleDrive} />
      </CameraFeed>
    </div>
  );
}
