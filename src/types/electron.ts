import { Project } from './Project';

export interface ScaffoldOptions {
  name: string;
  template: string;
  path: string;
}

export interface ScaffoldProgress {
  status: string;
  message: string;
  progress: number;
}

export interface ScaffoldResult {
  success: boolean;
  error?: string;
}

export interface DuplicateProgress {
  status: string;
  message: string;
  progress: number;
}

export interface DuplicateResult {
  success: boolean;
  sourceProject?: Project;
  duplicateProject?: Project;
  error?: string;
}

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

  // Server Management API
  startServers: (projectConfig: any) => Promise<any>;
  stopServers: (projectId: string) => Promise<any>;
  getServerStatus: (projectId: string) => Promise<any>;
  onServerStatus: (callback: (data: any) => void) => () => void;
  onServerError: (callback: (data: any) => void) => () => void;

  // Terminal Management API  
  terminal: {
    create: (options: any) => Promise<any>;
    write: (sessionId: string, data: string) => Promise<any>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<any>;
    destroy: (sessionId: string) => Promise<any>;
    destroyProject: (projectId: string) => Promise<any>;
    getInfo: (sessionId: string) => Promise<any>;
    getAll: () => Promise<any>;
    getProject: (projectId: string) => Promise<any>;
  };

  // Terminal event listeners
  onTerminalData: (callback: (data: any) => void) => () => void;
  onTerminalExit: (callback: (data: any) => void) => () => void;
  onTerminalError: (callback: (data: any) => void) => () => void;
  onTerminalDestroyed: (callback: (data: any) => void) => () => void;

  // Project scaffolding API
  scaffoldProject: (options: ScaffoldOptions) => Promise<ScaffoldResult>;
  onScaffoldProgress: (callback: (progress: ScaffoldProgress) => void) => () => void;

  // Project rename API  
  renameProject: (projectId: string, newName: string) => Promise<any>;
  onProjectRenamed: (callback: (data: any) => void) => () => void;

  // Project duplication API
  duplicateProject: (projectId: string, customName?: string) => Promise<DuplicateResult>;
  onDuplicateProgress: (callback: (progress: DuplicateProgress) => void) => () => void;
  onDuplicateComplete: (callback: (result: DuplicateResult) => void) => () => void;

  // Thumbnail API
  thumbnail: {
    capture: (projectId: string, serverUrl: string, options?: any) => Promise<any>;
    debouncedCapture: (projectId: string, serverUrl: string, debounceMs?: number, options?: any) => Promise<any>;
    checkServer: (serverUrl: string) => Promise<any>;
    generateFallback: (projectId: string, projectName: string, options?: any) => Promise<any>;
    clearAll: () => Promise<any>;
  };

  // Thumbnail event listeners
  onThumbnailUpdated: (callback: (data: any) => void) => () => void;
  onThumbnailsCleared: (callback: (data: any) => void) => () => void;

  // Deployment API
  deployProject: (projectId: string, options?: any) => Promise<any>;
  getProjectDeploymentState: (projectId: string) => Promise<any>;
  onDeployProgress: (callback: (data: any) => void) => () => void;
  onDeployComplete: (callback: (data: any) => void) => () => void;

  // Deployment Session Management API
  deployment: {
    cancel: (projectId: string) => Promise<any>;
    getActiveSession: (projectId: string) => Promise<any>;
    getProjectHistory: (projectId: string) => Promise<any>;
    getAllActiveSessions: () => Promise<any>;
  };
  
  // Deployment Session Events
  onDeploymentStarted: (callback: (data: any) => void) => () => void;
  onDeploymentBlocked: (callback: (data: any) => void) => () => void;

  // Settings API
  settings: {
    getNetlifyToken: () => Promise<string | null>;
    setNetlifyToken: (token: string) => Promise<any>;
    getDeploymentRecommendations: () => Promise<any>;
  };

  // External link support
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}