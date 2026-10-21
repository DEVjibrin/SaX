import { Unplug, Usb } from 'lucide-react';
import type { SerialStatus } from '../types/controller';

const STATUS: Record<SerialStatus, { label: string; dot: string }> = {
  disconnected: { label: 'Disconnected', dot: 'bg-white/30' },
  connecting: { label: 'Connecting', dot: 'animate-pulse bg-amber-400' },
  connected: { label: 'Connected', dot: 'bg-emerald-400' },
  error: { label: 'Connection error', dot: 'bg-red-400' },
};

interface SerialControllerProps {
  status: SerialStatus;
  isSupported: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function SerialController({ status, isSupported, onConnect, onDisconnect }: SerialControllerProps) {
  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const { label, dot } = isSupported ? STATUS[status] : { label: 'Unsupported', dot: 'bg-amber-400' };
  const Icon = connected ? Unplug : Usb;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div
        role="status"
        aria-label={label}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </div>
      <button
        type="button"
        disabled={!isSupported || connecting}
        onClick={connected ? onDisconnect : onConnect}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium outline-hidden transition focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40 ${
          connected
            ? 'border border-white/15 text-white hover:bg-white/5'
            : 'bg-white text-[#0a0a0c] hover:bg-white/90'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {connected ? 'Disconnect' : connecting ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  );
}
