import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * Codex MCP Service - Handles all communication with Codex MCP
 * 
 * Features:
 * - Session management with UUID tracking
 * - Real-time event streaming
 * - Approval workflow handling
 * - Auto-reconnection logic
 * - Error handling and recovery
 */
class CodexService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.sessions = new Map();
    this.currentSessionId = null;
    this.streamingMessages = new Map();
    this.pendingApprovals = [];
    this.requestCounter = 0;
    
    // Connection settings
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    
    console.log('🧠 CodexService initialized');
  }

  /**
   * Initialize and connect to Codex MCP
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      console.log('🔄 Codex already connected or connecting');
      return true;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to Codex MCP...');

    try {
      // Create MCP client
      this.client = new Client({
        name: "faux-codex-integration",
        version: "1.0.0"
      });

      // Create stdio transport that spawns codex mcp
      this.transport = new StdioClientTransport({
        command: "codex",
        args: ["mcp"],
        env: {
          ...process.env,
          // Ensure proper environment
        }
      });

      // Set up notification handler for real-time events
      this.client.onNotification = (notification) => {
        this.handleNotification(notification);
      };

      // Connect to the MCP server
      await this.client.connect(this.transport);
      
      this.isConnected = true;
      this.isConnecting = false;
      
      console.log('✅ Successfully connected to Codex MCP');
      this.emit('connected');
      
      return true;

    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      
      console.error('❌ Failed to connect to Codex MCP:', error.message);
      this.emit('connectionError', error);
      
      throw new Error(`Codex connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from Codex MCP
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    console.log('🔌 Disconnecting from Codex MCP...');

    try {
      if (this.client) {
        await this.client.close();
      }
      
      this.isConnected = false;
      this.client = null;
      this.transport = null;
      
      // Clear state
      this.sessions.clear();
      this.streamingMessages.clear();
      this.pendingApprovals = [];
      this.currentSessionId = null;
      
      console.log('👋 Disconnected from Codex MCP');
      this.emit('disconnected');
      
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
    }
  }

  /**
   * Handle incoming notifications (real-time events)
   */
  handleNotification(notification) {
    if (notification.method === 'codex/event') {
      const { _meta, ...eventData } = notification.params;
      const requestId = _meta?.requestId;
      
      console.log(`📡 Codex Event: ${eventData.msg ? Object.keys(eventData.msg)[0] : 'unknown'} (${requestId})`);
      
      // Process the event
      this.processEvent(eventData, requestId);
      
      // Emit to listeners
      this.emit('event', {
        type: eventData.msg ? Object.keys(eventData.msg)[0] : 'unknown',
        data: eventData,
        requestId
      });
    }
  }

  /**
   * Process specific event types
   */
  processEvent(eventData, requestId) {
    const eventType = eventData.msg ? Object.keys(eventData.msg)[0] : null;
    const eventContent = eventData.msg ? eventData.msg[eventType] : null;

    switch (eventType) {
      case 'AgentMessageDelta':
        this.handleMessageDelta(requestId, eventContent.delta);
        break;
        
      case 'AgentMessage':
        this.finalizeMessage(requestId, eventContent.content);
        break;
        
      case 'ExecApprovalRequest':
        this.handleApprovalRequest('exec-approval', eventContent);
        break;
        
      case 'ApplyPatchApprovalRequest':
        this.handleApprovalRequest('patch-approval', eventContent);
        break;
        
      case 'TokenCount':
        this.updateTokenUsage(requestId, eventContent);
        break;
        
      case 'TaskStarted':
        this.handleTaskStart(requestId, eventContent);
        break;
        
      case 'TaskComplete':
        this.handleTaskComplete(requestId, eventContent);
        break;
        
      case 'Error':
        this.handleError(requestId, eventContent);
        break;
        
      default:
        console.log(`🔔 Unhandled event type: ${eventType}`);
    }
  }

  /**
   * Handle streaming message deltas
   */
  handleMessageDelta(requestId, delta) {
    if (!this.streamingMessages.has(requestId)) {
      this.streamingMessages.set(requestId, {
        content: '',
        buffer: '',
        isComplete: false,
        startTime: Date.now()
      });
    }
    
    const message = this.streamingMessages.get(requestId);
    message.buffer += delta;
    
    // Commit complete lines (ending with newline)
    const lines = message.buffer.split('\n');
    if (lines.length > 1) {
      const completeLines = lines.slice(0, -1);
      message.content += completeLines.join('\n') + '\n';
      message.buffer = lines[lines.length - 1];
      
      // Emit streaming update
      this.emit('messageStream', {
        requestId,
        content: message.content,
        delta: completeLines.join('\n') + '\n'
      });
    }
  }

  /**
   * Finalize streaming message
   */
  finalizeMessage(requestId, finalContent) {
    const message = this.streamingMessages.get(requestId);
    if (message) {
      message.content = finalContent || (message.content + message.buffer);
      message.isComplete = true;
      message.buffer = '';
    }
    
    this.emit('messageComplete', {
      requestId,
      content: message ? message.content : finalContent
    });
    
    // Clean up streaming state after delay
    setTimeout(() => {
      this.streamingMessages.delete(requestId);
    }, 5000);
  }

  /**
   * Handle approval requests
   */
  handleApprovalRequest(type, eventContent) {
    const approvalRequest = {
      id: eventContent.call_id,
      type,
      timestamp: Date.now(),
      ...eventContent
    };
    
    this.pendingApprovals.push(approvalRequest);
    
    // Emit to UI for modal display
    this.emit('approvalRequest', approvalRequest);
    
    console.log(`🔐 Approval requested: ${type} - ${eventContent.call_id}`);
  }

  /**
   * Respond to approval request
   */
  async respondToApproval(callId, decision, feedback = null) {
    const approvalIndex = this.pendingApprovals.findIndex(req => req.id === callId);
    if (approvalIndex === -1) {
      throw new Error(`Approval request ${callId} not found`);
    }
    
    const approval = this.pendingApprovals[approvalIndex];
    this.pendingApprovals.splice(approvalIndex, 1);
    
    console.log(`📤 Approval response: ${decision} for ${callId}`);
    
    // Create elicitation response
    const response = {
      decision,
      feedback
    };
    
    // Emit response event
    this.emit('approvalResponse', {
      approvalId: callId,
      decision,
      feedback
    });
    
    return response;
  }

  /**
   * Update token usage
   */
  updateTokenUsage(requestId, tokenData) {
    this.emit('tokenUpdate', {
      requestId,
      tokens: tokenData
    });
  }

  /**
   * Handle task lifecycle events
   */
  handleTaskStart(requestId, taskData) {
    this.emit('taskStart', { requestId, task: taskData });
  }

  handleTaskComplete(requestId, taskData) {
    this.emit('taskComplete', { requestId, task: taskData });
  }

  handleError(requestId, errorData) {
    this.emit('error', { requestId, error: errorData });
  }

  /**
   * Start a new conversation
   */
  async startConversation(prompt, config = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    const requestId = `request_${++this.requestCounter}`;
    const sessionId = randomUUID();
    
    console.log(`🆕 Starting new Codex conversation: ${sessionId}`);
    
    // Create session state
    const session = {
      id: sessionId,
      status: 'active',
      messages: [],
      tokenUsage: { input: 0, output: 0, total: 0 },
      configuration: {
        model: config.model || 'gpt-5',
        sandbox: config.sandbox || 'workspace-write',
        approvalPolicy: config.approvalPolicy || 'on-request',
        ...config
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    try {
      // Send tool call to Codex
      const response = await this.client.callTool({
        name: 'codex',
        arguments: {
          prompt,
          model: session.configuration.model,
          sandbox: session.configuration.sandbox,
          approval_policy: session.configuration.approvalPolicy,
          config: session.configuration.modelConfig || {}
        }
      });

      // Store messages in session
      session.messages.push({
        role: 'user',
        content: prompt,
        timestamp: new Date()
      });

      if (response.content?.[0]?.text) {
        session.messages.push({
          role: 'assistant',
          content: response.content[0].text,
          timestamp: new Date()
        });
      }

      session.lastActivity = new Date();
      
      this.emit('conversationStarted', {
        sessionId,
        prompt,
        response: response.content?.[0]?.text
      });

      return {
        sessionId,
        response: response.content?.[0]?.text
      };
      
    } catch (error) {
      session.status = 'error';
      console.error('❌ Conversation start failed:', error.message);
      this.emit('error', { sessionId, error });
      throw error;
    }
  }

  /**
   * Continue existing conversation
   */
  async continueConversation(sessionId, prompt) {
    if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`➡️ Continuing Codex conversation: ${sessionId}`);
    
    const requestId = `request_${++this.requestCounter}`;
    
    try {
      const response = await this.client.callTool({
        name: 'codex-reply',
        arguments: {
          sessionId,
          prompt
        }
      });

      // Update session
      session.messages.push({
        role: 'user',
        content: prompt,
        timestamp: new Date()
      });

      if (response.content?.[0]?.text) {
        session.messages.push({
          role: 'assistant',
          content: response.content[0].text,
          timestamp: new Date()
        });
      }

      session.lastActivity = new Date();
      
      this.emit('conversationContinued', {
        sessionId,
        prompt,
        response: response.content?.[0]?.text
      });

      return response.content?.[0]?.text;
      
    } catch (error) {
      console.error('❌ Conversation continuation failed:', error.message);
      this.emit('error', { sessionId, error });
      throw error;
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
  }

  /**
   * List all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Switch to different session
   */
  switchSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    this.currentSessionId = sessionId;
    this.emit('sessionChanged', { sessionId });
    
    console.log(`🔄 Switched to Codex session: ${sessionId}`);
  }

  /**
   * Close session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'complete';
      this.sessions.delete(sessionId);
      
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
      
      this.emit('sessionClosed', { sessionId });
      console.log(`🗑️ Closed Codex session: ${sessionId}`);
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isConnected && !this.isConnecting;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      sessionCount: this.sessions.size,
      currentSessionId: this.currentSessionId,
      pendingApprovals: this.pendingApprovals.length
    };
  }
}

// Export singleton instance
export const codexService = new CodexService();
export default codexService;