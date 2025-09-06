/**
 * Codex IPC Service - Bridge between renderer and main process for Codex MCP
 */

// Renderer side service - communicates with main process via IPC
let ipcService: any = null;

// Define types for IPC communication
export interface CodexSession {
  sessionId: string;
  projectId?: string;
  projectPath?: string;
  isActive: boolean;
  messageCount: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface CodexMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface CodexStreamingEvent {
  sessionId: string;
  requestId: string;
  content: string;
  delta?: string;
  isComplete?: boolean;
}

export interface CodexApprovalRequest {
  id: string;
  sessionId: string;
  type: 'exec-approval' | 'patch-approval';
  timestamp: Date;
  command?: string[];
  cwd?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CodexTokenUsage {
  sessionId: string;
  requestId: string;
  tokens: {
    input?: number;
    output?: number;
    total?: number;
  };
}

export interface CodexError {
  sessionId: string;
  requestId?: string;
  message: string;
  code?: string;
  stack?: string;
}

// Initialize IPC service - handle Electron vs Web environment
function getIPCService() {
  if (ipcService) return ipcService;

  // Check if we're in Electron
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // Electron environment
    const electronAPI = (window as any).electronAPI;
    
    ipcService = {
      // Core connection methods
      connect: () => electronAPI.codex.connect(),
      disconnect: () => electronAPI.codex.disconnect(),
      getStatus: () => electronAPI.codex.getStatus(),
      
      // Session management
      startConversation: (prompt: string, config?: any) => 
        electronAPI.codex.startConversation(prompt, config),
      continueConversation: (sessionId: string, prompt: string) => 
        electronAPI.codex.continueConversation(sessionId, prompt),
      getSession: (sessionId: string) => 
        electronAPI.codex.getSession(sessionId),
      getAllSessions: () => 
        electronAPI.codex.getAllSessions(),
      closeSession: (sessionId: string) => 
        electronAPI.codex.closeSession(sessionId),
      
      // Approval handling
      respondToApproval: (callId: string, decision: string, feedback?: string) =>
        electronAPI.codex.respondToApproval(callId, decision, feedback),
      
      // Event listeners - use the specific codex event handlers
      on: (channel: string, callback: Function) => {
        switch (channel) {
          case 'connected':
            return electronAPI.onCodexConnected(callback);
          case 'disconnected':
            return electronAPI.onCodexDisconnected(callback);
          case 'connectionError':
            return electronAPI.onCodexConnectionError(callback);
          case 'messageStream':
            return electronAPI.onCodexMessageStream(callback);
          case 'messageComplete':
            return electronAPI.onCodexMessageComplete(callback);
          case 'conversationStarted':
            return electronAPI.onCodexConversationStarted(callback);
          case 'conversationContinued':
            return electronAPI.onCodexConversationContinued(callback);
          case 'approvalRequest':
            return electronAPI.onCodexApprovalRequest(callback);
          case 'approvalResponse':
            return electronAPI.onCodexApprovalResponse(callback);
          case 'workingStatus':
            return electronAPI.onCodexWorkingStatus(callback);
          case 'tokenUpdate':
            return electronAPI.onCodexTokenUpdate(callback);
          case 'error':
            return electronAPI.onCodexError(callback);
          default:
            console.warn(`Unknown codex event channel: ${channel}`);
            return () => {}; // Return empty cleanup function
        }
      },
      
      off: (channel: string, callback: Function) => {
        // The event listeners return cleanup functions, so we don't need an off method
        console.warn('codexIPC.off() is deprecated - use the cleanup function returned by on()');
      }
    };
  } else {
    // Web environment - create mock service
    console.warn('Codex IPC: Running in web environment, using mock service');
    
    ipcService = {
      connect: () => Promise.resolve({ success: false, error: 'Codex not available in web environment' }),
      disconnect: () => Promise.resolve({ success: true }),
      getStatus: () => Promise.resolve({ connected: false, error: 'Web environment' }),
      startConversation: () => Promise.resolve({ error: 'Codex not available in web environment' }),
      continueConversation: () => Promise.resolve({ error: 'Codex not available in web environment' }),
      getSession: () => Promise.resolve(null),
      getAllSessions: () => Promise.resolve([]),
      closeSession: () => Promise.resolve({ success: true }),
      respondToApproval: () => Promise.resolve({ success: false }),
      on: () => () => {}, // Return empty unsubscribe function
      off: () => {}
    };
  }
  
  return ipcService;
}

/**
 * Main Codex IPC Service Class
 */
export class CodexIPCService {
  private ipc: any;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.ipc = getIPCService();
  }

