import type { SerialPacket, Telemetry } from '../types/controller';

export const NEUTRAL_TELEMETRY: Telemetry = {
  mode: 'manual',
  drive: { steering: 0, throttle: 0 },
  sensors: { pitch: 0, roll: 0 },
};

export const buildPacket = ({ mode, drive, sensors }: Telemetry): SerialPacket => ({ hb: 1, mode, drive, sensors });

export const toLine = (telemetry: Telemetry): string => JSON.stringify(buildPacket(telemetry));

const inline = (value: object): string =>
  `{ ${Object.entries(value)
    .map(([key, item]) => `"${key}": ${JSON.stringify(item)}`)
    .join(', ')} }`;

export function formatPacket(telemetry: Telemetry): string {
  const { hb, mode, drive, sensors } = buildPacket(telemetry);
  return [
    '{',
    `  "hb": ${hb},`,
    `  "mode": ${JSON.stringify(mode)},`,
    `  "drive": ${inline(drive)},`,
    `  "sensors": ${inline(sensors)}`,
    '}',
  ].join('\n');
}
