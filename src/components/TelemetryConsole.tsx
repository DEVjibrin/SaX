import { useEffect, useRef, useState, type FormEvent, type UIEvent } from 'react';
import { ArrowDownToLine, BookOpen, Check, Copy, Send, Terminal, Trash2, type LucideIcon } from 'lucide-react';
import { PACKET_EXAMPLE, SAMPLE_SKETCH, SAX_HEADER } from '../lib/firmware';
import type { LogDirection, LogEntry } from '../types/controller';

type Tab = 'console' | 'guide';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'guide', label: 'Hardware guide', icon: BookOpen },
];

const DIRECTION: Record<LogDirection, { tag: string; tone: string }> = {
  tx: { tag: 'TX', tone: 'text-sky-300/70' },
  rx: { tag: 'RX', tone: 'text-emerald-300/80' },
  sys: { tag: 'SYS', tone: 'text-amber-300/70' },
};

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

const headerButton =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/50 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 aria-pressed:bg-white/10 aria-pressed:text-white';
const codeSurface = 'rounded-xl border border-white/10 bg-black/30';

function CodeBlock({ filename, code }: { filename: string; code: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className={`overflow-hidden ${codeSurface}`}>
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="font-mono text-xs text-white/60">{filename}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded text-xs text-white/60 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {state === 'copied' ? (
            <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          )}
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/80">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function HardwareGuide() {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-white/60">
      <p>
        SaX is a bridge, not a brain. Every 100 ms it sends your board one line of JSON over USB, shaped like this. Your
        firmware decides what any of it means.
      </p>
      <pre className={`overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-white/80 ${codeSurface}`}>
        {PACKET_EXAMPLE}
      </pre>
      <ol className="list-decimal space-y-2 pl-5 marker:text-white/30">
        <li>
          In your Wokwi project, add a new file named <code className="font-mono text-white/80">SaX.h</code> and paste the
          header below.
        </li>
        <li>Paste the sample sketch into your sketch tab, then change the pins to match your circuit.</li>
        <li>Connect your board here at 115200 baud. The header answers every packet, which tells the app the board is alive.</li>
      </ol>
      <CodeBlock filename="SaX.h" code={SAX_HEADER} />
      <CodeBlock filename="sketch.ino" code={SAMPLE_SKETCH} />
      <ul className="list-disc space-y-1.5 pl-5 text-xs text-white/40 marker:text-white/20">
        <li>
          If no packet arrives for 300 ms, <code className="font-mono">SaX.alive()</code> returns false. Stop your motors when it does.
        </li>
        <li>Pitch and roll stream only when Phone tilt is on in Configure. Otherwise they stay 0.</li>
        <li>The same files work in the Arduino IDE.</li>
      </ul>
    </div>
  );
}

function LiveStream({ streaming, readStream }: { streaming: boolean; readStream: () => string }) {
  const [line, setLine] = useState('');

  useEffect(() => {
    if (!streaming) return undefined;
    setLine(readStream());
    const timer = window.setInterval(() => setLine(readStream()), 100);
    return () => window.clearInterval(timer);
  }, [streaming, readStream]);

  return (
    <div className="border-b border-white/5 px-4 py-2.5 font-mono text-[11px] leading-relaxed">
      <div className="mb-1 flex items-center justify-between text-white/30">
        <span>Live packet</span>
        <span>{streaming ? 'Streaming' : 'Idle'}</span>
      </div>
      <p className="line-clamp-3 h-14 break-all text-white/70">
        {streaming ? line : 'Connect a device to start streaming.'}
      </p>
    </div>
  );
}

interface TelemetryConsoleProps {
  logs: LogEntry[];
  canSend: boolean;
  streaming: boolean;
  readStream: () => string;
  onSend: (command: string) => Promise<boolean>;
  onClear: () => void;
}

export default function TelemetryConsole({ logs, canSend, streaming, readStream, onSend, onClear }: TelemetryConsoleProps) {
  const [tab, setTab] = useState<Tab>('console');
  const [autoScroll, setAutoScroll] = useState(true);
  const [command, setCommand] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewport.current;
    if (tab === 'console' && autoScroll && element) element.scrollTop = element.scrollHeight;
  }, [logs, autoScroll, tab]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    if (autoScroll && scrollHeight - scrollTop - clientHeight > 32) setAutoScroll(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend || !command.trim()) return;
    if (await onSend(command)) setCommand('');
  };

  return (
    <section
      aria-label="Telemetry console"
      className="flex h-80 min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] lg:h-auto"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <div role="tablist" aria-label="Console views" className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              title={id === 'guide' ? 'Hardware guide and C++ snippet' : undefined}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {tab === 'console' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Auto-scroll"
              aria-pressed={autoScroll}
              onClick={() => setAutoScroll((value) => !value)}
              className={headerButton}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden sm:inline">Auto-scroll</span>
            </button>
            <button type="button" aria-label="Clear console" onClick={onClear} className={headerButton}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        )}
      </header>

      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {tab === 'guide' ? (
          <HardwareGuide />
        ) : (
          <>
            <LiveStream streaming={streaming} readStream={readStream} />

            <div
              ref={viewport}
              role="log"
              aria-live="off"
              onScroll={handleScroll}
              className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed"
            >
              {logs.length === 0 ? (
                <p className="text-white/30">No packets yet. Connect a device to see data here.</p>
              ) : (
                logs.map((entry) => {
                  const { tag, tone } = DIRECTION[entry.direction];
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <span className="shrink-0 tabular-nums text-white/30">{formatTime(entry.timestamp)}</span>
                      <span className={`w-7 shrink-0 ${tone}`}>{tag}</span>
                      <span className="min-w-0 whitespace-pre-wrap break-all text-white/80">{entry.message}</span>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/5 p-3">
              <input
                type="text"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                disabled={!canSend}
                spellCheck={false}
                autoComplete="off"
                aria-label="Command"
                placeholder={canSend ? '{"cmd":"ping"}' : 'Connect to send commands'}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-white outline-hidden transition-colors placeholder:text-white/30 focus:border-white/30 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!canSend || !command.trim()}
                aria-label="Send command"
                className="rounded-full bg-white p-2 text-[#0a0a0c] outline-hidden transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}