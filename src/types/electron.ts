import { Project } from './Project';

export interface ElectronAPI {
  versions: {
    node: () => string;
    chrome: () => string;
    electron: () => string;
  };
  
  db: {
    getAllProjects: () => Promise<Project[]>;
    addProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;
    deleteProject: (id: string) => Promise<boolean>;
    getProject: (id: string) => Promise<Project | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}