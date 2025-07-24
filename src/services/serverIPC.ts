// IPC interface for server management between renderer and main process
export interface ServerInfo {
  name: string;
  url: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export interface ProjectServerState {
  viteServer: ServerInfo | null;
  storybookServer: ServerInfo | null;
  isStarting: boolean;
  isHealthy: boolean;
  error: string | null;
  retryCount: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
}

// IPC Channel definitions
export const IPC_CHANNELS = {
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_STATUS: 'server:status',
  SERVER_HEALTH: 'server:health',
  SERVER_ERROR: 'server:error'
} as const;

// IPC Message types
export interface StartServerMessage {
  projectConfig: ProjectConfig;
}

export interface StopServerMessage {
  projectId: string;
}

export interface ServerStatusMessage {
  projectId: string;
  viteServer: ServerInfo | null;
  storybookServer: ServerInfo | null;
  isHealthy: boolean;
  error: string | null;
}

export interface ServerErrorMessage {
  projectId: string;
  error: string;
}

// Browser-safe server management using IPC
export class ServerManager {
  private static instance: ServerManager;
  private listeners: Map<string, (data: any) => void> = new Map();

  static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  private constructor() {
    // Setup IPC listeners if in Electron renderer
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.setupIPCListeners();
    }
  }

  private setupIPCListeners() {
    // Listen for server status updates
    window.electronAPI.onServerStatus((data: ServerStatusMessage) => {
      console.log('Received server status update:', data);
      const listener = this.listeners.get(`status:${data.projectId}`);
      if (listener) {
        console.log('Calling status listener for project:', data.projectId);
        listener(data);
      } else {
        console.log('No status listener found for project:', data.projectId, 'Available listeners:', Array.from(this.listeners.keys()));
      }
    });

    // Listen for server errors
    window.electronAPI.onServerError((data: ServerErrorMessage) => {
      console.log('Received server error:', data);
      const listener = this.listeners.get(`error:${data.projectId}`);
      if (listener) {
        console.log('Calling error listener for project:', data.projectId);
        listener(data);
      } else {
        console.log('No error listener found for project:', data.projectId);
      }
    });
  }

  async startServers(projectConfig: ProjectConfig): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    return window.electronAPI.startServers(projectConfig);
  }

  async stopServers(projectId: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    return window.electronAPI.stopServers(projectId);
  }

  async getServerStatus(projectId: string): Promise<ServerStatusMessage | null> {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    return window.electronAPI.getServerStatus(projectId);
  }

  onStatusUpdate(projectId: string, callback: (data: ServerStatusMessage) => void): () => void {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    const key = `status:${projectId}`;
    this.listeners.set(key, callback);
    
    // Return cleanup function
    return () => {
      this.listeners.delete(key);
    };
  }

  onError(projectId: string, callback: (data: ServerErrorMessage) => void): () => void {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    const key = `error:${projectId}`;
    this.listeners.set(key, callback);
    
    // Return cleanup function
    return () => {
      this.listeners.delete(key);
    };
  }
}

// Export singleton instance
export const serverManager = ServerManager.getInstance();