import type { Telemetry } from '../types/controller';
import type { LinkStats } from '../types/link';

interface PeerSettings {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  config?: { iceServers: RTCIceServer[] };
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const NO_STATS: LinkStats = { fps: 0, width: 0, height: 0, rttMs: null };

export function peerOptions(): PeerSettings {
  const env = import.meta.env;
  const options: PeerSettings = {};
  if (env.VITE_PEER_HOST) {
    options.host = env.VITE_PEER_HOST;
    options.port = Number(env.VITE_PEER_PORT ?? 443);
    options.path = env.VITE_PEER_PATH ?? '/';
    options.secure = env.VITE_PEER_SECURE !== 'false';
  }
  if (env.VITE_ICE_SERVERS) {
    try {
      options.config = { iceServers: JSON.parse(env.VITE_ICE_SERVERS) as RTCIceServer[] };
    } catch (error) {
      console.warn('SaX: VITE_ICE_SERVERS is not valid JSON', error);
    }
  }
  return options;
}

export function createSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `sax-${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')}`;
}

export const pairUrl = (sessionId: string): string =>
  `${window.location.origin}/remote?session=${encodeURIComponent(sessionId)}`;

export async function readVideoStats(pc: RTCPeerConnection, direction: 'inbound' | 'outbound'): Promise<LinkStats> {
  const stats: LinkStats = { ...NO_STATS };
  const report = await pc.getStats();
  report.forEach((entry) => {
    if (entry.type === `${direction}-rtp` && entry.kind === 'video') {
      stats.fps = Math.round(entry.framesPerSecond ?? 0);
      stats.width = entry.frameWidth ?? 0;
      stats.height = entry.frameHeight ?? 0;
    }
    if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && typeof entry.currentRoundTripTime === 'number') {
      stats.rttMs = Math.round(entry.currentRoundTripTime * 1000);
    }
  });
  return stats;
}

const unit = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

const degrees = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-180, Math.min(180, value)) : 0;

interface RawControl {
  type?: unknown;
  seq?: unknown;
  mode?: unknown;
  drive?: { steering?: unknown; throttle?: unknown };
  sensors?: { pitch?: unknown; roll?: unknown };
}

export function parseControl(data: unknown): { telemetry: Telemetry; seq: number } | null {
  const message = data as RawControl | null;
  if (!message || message.type !== 'control' || typeof message.seq !== 'number') return null;
  return {
    seq: message.seq,
    telemetry: {
      mode: message.mode === 'auto' ? 'auto' : 'manual',
      drive: { steering: unit(message.drive?.steering), throttle: unit(message.drive?.throttle) },
      sensors: { pitch: degrees(message.sensors?.pitch), roll: degrees(message.sensors?.roll) },
    },
  };
}
