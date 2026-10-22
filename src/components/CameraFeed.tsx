import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, SwitchCamera, VideoOff } from 'lucide-react';
import type { CameraFacing } from '../types/controller';
import type { FeedStatus } from '../types/link';

const STATUS: Record<string, { label: string; dot: string }> = {
  starting: { label: 'Starting', dot: 'animate-pulse bg-amber-400' },
  live: { label: 'Live', dot: 'bg-emerald-400' },
  error: { label: 'Error', dot: 'bg-red-400' },
  closed: { label: 'Closed', dot: 'bg-zinc-400' },
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
  status?: FeedStatus;
  message?: string;
  waitingText?: string;
  onRetry?: () => void;
  onSwitch?: () => void;
  fill?: boolean;
  children?: ReactNode;
}

export default function CameraFeed({
  stream: externalStream,
  status: externalStatus = 'starting',
  message: externalMessage = '',
  waitingText = 'Starting camera…',
  onRetry,
  onSwitch,
  children,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [internalStream, setInternalStream] = useState<MediaStream | null>(null);
  const [internalStatus, setInternalStatus] = useState<FeedStatus>('starting');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);

  // If an external stream is provided (Remote View), use it. Otherwise, acquire local media (Node View).
  const isExternal = externalStream !== undefined;
  const stream = isExternal ? externalStream : internalStream;
  const feedStatus = isExternal ? externalStatus : internalStatus;
  const errorMessage = isExternal ? externalMessage : message;

  useEffect(() => {
    if (isExternal) return undefined; // Remote side doesn't capture local camera

    let cancelled = false;
    let localStream: MediaStream | null = null;

    setInternalStatus('starting');
    (async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setInternalStream(localStream);
        setInternalStatus('live');
      } catch (error) {
        if (cancelled) return;
        setMessage(describeError(error));
        setInternalStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing, attempt, isExternal]);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        setSize({ width: settings.width ?? video.videoWidth, height: settings.height ?? video.videoHeight });
        setFps(Math.round(settings.frameRate ?? 0));
      }
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (feedStatus !== 'live' || !video || typeof video.requestVideoFrameCallback !== 'function') return undefined;
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
  }, [feedStatus]);

  const switchCamera = () => {
    if (onSwitch) {
      onSwitch();
    } else {
      setInternalStatus('starting');
      setFacing((current) => (current === 'user' ? 'environment' : 'user'));
    }
  };

  const retry = () => {
    if (onRetry) {
      onRetry();
    } else {
      setInternalStatus('starting');
      setAttempt((current) => current + 1);
    }
  };

  const live = feedStatus === 'live';
  const statusInfo = STATUS[feedStatus] || STATUS.starting;

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
          <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} aria-hidden="true" />
          {statusInfo.label}
        </span>
        <span>{live && size.width ? `${size.width}×${size.height}` : '—'}</span>
        <span>{live ? `${fps} FPS` : '—'}</span>
      </div>

      {!isExternal && (
        <button
          type="button"
          aria-label={`Switch to ${facing === 'user' ? 'rear' : 'front'} camera`}
          disabled={feedStatus === 'starting'}
          onClick={switchCamera}
          className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white/80 outline-hidden backdrop-blur transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40"
        >
          <SwitchCamera className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}

      {feedStatus === 'starting' && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-white/40">{waitingText}</p>
      )}

      {feedStatus === 'error' && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <VideoOff className="h-6 w-6 text-white/40" strokeWidth={1.25} aria-hidden="true" />
          <p className="max-w-xs text-sm text-white/60">{errorMessage}</p>
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