  /**
   * Connect to Codex MCP
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.ipc.connect();
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from Codex MCP
   */
  async disconnect(): Promise<{ success: boolean }> {
    try {
      await this.ipc.disconnect();
      return { success: true };
    } catch (error) {
      console.error('Codex disconnect error:', error);
      return { success: true }; // Always succeed on disconnect
    }
  }

  /**
   * Get Codex connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    connecting?: boolean;
    sessionCount?: number;
    currentSessionId?: string;
    pendingApprovals?: number;
  }> {
    try {
      return await this.ipc.getStatus();
    } catch (error) {
      console.error('Codex status error:', error);
      return { connected: false };
    }
  }

  /**
   * Start a new conversation
   */
  async startConversation(
    prompt: string, 
    config: {
      model?: string;
      sandbox?: string;
      approvalPolicy?: string;
      projectContext?: {
        name: string;
        path: string;
        description?: string;
      };
    } = {}
  ): Promise<{
    success: boolean;
    sessionId?: string;
    response?: string;
    error?: string;
  }> {
    try {
      const result = await this.ipc.startConversation(prompt, config);
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Continue existing conversation
   */
  async continueConversation(
    sessionId: string, 
    prompt: string
  ): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    try {
      const response = await this.ipc.continueConversation(sessionId, prompt);
      return { success: true, response };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string): Promise<CodexSession | null> {
    try {
      return await this.ipc.getSession(sessionId);
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<CodexSession[]> {
    try {
      return await this.ipc.getAllSessions();
    } catch (error) {
      console.error('Get all sessions error:', error);
      return [];
    }
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      await this.ipc.closeSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Close session error:', error);
      return { success: false };
    }
  }

  /**
   * Respond to approval request
   */
  async respondToApproval(
    callId: string, 
    decision: 'yes' | 'no' | 'always', 
    feedback?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ipc.respondToApproval(callId, decision, feedback);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Event subscription methods
   */

  /**
   * Subscribe to connection events
   */
  onConnected(callback: () => void): () => void {
    return this.on('connected', callback);
  }

  onDisconnected(callback: () => void): () => void {
    return this.on('disconnected', callback);
  }

  onConnectionError(callback: (error: any) => void): () => void {
    return this.on('connectionError', callback);
  }

  /**
   * Subscribe to conversation events
   */
  onConversationStarted(callback: (data: { sessionId: string; prompt: string; response?: string }) => void): () => void {
    return this.on('conversationStarted', callback);
  }

  onConversationContinued(callback: (data: { sessionId: string; prompt: string; response?: string }) => void): () => void {
    return this.on('conversationContinued', callback);
  }

  /**
   * Subscribe to streaming events
   */
  onMessageStream(callback: (data: CodexStreamingEvent) => void): () => void {
    return this.on('messageStream', callback);
  }

  onMessageComplete(callback: (data: { requestId: string; content: string }) => void): () => void {
    return this.on('messageComplete', callback);
  }

  /**
   * Subscribe to approval events
   */
  onApprovalRequest(callback: (approval: CodexApprovalRequest) => void): () => void {
    return this.on('approvalRequest', callback);
  }

  onApprovalResponse(callback: (data: { approvalId: string; decision: string; feedback?: string }) => void): () => void {
    return this.on('approvalResponse', callback);
  }

  onWorkingStatus(callback: (data: { sessionId: string | null; isWorking: boolean; message: string }) => void): () => void {
    return this.on('workingStatus', callback);
  }

  /**
   * Subscribe to utility events
   */
  onTokenUpdate(callback: (data: CodexTokenUsage) => void): () => void {
    return this.on('tokenUpdate', callback);
  }

  onError(callback: (error: CodexError) => void): () => void {
    return this.on('error', callback);
  }

  /**
   * Generic event subscription
   */
  on(event: string, callback: Function): () => void {
    // Add to local listeners for cleanup tracking
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);

    // Subscribe via IPC
    const unsubscribe = this.ipc.on(event, callback);

    // Return unsubscribe function
    return () => {
      unsubscribe();
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.ipc.off(event, callback);
    
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    for (const [event, listeners] of this.eventListeners) {
      for (const listener of listeners) {
        this.ipc.off(event, listener);
      }
    }
    this.eventListeners.clear();
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.removeAllListeners();
  }
}

// Create singleton service
export const codexIPCService = new CodexIPCService();

// Helper function for components
export const getCodexService = () => codexIPCService;

export default codexIPCService;