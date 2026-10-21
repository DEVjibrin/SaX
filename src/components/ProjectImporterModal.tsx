import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ExternalLink, Smartphone, Upload, X, type LucideIcon } from 'lucide-react';
import { SENSOR_CATALOG, useSensorMapper } from '../hooks/useSensorMapper';
import { PIN_KIND_LABEL, parseWokwiUrl } from '../lib/wokwi';
import type { Project } from '../types';
import type { ProjectIntegration, SensorId } from '../types/controller';

const MAX_FILE_BYTES = 512 * 1024;
const CLOSE_MS = 180;
const BAUD_RATE = 115200;

const ICONS: Record<SensorId, LucideIcon> = { imu: Smartphone };

const FIELDS: { key: string; text: string }[] = [
  { key: 'hb', text: 'Heartbeat, always 1. If packets stop arriving, treat it as a stop.' },
  { key: 'mode', text: 'manual while you drive with the joystick, auto when your firmware is in charge.' },
  { key: 'drive', text: 'Joystick steering and throttle, from -1.0 to +1.0. Both are 0 in auto mode.' },
  { key: 'sensors', text: 'Phone tilt in degrees. Both values are 0 unless Phone tilt is on.' },
];

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-hidden transition-colors placeholder:text-white/30 focus:border-white/30';
const labelClass = 'text-sm text-white/60';
const linkButton =
  'inline-flex items-center gap-1.5 rounded text-xs text-white/60 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40';

interface SourceFieldProps {
  label: string;
  accept: string;
  placeholder: string;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  onFileError: (message: string | null) => void;
}

