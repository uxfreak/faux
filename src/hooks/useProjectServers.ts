import { useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '../types/Project';
import { 
  serverManager,
  ServerInfo,
  ProjectConfig,
  ServerStatusMessage 
} from '../services/serverIPC';

export interface ProjectServerState {
  viteServer: ServerInfo | null;
  storybookServer: ServerInfo | null;
  isStarting: boolean;
  isHealthy: boolean;
  error: string | null;
  retryCount: number;
}

export interface UseProjectServersResult {
  serverState: ProjectServerState;
  startServers: () => Promise<void>;
  stopServers: () => Promise<void>;
  retryConnection: () => Promise<void>;
  checkHealth: () => Promise<void>;
}

const MAX_RETRY_ATTEMPTS = 3;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export const useProjectServers = (project: Project): UseProjectServersResult => {
  const [serverState, setServerState] = useState<ProjectServerState>({
    viteServer: null,
    storybookServer: null,
    isStarting: false,
    isHealthy: false,
    error: null,
    retryCount: 0
  });

  const statusCleanupRef = useRef<(() => void) | null>(null);
  const errorCleanupRef = useRef<(() => void) | null>(null);

  // Update server state helper
  const updateServerState = useCallback((updates: Partial<ProjectServerState>) => {
    setServerState(prev => ({ ...prev, ...updates }));
  }, []);

  // Start servers for the project
  const startServers = useCallback(async () => {
    if (serverState.isStarting) return;

    updateServerState({ isStarting: true, error: null });

    try {
      const projectConfig: ProjectConfig = {
        id: project.id,
        name: project.name,
        path: project.path || `/Users/ssuman/faux-projects/${project.name.toLowerCase().replace(/\s+/g, '-')}`
      };

      await serverManager.startServers(projectConfig);
      
      // The actual server state will be updated via IPC callbacks
      // Just clear the starting flag here - success state comes via IPC

    } catch (error) {
      console.error('Failed to start project servers:', error);
      updateServerState({
        isStarting: false,
        error: error instanceof Error ? error.message : 'Failed to start servers',
        retryCount: serverState.retryCount + 1
      });
    }
  }, [project, serverState.isStarting, serverState.retryCount, updateServerState]);

  // Stop servers for the project
  const stopServers = useCallback(async () => {
    try {
      await serverManager.stopServers(project.id);
      
      // Reset state immediately
      updateServerState({
        viteServer: null,
        storybookServer: null,
        isStarting: false,
        isHealthy: false,
        error: null,
        retryCount: 0
      });

    } catch (error) {
      console.error('Failed to stop project servers:', error);
      updateServerState({
        error: error instanceof Error ? error.message : 'Failed to stop servers'
      });
    }
  }, [project.id, updateServerState]);

  // Retry connection
  const retryConnection = useCallback(async () => {
    if (serverState.retryCount >= MAX_RETRY_ATTEMPTS) {
      updateServerState({
        error: `Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Please check project configuration.`
      });
      return;
    }

    await startServers();
  }, [serverState.retryCount, startServers, updateServerState]);

  // Check server health via IPC
  const checkHealth = useCallback(async () => {
    try {
      const status = await serverManager.getServerStatus(project.id);
      if (status) {
        updateServerState({
          viteServer: status.viteServer,
          storybookServer: status.storybookServer,
          isHealthy: status.isHealthy,
          error: status.error
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      updateServerState({ isHealthy: false });
    }
  }, [project.id, updateServerState]);

  // Setup IPC listeners and cleanup
  useEffect(() => {
    // Setup status update listener
    statusCleanupRef.current = serverManager.onStatusUpdate(project.id, (data: ServerStatusMessage) => {
      updateServerState({
        viteServer: data.viteServer,
        storybookServer: data.storybookServer,
        isHealthy: data.isHealthy,
        error: data.error,
        isStarting: false // Clear starting state when we get status update
      });
    });

    // Setup error listener
    errorCleanupRef.current = serverManager.onError(project.id, (data) => {
      updateServerState({
        error: data.error,
        isStarting: false,
        retryCount: serverState.retryCount + 1
      });
    });

    // Cleanup on unmount
    return () => {
      if (statusCleanupRef.current) {
        statusCleanupRef.current();
      }
      if (errorCleanupRef.current) {
        errorCleanupRef.current();
      }
    };
  }, [project.id, updateServerState, serverState.retryCount]);

  return {
    serverState,
    startServers,
    stopServers,
    retryConnection,
    checkHealth
  };
};