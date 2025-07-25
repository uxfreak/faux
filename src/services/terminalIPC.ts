/**
 * Terminal IPC Service
 * Browser-safe communication layer for terminal operations
 * 
 * This service provides a safe interface for the renderer process to communicate
 * with the main process terminal manager through IPC.
 */

export interface TerminalSession {
  sessionId: string;
  projectId: string;
  projectPath: string;
  cols: number;
  rows: number;
  shell: string;
}

export interface TerminalInfo {
  sessionId: string;
  projectId: string;
  projectPath: string;
  cols: number;
  rows: number;
  createdAt: string;
  isAlive: boolean;
}

export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal: string;
}

export interface TerminalErrorEvent {
  sessionId: string;
  error: string;
}

export interface TerminalDestroyedEvent {
  sessionId: string;
}

export interface TerminalCreateOptions {
  projectPath: string;
  projectId: string;
  cols?: number;
  rows?: number;
}

/**
 * Terminal Manager singleton for renderer process
 * Provides safe access to terminal functionality via IPC
 */
class TerminalIPCService {
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for terminal events from main process
   */
  private initializeEventListeners() {
    if (this.isInitialized) return;

    // Set up event forwarding from main process
    window.electronAPI.onTerminalData((data: TerminalDataEvent) => {
      this.emit('data', data);
    });

    window.electronAPI.onTerminalExit((data: TerminalExitEvent) => {
      this.emit('exit', data);
    });

    window.electronAPI.onTerminalError((data: TerminalErrorEvent) => {
      this.emit('error', data);
    });

    window.electronAPI.onTerminalDestroyed((data: TerminalDestroyedEvent) => {
      this.emit('destroyed', data);
    });

    this.isInitialized = true;
  }

  /**
   * Create a new terminal session
   * @param options Terminal creation options
   * @returns Promise<TerminalSession>
   */
  async createTerminal(options: TerminalCreateOptions): Promise<TerminalSession> {
    try {
      const session = await window.electronAPI.terminal.create({
        projectPath: options.projectPath,
        projectId: options.projectId,
        cols: options.cols || 80,
        rows: options.rows || 24
      });

      console.log(`[TerminalIPC] Created terminal session ${session.sessionId} for project ${session.projectId}`);
      return session;
    } catch (error) {
      console.error('[TerminalIPC] Failed to create terminal:', error);
      throw new Error(`Failed to create terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write data to a terminal session
   * @param sessionId Terminal session ID
   * @param data Data to write
   */
  async writeToTerminal(sessionId: string, data: string): Promise<void> {
    try {
      await window.electronAPI.terminal.write(sessionId, data);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to write to terminal ${sessionId}:`, error);
      throw new Error(`Failed to write to terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resize a terminal session
   * @param sessionId Terminal session ID
   * @param cols Column count
   * @param rows Row count
   */
  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    try {
      await window.electronAPI.terminal.resize(sessionId, cols, rows);
      console.log(`[TerminalIPC] Resized terminal ${sessionId} to ${cols}x${rows}`);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to resize terminal ${sessionId}:`, error);
      throw new Error(`Failed to resize terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Destroy a terminal session
   * @param sessionId Terminal session ID
   */
  async destroyTerminal(sessionId: string): Promise<void> {
    try {
      await window.electronAPI.terminal.destroy(sessionId);
      console.log(`[TerminalIPC] Destroyed terminal session ${sessionId}`);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to destroy terminal ${sessionId}:`, error);
      throw new Error(`Failed to destroy terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Destroy all terminals for a project
   * @param projectId Project ID
   */
  async destroyProjectTerminals(projectId: string): Promise<void> {
    try {
      await window.electronAPI.terminal.destroyProject(projectId);
      console.log(`[TerminalIPC] Destroyed all terminals for project ${projectId}`);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to destroy project terminals for ${projectId}:`, error);
      throw new Error(`Failed to destroy project terminals: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get information about a terminal session
   * @param sessionId Terminal session ID
   * @returns Promise<TerminalInfo | null>
   */
  async getTerminalInfo(sessionId: string): Promise<TerminalInfo | null> {
    try {
      return await window.electronAPI.terminal.getInfo(sessionId);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to get terminal info for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get all active terminal sessions
   * @returns Promise<TerminalInfo[]>
   */
  async getAllTerminals(): Promise<TerminalInfo[]> {
    try {
      return await window.electronAPI.terminal.getAll();
    } catch (error) {
      console.error('[TerminalIPC] Failed to get all terminals:', error);
      return [];
    }
  }

  /**
   * Get terminals for a specific project
   * @param projectId Project ID
   * @returns Promise<TerminalInfo[]>
   */
  async getProjectTerminals(projectId: string): Promise<TerminalInfo[]> {
    try {
      return await window.electronAPI.terminal.getProject(projectId);
    } catch (error) {
      console.error(`[TerminalIPC] Failed to get terminals for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Add event listener for terminal events
   * @param event Event type ('data', 'exit', 'error', 'destroyed')
   * @param callback Event callback function
   * @returns Cleanup function
   */
  on(event: 'data', callback: (data: TerminalDataEvent) => void): () => void;
  on(event: 'exit', callback: (data: TerminalExitEvent) => void): () => void;
  on(event: 'error', callback: (data: TerminalErrorEvent) => void): () => void;
  on(event: 'destroyed', callback: (data: TerminalDestroyedEvent) => void): () => void;
  on(event: string, callback: Function): () => void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);

    // Return cleanup function
    return () => {
      const currentListeners = this.eventListeners.get(event) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        this.eventListeners.set(event, currentListeners);
      }
    };
  }

  /**
   * Remove event listener
   * @param event Event type
   * @param callback Callback function to remove
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Emit event to all listeners
   * @param event Event type
   * @param data Event data
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[TerminalIPC] Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Get debug information about the service
   * @returns Debug information object
   */
  getDebugInfo() {
    const listenerCounts: { [key: string]: number } = {};
    this.eventListeners.forEach((listeners, event) => {
      listenerCounts[event] = listeners.length;
    });

    return {
      isInitialized: this.isInitialized,
      listenerCounts,
      totalListeners: Array.from(this.eventListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0)
    };
  }
}

// Singleton instance
let terminalService: TerminalIPCService | null = null;

/**
 * Get the singleton terminal service instance
 * @returns TerminalIPCService instance
 */
export function getTerminalService(): TerminalIPCService {
  if (!terminalService) {
    terminalService = new TerminalIPCService();
  }
  return terminalService;
}

/**
 * Clean up terminal service
 */
export function cleanupTerminalService(): void {
  if (terminalService) {
    terminalService.removeAllListeners();
    terminalService = null;
  }
}