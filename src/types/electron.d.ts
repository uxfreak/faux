import { ProjectConfig, ServerStatusMessage, ServerErrorMessage } from '../services/serverIPC';
import { TerminalDataEvent, TerminalExitEvent, TerminalErrorEvent, TerminalDestroyedEvent } from '../services/terminalIPC';

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
  
  // Terminal management
  terminal: {
    create: (options: { projectPath: string; projectId: string; cols?: number; rows?: number }) => Promise<any>;
    write: (sessionId: string, data: string) => Promise<{ success: boolean }>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
    destroy: (sessionId: string) => Promise<{ success: boolean }>;
    destroyProject: (projectId: string) => Promise<{ success: boolean }>;
    getInfo: (sessionId: string) => Promise<any>;
    getAll: () => Promise<any[]>;
    getProject: (projectId: string) => Promise<any[]>;
  };
  
  // Terminal event listeners
  onTerminalData: (callback: (data: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (data: TerminalExitEvent) => void) => () => void;
  onTerminalError: (callback: (data: TerminalErrorEvent) => void) => () => void;
  onTerminalDestroyed: (callback: (data: TerminalDestroyedEvent) => void) => () => void;
  
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