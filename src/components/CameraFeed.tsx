import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, SwitchCamera, VideoOff } from 'lucide-react';
import type { CameraFacing } from '../types/controller';

type CameraStatus = 'starting' | 'live' | 'error';

const STATUS: Record<CameraStatus, { label: string; dot: string }> = {
  starting: { label: 'Starting', dot: 'animate-pulse bg-amber-400' },
  live: { label: 'Live', dot: 'bg-emerald-400' },
  error: { label: 'Error', dot: 'bg-red-400' },
};

function describeError(error: unknown): string {
  if (!navigator.mediaDevices?.getUserMedia) return 'Camera access needs a secure (HTTPS) connection.';
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera permission was denied. Allow access in your browser settings.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No matching camera was found on this device.';
    if (error.name === 'NotReadableError') return 'The camera is in use by another app.';
  }
  return 'The camera could not be started.';
}

interface CameraFeedProps {
  stream?: MediaStream | null;
  status?: string;
  message?: string;
  waitingText?: string;
  onRetry?: () => void;
  onSwitch?: () => void;
  fill?: boolean;
  children?: ReactNode;
}

export default function CameraFeed({ children }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        const video = videoRef.current;
        if (cancelled || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const settings = stream.getVideoTracks()[0].getSettings();
        setSize({ width: settings.width ?? video.videoWidth, height: settings.height ?? video.videoHeight });
        setFps(Math.round(settings.frameRate ?? 0));
        setStatus('live');
      } catch (error) {
        if (cancelled) return;
        setMessage(describeError(error));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (status !== 'live' || !video || typeof video.requestVideoFrameCallback !== 'function') return undefined;
    let frames = 0;
    let windowStart = performance.now();
    let handle = 0;
    const onFrame = (now: DOMHighResTimeStamp) => {
      frames += 1;
      if (now - windowStart >= 1000) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => video.cancelVideoFrameCallback(handle);
  }, [status]);

  const switchCamera = () => {
    setStatus('starting');
    setFacing((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const retry = () => {
    setStatus('starting');
    setAttempt((current) => current + 1);
  };

  const live = status === 'live';
  const { label, dot } = STATUS[status];

  return (
    <section
      aria-label="Camera feed"
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black lg:aspect-auto"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-contain transition-opacity duration-500 motion-reduce:transition-none ${
          live ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="absolute left-3 top-3 flex items-center gap-3 rounded-full bg-black/40 px-3 py-1.5 font-mono text-[11px] tabular-nums text-white/80 backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
          {label}
        </span>
        <span>{live ? `${size.width}×${size.height}` : '—'}</span>
        <span>{live ? `${fps} FPS` : '—'}</span>
      </div>

      <button
        type="button"
        aria-label={`Switch to ${facing === 'user' ? 'rear' : 'front'} camera`}
        disabled={status === 'starting'}
        onClick={switchCamera}
        className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white/80 outline-hidden backdrop-blur transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40"
      >
        <SwitchCamera className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>

      {status === 'starting' && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-white/40">Starting camera…</p>
      )}

      {status === 'error' && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <VideoOff className="h-6 w-6 text-white/40" strokeWidth={1.25} aria-hidden="true" />
          <p className="max-w-xs text-sm text-white/60">{message}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white outline-hidden transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {children}
    </section>
  );
}