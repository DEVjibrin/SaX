import { FolderOpen, Plus } from 'lucide-react';
import ProjectCard from './ProjectCard';
import type { Project } from '../types';

interface ProjectLibraryProps {
  projects: Project[];
  onCreate: () => void;
  onLaunch: (project: Project) => void;
  onEdit: (project: Project) => void;
  onConfigure: (project: Project) => void;
  onDelete: (project: Project) => void;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#121216] text-white/50">
        <FolderOpen className="h-6 w-6" strokeWidth={1.25} aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-lg font-medium text-white">No projects yet</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/40">
        Create a machine profile to turn your phone into its sensor suite.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        New Project
      </button>
    </div>
  );
}

export default function ProjectLibrary({ projects, onCreate, onLaunch, onEdit, onConfigure, onDelete }: ProjectLibraryProps) {
  const count = projects.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-14 sm:pt-20">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Projects</h1>
        {count > 0 && <p className="mt-2 text-sm text-white/40">{count === 1 ? '1 project' : `${count} projects`}</p>}
      </div>

      {count === 0 ? (
        <EmptyState onCreate={onCreate} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} onLaunch={onLaunch} onEdit={onEdit} onConfigure={onConfigure} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
