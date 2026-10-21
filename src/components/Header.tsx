import { Plus } from 'lucide-react';
import Wordmark from './Wordmark';

interface HeaderProps {
  onNewProject: () => void;
}

export default function Header({ onNewProject }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Wordmark className="text-2xl" />
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0a0a0c] outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          New Project
        </button>
      </div>
    </header>
  );
}
