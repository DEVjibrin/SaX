import { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { MACHINES, type Project } from '../types';

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const itemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10';

interface ProjectCardProps {
  project: Project;
  onLaunch: (project: Project) => void;
  onEdit: (project: Project) => void;
  onConfigure: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export default function ProjectCard({ project, onLaunch, onEdit, onConfigure, onDelete }: ProjectCardProps) {
  const machine = MACHINES[project.machineType];
  const Icon = machine.icon;
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const run = (action: (project: Project) => void) => {
    close();
    action(project);
  };

  return (
    <article
      className={`relative flex h-full flex-col justify-between gap-10 rounded-2xl border border-white/10 bg-[#121216] p-5 transition-colors hover:border-white/20 ${
        open ? 'z-20' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/80">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label={`Actions for ${project.name}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => (open ? close() : setOpen(true))}
            className="-m-1.5 rounded-full p-1.5 text-white/40 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-white/10 bg-[#17171c] p-1 text-white/80 shadow-2xl shadow-black/60"
            >
              <button type="button" role="menuitem" onClick={() => run(onLaunch)} className={itemClass}>
                <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Launch
              </button>
              <button type="button" role="menuitem" onClick={() => run(onConfigure)} className={itemClass}>
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Configure
              </button>
              <button type="button" role="menuitem" onClick={() => run(onEdit)} className={itemClass}>
                <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => (confirming ? run(onDelete) : setConfirming(true))}
                className={`${itemClass} text-red-400`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                {confirming ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="truncate text-lg font-medium text-white">{project.name}</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
            {machine.badge}
          </span>
          <time dateTime={new Date(project.updatedAt).toISOString()} className="text-xs text-white/30">
            {dateFormat.format(project.updatedAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
