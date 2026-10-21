import type { Detection, DriveVector, TrackingResult, VisionReading } from '../types/controller';

export const ZERO_DRIVE: DriveVector = { steering: 0, throttle: 0 };

export const NO_TARGET: VisionReading = { detected: false, label: '', target_x: 0, target_y: 0, box: [0, 0, 0, 0] };

export const CLEARED: TrackingResult = { width: 0, height: 0, detections: [], target: null, reading: NO_TARGET };

const FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

const clampOffset = (value: number) => Math.max(-100, Math.min(100, Math.round(value)));

export function pickTarget(detections: Detection[]): Detection | null {
  return detections.reduce<Detection | null>((best, current) => (!best || current.score > best.score ? current : best), null);
}

export function toReading(target: Detection, width: number, height: number): VisionReading {
  const [x, y, w, h] = target.box;
  return {
    detected: true,
    label: target.label,
    target_x: clampOffset(((x + w / 2 - width / 2) / (width / 2)) * 100),
    target_y: clampOffset(((height / 2 - (y + h / 2)) / (height / 2)) * 100),
    box: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)],
  };
}

export function drawOverlay(canvas: HTMLCanvasElement, result: TrackingResult | null): void {
  const ratio = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const pixelWidth = Math.round(cw * ratio);
  const pixelHeight = Math.round(ch * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!result || result.width === 0) return;

  const scale = Math.min(cw / result.width, ch / result.height);
  const offsetX = (cw - result.width * scale) / 2;
  const offsetY = (ch - result.height * scale) / 2;
  ctx.font = FONT;
  ctx.textBaseline = 'middle';

  for (const detection of result.detections) {
    const [x, y, w, h] = detection.box;
    const isTarget = detection === result.target;
    const left = offsetX + x * scale;
    const top = offsetY + y * scale;
    ctx.lineWidth = isTarget ? 2 : 1;
    ctx.strokeStyle = isTarget ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    ctx.strokeRect(left, top, w * scale, h * scale);

    const text = `${detection.label} ${Math.round(detection.score * 100)}%`;
    const chipTop = top >= 22 ? top - 22 : top;
    ctx.fillStyle = isTarget ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(left, chipTop, ctx.measureText(text).width + 12, 20);
    ctx.fillStyle = isTarget ? '#0a0a0c' : 'rgba(255,255,255,0.8)';
    ctx.fillText(text, left + 6, chipTop + 10.5);
  }

  if (result.target) {
    const [x, y, w, h] = result.target.box;
    const targetX = offsetX + (x + w / 2) * scale;
    const targetY = offsetY + (y + h / 2) * scale;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.moveTo(cw / 2, ch / 2);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
