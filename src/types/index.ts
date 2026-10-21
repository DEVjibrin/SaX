import { Car, Cog, Fan, type LucideIcon } from 'lucide-react';
import type { ProjectIntegration } from './types/controller';

export type MachineType = 'rover' | 'drone' | 'mechanism';

export interface MachineMeta {
  id: MachineType;
  label: string;
  badge: string;
  icon: LucideIcon;
}

export const MACHINES: Record<MachineType, MachineMeta> = {
  rover: { id: 'rover', label: 'Rover', badge: 'Wheeled Rover', icon: Car },
  drone: { id: 'drone', label: 'Drone', badge: 'Quadcopter Drone', icon: Fan },
  mechanism: { id: 'mechanism', label: 'Mechanism', badge: 'Robotic Mechanism', icon: Cog },
};

export interface Project {
  id: string;
  name: string;
  machineType: MachineType;
  config: string;
  integration?: ProjectIntegration;
  createdAt: number;
  updatedAt: number;
}

export type ProjectDraft = Pick<Project, 'name' | 'machineType' | 'config' | 'integration'>;
