import { ProjectConfig, ServerStatusMessage, ServerErrorMessage } from '../services/serverIPC';

export interface ScaffoldOptions {
  projectName: string;
  targetPath?: string;
  skipExisting?: boolean;
}

export interface ScaffoldProgress {
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
  }>;
  progress: number;
  error?: string | null;
  currentStep: number;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath?: string;
  steps?: any[];
  message?: string;
  error?: string;
}

export interface ElectronAPI {
  // Server management
  startServers: (projectConfig: ProjectConfig) => Promise<void>;
  stopServers: (projectId: string) => Promise<void>;
  getServerStatus: (projectId: string) => Promise<ServerStatusMessage | null>;
  
  // Event listeners
  onServerStatus: (callback: (data: ServerStatusMessage) => void) => void;
  onServerError: (callback: (data: ServerErrorMessage) => void) => void;
  
  // Project scaffolding
  scaffoldProject: (options: ScaffoldOptions) => Promise<ScaffoldResult>;
  onScaffoldProgress: (callback: (data: ScaffoldProgress & { projectName: string }) => void) => void;
  
  // Database operations (existing)
  db: {
    getAllProjects: () => Promise<any[]>;
    addProject: (project: any) => Promise<any>;
    updateProject: (id: string, updates: any) => Promise<any>;
    deleteProject: (id: string) => Promise<void>;
    getProject: (id: string) => Promise<any>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}