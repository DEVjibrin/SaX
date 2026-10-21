import { useCallback, useMemo, useState } from 'react';
import { NEUTRAL_TELEMETRY, formatPacket, toLine } from '../lib/packet';
import { extractPins } from '../lib/wokwi';
import type { SensorId, SensorSelection, Telemetry } from '../types/controller';

export const SENSOR_CATALOG: { id: SensorId; label: string; description: string }[] = [
  {
    id: 'imu',
    label: 'Phone tilt (pitch and roll)',
    description: "Fills sensors.pitch and sensors.roll with the phone's tilt in degrees. When off, both are sent as 0.",
  },
];

export const NO_SENSORS: SensorSelection = { imu: false };

const SAMPLE_TELEMETRY: Telemetry = {
  mode: 'manual',
  drive: { steering: 0.25, throttle: 0.6 },
  sensors: { pitch: 2.4, roll: -0.8 },
};

export function sampleTelemetry(sensors: SensorSelection): Telemetry {
  return { ...SAMPLE_TELEMETRY, sensors: sensors.imu ? SAMPLE_TELEMETRY.sensors : NEUTRAL_TELEMETRY.sensors };
}

export function useSensorMapper(initial: Partial<SensorSelection> = {}, sketch = '', diagram = '') {
  const [sensors, setSensors] = useState<SensorSelection>(() => ({ imu: initial.imu === true }));

  const toggleSensor = useCallback((id: SensorId) => {
    setSensors((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const { pins, diagramError } = useMemo(() => extractPins(sketch, diagram), [sketch, diagram]);
  const telemetry = useMemo(() => sampleTelemetry(sensors), [sensors]);
  const preview = useMemo(() => formatPacket(telemetry), [telemetry]);
  const packetBytes = useMemo(() => new TextEncoder().encode(`${toLine(telemetry)}\n`).length, [telemetry]);

  return { sensors, toggleSensor, pins, diagramError, preview, packetBytes };
}