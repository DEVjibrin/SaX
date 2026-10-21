import { useCallback, useEffect, useState } from 'react';
import type { CameraFacing } from '../types/controller';
import type { FeedStatus } from '../types/link';

function describeError(error: unknown): string {
  if (!navigator.mediaDevices?.getUserMedia) return 'Camera access needs a secure (HTTPS) connection.';
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera permission was denied. Allow access in your browser settings.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No matching camera was found on this device.';
    if (error.name === 'NotReadableError') return 'The camera is in use by another app.';
  }
  return 'The camera could not be started.';
}

export function useCameraStream() {
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<FeedStatus>('starting');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let acquired: MediaStream | null = null;

    (async () => {
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        if (cancelled) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(acquired);
        setStatus('live');
      } catch (error) {
        if (cancelled) return;
        setMessage(describeError(error));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((track) => track.stop());
    };
  }, [facing, attempt]);

  const switchCamera = useCallback(() => {
    setStream(null);
    setStatus('starting');
    setFacing((current) => (current === 'user' ? 'environment' : 'user'));
  }, []);

  const retry = useCallback(() => {
    setStream(null);
    setStatus('starting');
    setAttempt((current) => current + 1);
  }, []);

  return { stream, status, message, facing, switchCamera, retry };
}
