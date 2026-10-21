import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { Upload, X } from 'lucide-react';
import { MACHINES, type MachineType, type Project, type ProjectDraft } from '../types';

const MAX_FILE_BYTES = 512 * 1024;
const CLOSE_MS = 180;

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/30';
const labelClass = 'mb-2 block text-sm text-white/60';

function getConfigError(value: string): string | null {
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    JSON.parse(text);
    return null;
  } catch {
    return "That isn't valid JSON. Check for a missing comma, quote, or bracket.";
  }
}

interface ProjectModalProps {
  project?: Project;
  onSubmit: (draft: ProjectDraft) => void;
  onClose: () => void;
}

export default function ProjectModal({ project, onSubmit, onClose }: ProjectModalProps) {
  const isEdit = project !== undefined;
  const [name, setName] = useState(project?.name ?? '');
  const [machineType, setMachineType] = useState<MachineType>(project?.machineType ?? 'rover');
  const [config, setConfig] = useState(project?.config ?? '');
  const [shown, setShown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const titleId = useId();
  const nameId = useId();
  const configId = useId();

  const configError = useMemo(() => getConfigError(config), [config]);
  const canSubmit = name.trim().length > 0 && configError === null;

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

  const readFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setFileError('That file is larger than 512 KB. Choose a smaller one.');
      return;
    }
    try {
      setConfig(await file.text());
      setFileError(null);
    } catch {
      setFileError("That file couldn't be read. Try another one.");
    }
  }, []);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void readFile(file);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), machineType, config });
  };

  const error = configError ?? fileError;

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
        onSubmit={handleSubmit}
        className={`max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#121216] p-6 shadow-2xl shadow-black/60 transition-all duration-200 motion-reduce:transition-none sm:p-8 ${
          shown ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.98]'
        }`}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-white">
              {isEdit ? 'Edit Project' : 'New Project'}
            </h2>
            <p className="mt-1 text-sm text-white/40">Describe the machine your phone will work with.</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-m-2 rounded-full p-2 text-white/40 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor={nameId} className={labelClass}>
              Project name
            </label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={48}
              placeholder="Backyard rover"
              autoComplete="off"
              autoFocus
              className={fieldClass}
            />
          </div>

          <div>
            <span className={labelClass}>Machine type</span>
            <div role="radiogroup" aria-label="Machine type" className="grid grid-cols-3 gap-2">
              {Object.values(MACHINES).map(({ id, label, icon: Icon }) => {
                const active = id === machineType;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMachineType(id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                      active
                        ? 'border-white/40 bg-white/10 text-white'
                        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/80'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor={configId} className={labelClass}>
              Configuration <span className="text-white/30">(optional)</span>
            </label>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={handleDrop}
              className={`rounded-xl border border-dashed transition-colors ${
                dragging ? 'border-white/40 bg-white/5' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <textarea
                id={configId}
                value={config}
                onChange={(event) => setConfig(event.target.value)}
                spellCheck={false}
                placeholder='{ "sensors": ["imu", "gps"] }'
                className="block h-32 w-full resize-none bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-white/80 outline-none placeholder:text-white/25"
              />
              <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-2.5 text-xs text-white/40">
                <span>Paste JSON or a script, or drop a file here.</span>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Upload file
                </button>
                <input ref={fileInput} type="file" accept=".json,.js,.ts,.py,.txt,.yaml,.yml,.cfg" onChange={handleFileInput} className="hidden" />
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full px-4 py-2 text-sm text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#0a0a0c] outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121216] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
