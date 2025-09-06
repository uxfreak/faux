import { ipcMain } from 'electron';
import codexService from '../services/codexService.js';

/**
 * Codex Manager - Handles main process integration for Codex MCP
 * 
 * This class manages:
 * - IPC communication between renderer and Codex service
 * - Event forwarding from service to renderer
 * - Session lifecycle management
 * - Error handling and recovery
 */
export class CodexManager {
  constructor() {
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.activeWebContents = new Set();
    
    console.log('🧠 CodexManager initialized');
  }

  /**
   * Initialize the Codex manager and set up IPC handlers
   * @param {BrowserWindow} mainWindow - Main application window
   */
  initialize(mainWindow) {
    if (this.isInitialized) {
      return;
    }

    this.mainWindow = mainWindow;
    this.setupIPCHandlers();
    this.setupServiceEventListeners();
    
    this.isInitialized = true;
    console.log('✅ CodexManager initialized');
  }

  /**
   * Set up IPC handlers for communication with renderer process
   */
  setupIPCHandlers() {
    // Connection management
    ipcMain.handle('codex:connect', async () => {
      try {
        await codexService.connect();
        return { success: true };
      } catch (error) {
        console.error('Codex connect error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('codex:disconnect', async () => {
      try {
        await codexService.disconnect();
        return { success: true };
      } catch (error) {
        console.error('Codex disconnect error:', error);
        return { success: true }; // Always return success for disconnect
      }
    });

    ipcMain.handle('codex:getStatus', () => {
      return codexService.getStatus();
    });

    // Session management
    ipcMain.handle('codex:startConversation', async (event, prompt, config = {}) => {
      try {
        const result = await codexService.startNewSession(prompt, config.label || 'New session');
        return result;
      } catch (error) {
        console.error('Start conversation error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('codex:continueConversation', async (event, sessionId, prompt) => {
      try {
        const response = await codexService.continueSession(sessionId, prompt);
        return response;
      } catch (error) {
        console.error('Continue conversation error:', error);
        throw error;
      }
    });

    ipcMain.handle('codex:getSession', (event, sessionId) => {
      return codexService.getSession(sessionId);
    });

    ipcMain.handle('codex:getAllSessions', () => {
      return codexService.listSessions();
    });

    ipcMain.handle('codex:closeSession', (event, sessionId) => {
      try {
        codexService.closeSession(sessionId);
        return { success: true };
      } catch (error) {
        console.error('Close session error:', error);
        return { success: false, error: error.message };
      }
    });

    // Approval handling
    ipcMain.handle('codex:respondToApproval', async (event, callId, decision, feedback) => {
      try {
        const result = await codexService.respondToApproval(callId, decision, feedback);
        return result;
      } catch (error) {
        console.error('Approval response error:', error);
        throw error;
      }
    });

    console.log('📡 Codex IPC handlers registered');
  }

  /**
   * Set up event listeners to forward service events to renderer
   */
  setupServiceEventListeners() {
    // Connection events
    this.addServiceListener('connected', () => {
      this.broadcastToRenderers('codex:connected');
    });

    this.addServiceListener('disconnected', () => {
      this.broadcastToRenderers('codex:disconnected');
    });

    this.addServiceListener('connectionError', (error) => {
      this.broadcastToRenderers('codex:connectionError', error);
    });

    // Conversation events
    this.addServiceListener('conversationStarted', (data) => {
      this.broadcastToRenderers('codex:conversationStarted', data);
    });

    this.addServiceListener('conversationContinued', (data) => {
      this.broadcastToRenderers('codex:conversationContinued', data);
    });

    // Streaming events
    this.addServiceListener('messageStream', (data) => {
      this.broadcastToRenderers('codex:messageStream', data);
    });

    this.addServiceListener('messageComplete', (data) => {
      console.log('📡 Forwarding messageComplete event:', data);
      this.broadcastToRenderers('codex:messageComplete', data);
    });

    // Approval events
    this.addServiceListener('approvalRequest', (approval) => {
      this.broadcastToRenderers('codex:approvalRequest', approval);
    });

    this.addServiceListener('approvalResponse', (data) => {
      this.broadcastToRenderers('codex:approvalResponse', data);
    });

    // Utility events
    this.addServiceListener('tokenUpdate', (data) => {
      this.broadcastToRenderers('codex:tokenUpdate', data);
    });

    this.addServiceListener('taskStart', (data) => {
      this.broadcastToRenderers('codex:taskStart', data);
    });

    this.addServiceListener('taskComplete', (data) => {
      this.broadcastToRenderers('codex:taskComplete', data);
    });

    this.addServiceListener('error', (error) => {
      this.broadcastToRenderers('codex:error', error);
    });

    // Session events
    this.addServiceListener('sessionChanged', (data) => {
      this.broadcastToRenderers('codex:sessionChanged', data);
    });

    this.addServiceListener('sessionClosed', (data) => {
      this.broadcastToRenderers('codex:sessionClosed', data);
    });

    console.log('📡 Codex service event listeners set up');
  }

  /**
   * Add a service event listener and track it for cleanup
   */
  addServiceListener(event, handler) {
    codexService.on(event, handler);
    
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  /**
   * Broadcast event to all active renderer processes
   */
  broadcastToRenderers(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(channel, data);
      } catch (error) {
        console.error(`Failed to broadcast ${channel}:`, error);
      }
    }

    // Also broadcast to any additional web contents
    for (const webContents of this.activeWebContents) {
      if (!webContents.isDestroyed()) {
        try {
          webContents.send(channel, data);
        } catch (error) {
          console.error(`Failed to broadcast ${channel} to webContents:`, error);
          // Remove invalid webContents
          this.activeWebContents.delete(webContents);
        }
      }
    }
  }

  /**
   * Register additional web contents to receive broadcasts
   */
  registerWebContents(webContents) {
    this.activeWebContents.add(webContents);
    
    // Clean up when web contents is destroyed
    webContents.once('destroyed', () => {
      this.activeWebContents.delete(webContents);
    });
  }

  /**
   * Auto-connect to Codex on startup if available
   */
  async autoConnect() {
    try {
      // Check if codex is available
      const status = await codexService.getStatus();
      if (!status.connected) {
        console.log('🔌 Auto-connecting to Codex MCP...');
        await codexService.connect();
      }
    } catch (error) {
      console.warn('⚠️ Auto-connect to Codex failed:', error.message);
      // Don't throw - this is optional functionality
    }
  }

  /**
   * Cleanup method - disconnect service and remove listeners
   */
  async cleanup() {
    console.log('🧹 Cleaning up Codex manager...');

    try {
      // Disconnect from Codex
      await codexService.disconnect();
    } catch (error) {
      console.error('Error disconnecting Codex:', error);
    }

    // Remove all service event listeners
    for (const [event, handlers] of this.eventListeners) {
      for (const handler of handlers) {
        codexService.off(event, handler);
      }
    }
    this.eventListeners.clear();

    // Clear active web contents
    this.activeWebContents.clear();

    // Remove IPC handlers
    ipcMain.removeHandler('codex:connect');
    ipcMain.removeHandler('codex:disconnect');
    ipcMain.removeHandler('codex:getStatus');
    ipcMain.removeHandler('codex:startConversation');
    ipcMain.removeHandler('codex:continueConversation');
    ipcMain.removeHandler('codex:getSession');
    ipcMain.removeHandler('codex:getAllSessions');
    ipcMain.removeHandler('codex:closeSession');
    ipcMain.removeHandler('codex:respondToApproval');

    this.isInitialized = false;
    console.log('✅ Codex manager cleaned up');
  }

  /**
   * Get current status for debugging
   */
  getManagerStatus() {
    return {
      initialized: this.isInitialized,
      serviceStatus: codexService.getStatus(),
      activeWebContents: this.activeWebContents.size,
      eventListeners: Array.from(this.eventListeners.keys())
    };
  }
}

// Create singleton instance
export const codexManager = new CodexManager();

// Helper function to get the manager instance
export const getCodexManager = () => codexManager;

export default codexManager;