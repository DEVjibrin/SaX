import type { SerialStatus, Telemetry } from './controller';

export type FeedStatus = 'starting' | 'live' | 'error';
export type PairStatus = 'starting' | 'waiting' | 'paired' | 'error';
export type RemoteStatus = 'connecting' | 'connected' | 'closed' | 'error';

export interface LinkStats {
  fps: number;
  width: number;
  height: number;
  rttMs: number | null;
}

export interface RobotHello {
  name: string;
  badge: string;
  tilt: boolean;
}

export interface RobotState {
  serial: SerialStatus;
  battery: number | null;
}

export type RobotMessage = ({ type: 'hello' } & RobotHello) | ({ type: 'state' } & RobotState);

export interface ControlMessage extends Telemetry {
  type: 'control';
  seq: number;
}