function SourceField({ label, accept, placeholder, value, error, onChange, onFileError }: SourceFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      onFileError('That file is larger than 512 KB. Choose a smaller one.');
      return;
    }
    try {
      onChange(await file.text());
      onFileError(null);
    } catch {
      onFileError("That file couldn't be read. Try another one.");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <button type="button" onClick={() => input.current?.click()} className={linkButton}>
          <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          Upload
        </button>
        <input ref={input} type="file" accept={accept} onChange={handleFile} className="hidden" />
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder={placeholder}
        className={`${fieldClass} h-28 resize-none font-mono text-xs leading-relaxed`}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface ProjectImporterModalProps {
  project: Project;
  onSave: (integration: ProjectIntegration) => void;
  onClose: () => void;
}

export default function ProjectImporterModal({ project, onSave, onClose }: ProjectImporterModalProps) {
  const saved = project.integration;
  const [wokwiUrl, setWokwiUrl] = useState(saved?.wokwiUrl ?? '');
  const [sketch, setSketch] = useState(saved?.sketch ?? '');
  const [diagram, setDiagram] = useState(saved?.diagram ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const titleId = useId();
  const urlId = useId();

  const { sensors, toggleSensor, pins, diagramError, preview, packetBytes } = useSensorMapper(
    saved?.sensors,
    sketch,
    diagram,
  );

  const normalizedUrl = parseWokwiUrl(wokwiUrl);
  const urlError = wokwiUrl.trim() && !normalizedUrl ? 'Enter a Wokwi project link, like wokwi.com/projects/123456789.' : null;
  const canSave = !urlError && !diagramError;
  const wireMs = Math.max(1, Math.round((packetBytes * 10_000) / BAUD_RATE));

  const requestClose = useCallback(() => {
    setShown(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none sm:items-center ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave({ wokwiUrl: normalizedUrl ?? '', sketch, diagram, sensors });
        }}
        className={`max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#121216] p-6 shadow-2xl shadow-black/60 transition-all duration-200 motion-reduce:transition-none sm:p-8 ${
          shown ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.98]'
        }`}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-semibold text-white">
              Configure {project.name}
            </h2>
            <p className="mt-1 text-sm text-white/40">Import your circuit, then choose what the phone adds to each packet.</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-m-2 rounded-full p-2 text-white/40 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <label htmlFor={urlId} className={`${labelClass} mb-2 block`}>
                Wokwi project link
              </label>
              <input
                id={urlId}
                type="text"
                inputMode="url"
                value={wokwiUrl}
                onChange={(event) => setWokwiUrl(event.target.value)}
                placeholder="wokwi.com/projects/123456789"
                autoComplete="off"
                className={fieldClass}
              />
              {urlError && (
                <p role="alert" className="mt-2 text-xs text-red-400">
                  {urlError}
                </p>
              )}
              {normalizedUrl && (
                <a href={normalizedUrl} target="_blank" rel="noreferrer" className={`${linkButton} mt-2`}>
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Open in Wokwi
                </a>
              )}
              <p className="mt-2 text-xs text-white/30">Paste or upload the project files below to read its pins.</p>
            </div>

            <SourceField
              label="sketch.ino"
              accept=".ino,.cpp,.c,.h,.txt"
              placeholder="const int servoPin = 13;"
              value={sketch}
              onChange={setSketch}
              onFileError={setFileError}
            />
            <SourceField
              label="diagram.json"
              accept=".json"
              placeholder='{ "parts": [], "connections": [] }'
              value={diagram}
              error={diagramError}
              onChange={setDiagram}
              onFileError={setFileError}
            />
            {fileError && (
              <p role="alert" className="-mt-3 text-xs text-red-400">
                {fileError}
              </p>
            )}

            <section>
              <h3 className={`${labelClass} mb-2`}>Pin mapping{pins.length > 0 && ` (${pins.length})`}</h3>
              <div className="rounded-xl border border-white/10 bg-white/[0.03]">
                {pins.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-white/30">
                    No pins found yet. Add a sketch or diagram.json to preview them.
                  </p>
                ) : (
                  <ul className="max-h-48 divide-y divide-white/5 overflow-y-auto">
                    {pins.map((entry) => (
                      <li key={`${entry.pin}-${entry.label}`} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                        <span className="w-14 shrink-0 font-mono text-white">{entry.pin}</span>
                        <span className="min-w-0 flex-1 truncate text-white/60">{entry.label}</span>
                        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-white/50">
                          {PIN_KIND_LABEL[entry.kind]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className={labelClass}>Phone sensors</h3>
              <p className="mb-3 mt-1 text-xs text-white/40">Optional readings that fill the sensors object in each packet.</p>
              <div className="space-y-2">
                {SENSOR_CATALOG.map(({ id, label, description }) => {
                  const Icon = ICONS[id];
                  const on = sensors[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleSensor(id)}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                        on ? 'border-white/25 bg-white/[0.06]' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/80">
                        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{label}</span>
                        <span className="mt-0.5 block text-xs text-white/40">{description}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
                          on ? 'bg-white' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className={`absolute left-1 top-1 h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${
                            on ? 'translate-x-4 bg-[#0a0a0c]' : 'bg-white/60'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className={labelClass}>Serial packet preview</h3>
                <span className="text-xs tabular-nums text-white/30">
                  {packetBytes} bytes, about {wireMs} ms at {BAUD_RATE} baud
                </span>
              </div>
              <pre
                aria-label="Serial packet preview"
                className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-relaxed text-white/80"
              >
                {preview}
              </pre>
              <p className="mt-2 text-xs text-white/30">
                Sample values. The app sends this as one line every 100 ms, and your firmware decides what each value means.
              </p>
              <dl className="mt-4 space-y-2 text-xs">
                {FIELDS.map(({ key, text }) => (
                  <div key={key} className="flex gap-3">
                    <dt className="w-16 shrink-0 font-mono text-white/70">{key}</dt>
                    <dd className="text-white/40">{text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full px-4 py-2 text-sm text-white/60 outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#0a0a0c] outline-hidden transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121216] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Save configuration
          </button>
        </div>
      </form>
    </div>
  );
}