import { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectDraft } from '../types';

const STORAGE_KEY = 'sax.projects.v1';

const createId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function loadProjects(): Project[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.warn('SaX: unable to persist projects', error);
    }
  }, [projects]);

  const addProject = useCallback((draft: ProjectDraft) => {
    const now = Date.now();
    setProjects((current) => [{ ...draft, id: createId(), createdAt: now, updatedAt: now }, ...current]);
  }, []);

  const updateProject = useCallback((id: string, draft: Partial<ProjectDraft>) => {
    setProjects((current) =>
      current.map((project) => (project.id === id ? { ...project, ...draft, updatedAt: Date.now() } : project)),
    );
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects((current) => current.filter((project) => project.id !== id));
  }, []);

  return { projects, addProject, updateProject, removeProject };
}