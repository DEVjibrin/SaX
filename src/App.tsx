import { useCallback, useState } from 'react';
import Header from './components/Header';
import ProjectImporterModal from './components/ProjectImporterModal';
import ProjectLibrary from './components/ProjectLibrary';
import ProjectModal from './components/ProjectModal';
import RemoteView from './components/RemoteView';
import RobotNodeView from './components/RobotNodeView';
import SplashScreen from './components/SplashScreen';
import { useProjects } from './hooks/useProjects';
import type { Project, ProjectDraft } from './types';
import type { ProjectIntegration } from './types/controller';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; project: Project }
  | { mode: 'configure'; project: Project }
  | null;

type Route = { name: 'dashboard' } | { name: 'remote'; session: string | null } | { name: 'node'; session: string | null };

function readRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/remote')) {
    return { name: 'remote', session: new URLSearchParams(window.location.search).get('session') };
  }
  if (path.endsWith('/node')) {
    return { name: 'node', session: new URLSearchParams(window.location.search).get('session') };
  }
  return { name: 'dashboard' };
}

function Dashboard() {
  const [showSplash, setShowSplash] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const { projects, addProject, updateProject, removeProject } = useProjects();

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);
  const openCreate = useCallback(() => setModal({ mode: 'create' }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const closeRobotNode = useCallback(() => setActiveProject(null), []);

  const handleSubmit = (draft: ProjectDraft) => {
    if (modal?.mode === 'edit') updateProject(modal.project.id, draft);
    else addProject(draft);
    setModal(null);
  };

  const handleConfigure = (integration: ProjectIntegration) => {
    if (modal?.mode === 'configure') updateProject(modal.project.id, { integration });
    setModal(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-sans tracking-tight text-white antialiased">
      <div aria-hidden={showSplash}>
        {activeProject ? (
          <RobotNodeView project={activeProject} onBack={closeRobotNode} />
        ) : (
          <>
            <Header onNewProject={openCreate} />
            <ProjectLibrary
              projects={projects}
              onCreate={openCreate}
              onLaunch={setActiveProject}
              onEdit={(project) => setModal({ mode: 'edit', project })}
              onConfigure={(project) => setModal({ mode: 'configure', project })}
              onDelete={(project) => removeProject(project.id)}
            />
          </>
        )}
      </div>

      {modal?.mode === 'configure' && (
        <ProjectImporterModal key={modal.project.id} project={modal.project} onSave={handleConfigure} onClose={closeModal} />
      )}

      {modal && modal.mode !== 'configure' && (
        <ProjectModal
          key={modal.mode === 'edit' ? modal.project.id : 'create'}
          project={modal.mode === 'edit' ? modal.project : undefined}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}

      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </div>
  );
}

export default function App() {
  const [route] = useState(readRoute);
  if (route.name === 'remote') return <RemoteView session={route.session} />;
  if (route.name === 'node') return <RobotNodeView session={route.session} />;
  return <Dashboard />;
}