import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import CameraFeed from './CameraFeed';
import JoystickOverlay from './JoystickOverlay';
import LowPowerHud from './LowPowerHud';
import PairRemotePanel from './PairRemotePanel';
import SerialController from './SerialController';
import TelemetryConsole from './TelemetryConsole';
import { useCameraStream } from '../hooks/useCameraStream';
import { useBattery, useWakeLock } from '../hooks/useDeviceStatus';
import { useRobotLink } from '../hooks/useRobotLink';
import { NO_SENSORS } from '../hooks/useSensorMapper';
import { useWebSerial } from '../hooks/useWebSerial';
import { ZERO_DRIVE } from '../lib/drive';
import { NEUTRAL_TELEMETRY } from '../lib/packet';
import { MACHINES, type Project } from '../types';
import type { ControlMode, DriveVector, ImuReading, Telemetry } from '../types/controller';

const LEVEL: ImuReading = { pitch: 0, roll: 0 };

const round1 = (value: number) => Math.round(value * 10) / 10 || 0;

interface RobotNodeViewProps {
  project: Project;
  onBack: () => void;
}

export default function RobotNodeView({ project, onBack }: RobotNodeViewProps) {
  const machine = MACHINES[project.machineType];
  const Icon = machine.icon;
  const tiltEnabled = (project.integration?.sensors ?? NO_SENSORS).imu;

  const camera = useCameraStream();
  const battery = useBattery();
  useWakeLock(true);

  const [mode, setMode] = useState<ControlMode>('manual');
  const modeRef = useRef<ControlMode>('manual');
  const driveRef = useRef<DriveVector>(ZERO_DRIVE);
  const imuRef = useRef<ImuReading>(LEVEL);
  const pairedRef = useRef(false);
  const remoteTelemetryRef = useRef<() => Telemetry>(() => NEUTRAL_TELEMETRY);

  const telemetry = useCallback(
    (): Telemetry =>
      pairedRef.current
        ? remoteTelemetryRef.current()
        : { mode: modeRef.current, drive: driveRef.current, sensors: imuRef.current },
    [],
  );

  const { isSupported, status, error, logs, connect, disconnect, send, clearLogs, log, packet } = useWebSerial({
    telemetry,
  });

  const hello = useMemo(
    () => ({ name: project.name, badge: machine.badge, tilt: tiltEnabled }),
    [project.name, machine.badge, tiltEnabled],
  );
  const link = useRobotLink({ stream: camera.stream, hello, serial: status, battery: battery.level });
  const paired = link.status === 'paired';

  useEffect(() => {
    remoteTelemetryRef.current = link.getTelemetry;
    pairedRef.current = paired;
  }, [link.getTelemetry, paired]);

  useEffect(() => {
    if (!tiltEnabled || paired) return undefined;
    const onOrientation = (event: DeviceOrientationEvent) => {
      imuRef.current = { pitch: round1(event.beta ?? 0), roll: round1(event.gamma ?? 0) };
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      imuRef.current = LEVEL;
    };
  }, [tiltEnabled, paired]);

  const changeMode = useCallback(
    (next: ControlMode) => {
      driveRef.current = ZERO_DRIVE;
      modeRef.current = next;
      setMode(next);
      log('sys', next === 'auto' ? 'Autonomous mode on. Your firmware is in control.' : 'Manual mode on.');
    },
    [log],
  );

  useEffect(() => {
    if (paired) driveRef.current = ZERO_DRIVE;
    if ((status !== 'connected' || paired) && modeRef.current !== 'manual') changeMode('manual');
  }, [status, paired, changeMode]);

  useEffect(() => {
    if (paired) log('sys', 'Remote paired. Drive input now comes from the remote.');
    else if (link.status === 'waiting') log('sys', 'Waiting for a remote.');
  }, [paired, link.status, log]);

  const handleDrive = useCallback((drive: DriveVector) => {
    driveRef.current = drive;
  }, []);

  const serialControl = (
    <SerialController status={status} isSupported={isSupported} onConnect={connect} onDisconnect={disconnect} />
  );

  if (paired) {
    return (
      <LowPowerHud
        name={project.name}
        badge={machine.badge}
        serialStatus={status}
        remoteAlive={link.remoteAlive}
        stats={link.stats}
        battery={battery}
        serialControl={serialControl}
        onUnpair={link.unpair}
      />
    );
  }

  const autoBlockedReason = status === 'connected' ? null : 'Connect a device to use Autonomous mode.';

  const notice = !isSupported
    ? {
        text: "Web Serial isn't available in this browser. Open SaX in Chrome or Edge to connect hardware.",
        tone: 'border-amber-400/20 bg-amber-400/5 text-amber-200',
      }
    : status === 'error' && error
      ? { text: error, tone: 'border-red-400/20 bg-red-400/5 text-red-200' }
      : null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to projects"
              className="-ml-2 inline-flex shrink-0 items-center gap-1 rounded-full p-2 text-sm text-white/60 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 sm:pr-3"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden sm:inline">Projects</span>
            </button>
            <div className="h-5 w-px shrink-0 bg-white/10" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/80">
                <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-white">{project.name}</p>
                <p className="truncate text-xs text-white/40">{machine.badge}</p>
              </div>
            </div>
          </div>
          {serialControl}
        </div>
      </header>

      {notice && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <div role="alert" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.tone}`}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <p>{notice.text}</p>
          </div>
        </div>
      )}

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1">
        <CameraFeed
          stream={camera.stream}
          status={camera.status}
          message={camera.message}
          onSwitch={camera.switchCamera}
          onRetry={camera.retry}
        >
          <JoystickOverlay mode={mode} autoBlockedReason={autoBlockedReason} onModeChange={changeMode} onDrive={handleDrive} />
        </CameraFeed>
        <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
          <PairRemotePanel pairUrl={link.pairUrl} status={link.status} error={link.error} onNewCode={link.unpair} />
          <TelemetryConsole
            logs={logs}
            canSend={status === 'connected'}
            streaming={status === 'connected'}
            readStream={packet}
            onSend={send}
            onClear={clearLogs}
          />
        </div>
      </main>
    </div>
  );
}
