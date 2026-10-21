import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
import { CLEARED, NO_TARGET, pickTarget, toReading } from '../lib/tracking';
import type { Detection, TrackerStatus, TrackingResult, VisionBox, VisionReading } from '../types/controller';

const MIN_SCORE = 0.5;
const HOLD_MS = 300;

let modelPromise: Promise<ObjectDetection> | null = null;

function loadModel(): Promise<ObjectDetection> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, cocoSsd] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')]);
      await tf.ready();
      return cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: import.meta.env.VITE_COCO_SSD_MODEL_URL });
    })();
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}

interface ObjectTrackerOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onResult: (result: TrackingResult) => void;
}

export function useObjectTracker({ videoRef, enabled, onResult }: ObjectTrackerOptions) {
  const [status, setStatus] = useState<TrackerStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return undefined;
    }

    let cancelled = false;
    let frame = 0;
    setStatus('loading');
    setError(null);

    loadModel()
      .then((model) => {
        if (cancelled) return;
        setStatus('ready');

        let held: VisionReading = NO_TARGET;
        let lastSeen = -Infinity;
        let count = 0;
        let windowStart = performance.now();

        const tick = async () => {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const predictions = await model.detect(video);
              if (cancelled) return;
              const detections: Detection[] = predictions
                .filter((prediction) => prediction.score >= MIN_SCORE)
                .map((prediction) => ({
                  label: prediction.class,
                  score: prediction.score,
                  box: prediction.bbox as VisionBox,
                }));

              const now = performance.now();
              const target = pickTarget(detections);
              let reading = NO_TARGET;
              if (target) {
                reading = toReading(target, video.videoWidth, video.videoHeight);
                held = reading;
                lastSeen = now;
              } else if (now - lastSeen < HOLD_MS) {
                reading = held;
              }
              onResultRef.current({ width: video.videoWidth, height: video.videoHeight, detections, target, reading });

              count += 1;
              if (now - windowStart >= 1000) {
                setFps(Math.round((count * 1000) / (now - windowStart)));
                count = 0;
                windowStart = now;
              }
            } catch {
              if (cancelled) return;
              onResultRef.current(CLEARED);
              setError('Detection stopped unexpectedly.');
              setStatus('error');
              return;
            }
          }
          if (!cancelled) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (cancelled) return;
        setError('The AI model could not be loaded. Check your connection and try again.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      onResultRef.current(CLEARED);
    };
  }, [enabled, videoRef]);

  return { status, error, fps };
}
