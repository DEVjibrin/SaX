import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import type { PairStatus } from '../types/link';

const MESSAGE: Record<PairStatus, string> = {
  starting: 'Connecting to the pairing service…',
  waiting: 'Waiting for the remote to scan.',
  paired: 'Remote paired.',
  error: 'Pairing is unavailable.',
};

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white outline-hidden transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40';

interface PairRemotePanelProps {
  pairUrl: string;
  status: PairStatus;
  error: string | null;
  onNewCode: () => void;
}

export default function PairRemotePanel({ pairUrl, status, error, onNewCode }: PairRemotePanelProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-label="Pair remote"
      className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-[#121216] p-6 text-center"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">Pair Remote</h2>
        <p className="mt-1 text-sm text-white/40">Scan with the phone you will hold. Both phones need internet access.</p>
      </div>
      <div
        role="img"
        aria-label="QR code that opens the remote controller"
        className={`rounded-2xl bg-white p-3 transition-opacity duration-300 motion-reduce:transition-none ${
          status === 'waiting' ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <QRCodeSVG value={pairUrl} size={176} level="M" bgColor="#ffffff" fgColor="#0a0a0c" />
      </div>
      <p role="status" className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-white/40'}`}>
        {status === 'error' && error ? error : MESSAGE[status]}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={copy} className={buttonClass}>
          {copied ? (
            <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" onClick={onNewCode} className={buttonClass}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          New code
        </button>
      </div>
    </section>
  );
}
