export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type LogDirection = 'tx' | 'rx' | 'sys';
export type CameraFacing = 'user' | 'environment';
export type ControlMode = 'auto' | 'manual';

export interface LogEntry {
  id: number;
  timestamp: number;
  direction: LogDirection;
  message: string;
}

export interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

export interface SerialApi {
  requestPort(): Promise<SerialPortLike>;
}

export interface DriveVector {
  steering: number;
  throttle: number;
}

export interface ImuReading {
  pitch: number;
  roll: number;
}

export interface Telemetry {
  mode: ControlMode;
  drive: DriveVector;
  sensors: ImuReading;
}

export interface SerialPacket extends Telemetry {
  hb: 1;
}

export interface WebSerialOptions {
  baudRate?: number;
  heartbeatMs?: number;
  timeoutMs?: number;
  startupGraceMs?: number;
  telemetry?: () => Telemetry;
  maxLogs?: number;
}

export interface WebSerial {
  isSupported: boolean;
  status: SerialStatus;
  error: string | null;
  logs: LogEntry[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (command: string) => Promise<boolean>;
  clearLogs: () => void;
  log: (direction: LogDirection, message: string) => void;
  packet: () => string;
}

export interface SensorSelection {
  imu: boolean;
}

export type SensorId = keyof SensorSelection;

export type PinKind = 'motor' | 'servo' | 'relay' | 'sensor' | 'led' | 'other';

export interface PinMapping {
  pin: string;
  label: string;
  kind: PinKind;
  source: 'sketch' | 'diagram';
}

export interface ProjectIntegration {
  wokwiUrl: string;
  sketch: string;
  diagram: string;
  sensors: SensorSelection;
}