import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EventEmitter } from 'events';
import { z } from "zod";

/**
 * Codex MCP Service - Fixed based on working codex-mcp-test patterns
 * 
 * Key fixes:
 * - Uses proper setNotificationHandler with Zod schema (CRITICAL)
 * - Session IDs captured from session_configured notifications
 * - Correct parameter names: sandbox "read-only", approval_policy "on-request"
 * - Event-driven streaming with proper delta handling
 * - Session continuity with codex-reply tool
 */

// Zod schema for codex/event notifications (REQUIRED)
const CodexEventNotificationSchema = z.object({
  method: z.literal("codex/event"),
  params: z.any()
});

class CodexService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.isConnecting = false;
    
    // Session management
    this.sessions = new Map(); // sessionId -> session data
    this.currentSessionId = null;
    
    // Real-time streaming state
    this.eventQueue = [];
    this.streamingState = new Map(); // requestId -> streaming state
    
    console.log('🧠 CodexService initialized (Fixed Version)');
  }

  /**
   * Initialize and connect to Codex MCP with proper notification handler
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

      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: "codex",
        args: ["mcp"]
      });

      // CRITICAL: Use proper setNotificationHandler with Zod schema
      this.client.setNotificationHandler(CodexEventNotificationSchema, (notification) => {
        this.handleCodexEvent(notification);
      });

      // Connect to the MCP server
      await this.client.connect(this.transport);
      
      this.isConnected = true;
      this.isConnecting = false;
      
      console.log('✅ Successfully connected to Codex MCP with proper notification handler');
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
      this.streamingState.clear();
      this.eventQueue = [];
      this.currentSessionId = null;
      
      console.log('👋 Disconnected from Codex MCP');
      this.emit('disconnected');
      
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
    }
  }

  /**
   * Handle codex/event notifications - MAIN EVENT PROCESSOR
   */
  handleCodexEvent(notification) {
    const params = notification.params;
    const event = {
      id: params.id,
      msg: params.msg,
      meta: params._meta || {},
      timestamp: new Date().toISOString()
    };

    this.eventQueue.push(event);

    console.log(`🎯 Received codex/event: ${event.msg.type}`);

    // Process different event types based on test patterns
    switch (event.msg.type) {
      case 'session_configured':
        this.handleSessionConfigured(event);
        break;
        
      case 'task_started':
        this.handleTaskStarted(event);
        break;
        
      case 'agent_reasoning_section_break':
        this.handleReasoningSectionBreak(event);
        break;
        
      case 'agent_reasoning_delta':
        this.handleReasoningDelta(event);
        break;
        
      case 'agent_reasoning':
        this.handleReasoningComplete(event);
        break;
        
      case 'agent_message_delta':
        this.handleMessageDelta(event);
        break;
        
      case 'agent_message':
        this.handleMessageComplete(event);
        break;
        
      case 'token_count':
        this.handleTokenCount(event);
        break;
        
      case 'task_complete':
        this.handleTaskComplete(event);
        break;
        
      default:
        console.log(`🔍 Unhandled event type: ${event.msg.type}`);
        this.emit('unknownEvent', event);
    }
  }

  /**
   * Handle SessionConfigured event - CRITICAL for session tracking
   */
  handleSessionConfigured(event) {
    const sessionId = event.msg.session_id;
    const requestId = event.meta.requestId;
    
    console.log(`🆔 Session configured: ${sessionId}`);
    console.log(`📊 Model: ${event.msg.model}`);
    console.log(`🔗 Request ID: ${requestId}`);
    
    // Store session information
    this.sessions.set(sessionId, {
      sessionId: sessionId,
      model: event.msg.model,
      historyLogId: event.msg.history_log_id,
      historyEntryCount: event.msg.history_entry_count,
      initialMessages: event.msg.initial_messages,
      requestId: requestId,
      createdAt: new Date(),
      lastUsed: new Date(),
      messages: [],
      streamingContent: '',
      reasoningContent: ''
    });

    this.currentSessionId = sessionId;
    console.log(`✅ Session ${sessionId} stored and set as current`);
    
    this.emit('sessionConfigured', {
      sessionId,
      model: event.msg.model,
      requestId
    });
  }

  /**
   * Handle task lifecycle
   */
  handleTaskStarted(event) {
    console.log(`🚀 Task started: ${event.id}`);
    this.emit('taskStarted', { taskId: event.id });
  }

  /**
   * Handle reasoning stream updates
   */
  handleReasoningSectionBreak(event) {
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.reasoningContent += '\n--- New Reasoning Section ---\n';
    }
    this.emit('reasoningSectionBreak', event);
  }

  handleReasoningDelta(event) {
    const delta = event.msg.delta;
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.reasoningContent += delta;
    }
    
    this.emit('reasoningDelta', {
      sessionId: this.currentSessionId,
      delta: delta,
      reasoning: this.sessions.get(this.currentSessionId)?.reasoningContent || ''
    });
  }

  handleReasoningComplete(event) {
    const fullReasoning = event.msg.text;
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.reasoningContent = fullReasoning;
    }
    
    this.emit('reasoningComplete', {
      sessionId: this.currentSessionId,
      reasoning: fullReasoning
    });
  }

  /**
   * Handle message stream updates - CRITICAL for UI
   */
  handleMessageDelta(event) {
    const delta = event.msg.delta;
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.streamingContent += delta;
      session.lastUsed = new Date();
    }
    
    // Emit streaming update for UI
    this.emit('messageStream', {
      sessionId: this.currentSessionId,
      delta: delta,
      content: this.sessions.get(this.currentSessionId)?.streamingContent || ''
    });
  }

  handleMessageComplete(event) {
    const finalMessage = event.msg.message;
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      
      // Store the completed message
      session.messages.push({
        role: 'assistant',
        content: finalMessage,
        timestamp: new Date()
      });
      
      // Clear streaming state
      session.streamingContent = '';
      session.lastUsed = new Date();
    }
    
    console.log(`📤 Message complete: ${finalMessage?.substring(0, 100)}...`);
    
    // Emit completion for UI
    this.emit('messageComplete', {
      sessionId: this.currentSessionId,
      content: finalMessage
    });
  }

  /**
   * Handle token tracking
   */
  handleTokenCount(event) {
    const tokens = event.msg;
    
    console.log(`🪙 Token usage - Input: ${tokens.input_tokens}, Output: ${tokens.output_tokens}`);
    
    this.emit('tokenCount', {
      sessionId: this.currentSessionId,
      inputTokens: tokens.input_tokens,
      outputTokens: tokens.output_tokens,
      totalTokens: tokens.total_tokens
    });
  }

  /**
   * Handle task completion
   */
  handleTaskComplete(event) {
    console.log(`✅ Task completed!`);
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      if (event.msg.last_agent_message) {
        session.messages.push({
          role: 'assistant',
          content: event.msg.last_agent_message,
          timestamp: new Date()
        });
      }
      session.lastUsed = new Date();
    }
    
    this.emit('taskComplete', {
      sessionId: this.currentSessionId,
      lastMessage: event.msg.last_agent_message
    });
  }

  /**
   * Start a new conversation - Fixed parameters
   */
  async startNewSession(prompt, label = null) {
    if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    console.log(`\n📝 Starting new session: "${label || prompt.substring(0, 50)}..."`);
    
    try {
      // Use CORRECT parameter names based on tests
      const response = await this.client.callTool({
        name: "codex",
        arguments: {
          prompt: prompt,
          sandbox: "read-only"  // CORRECT: not "workspace-write"
        }
      });

      // Wait for SessionConfigured event to be processed
      await this.waitForSessionConfigured();

      console.log(`📤 Initial response: ${response.content?.[0]?.text}`);
      
      // Store user message in session
      if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
        const session = this.sessions.get(this.currentSessionId);
        session.messages.unshift({  // Add at beginning
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
      }

      return {
        sessionId: this.currentSessionId,
        response: response.content?.[0]?.text
      };
      
    } catch (error) {
      console.error(`❌ Failed to start session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Continue existing session with codex-reply
   */
  async continueSession(sessionId, prompt) {
    if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const session = this.sessions.get(sessionId);
    console.log(`\n🔄 Continuing session ${sessionId}`);
    console.log(`📅 Last used: ${session.lastUsed.toISOString()}`);
    console.log(`💬 Message history: ${session.messages.length} messages`);

    try {
      // Use codex-reply with session ID
      const response = await this.client.callTool({
        name: "codex-reply",
        arguments: {
          sessionId: sessionId,
          prompt: prompt
        }
      });

      console.log(`📤 Continue response: ${response.content?.[0]?.text}`);
      
      // Update session data
      session.lastUsed = new Date();
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

      return response.content?.[0]?.text;
      
    } catch (error) {
      console.error(`❌ Failed to continue session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for SessionConfigured event
   */
  async waitForSessionConfigured(timeout = 5000) {
    const startTime = Date.now();
    const initialSessionId = this.currentSessionId;
    
    while (Date.now() - startTime < timeout) {
      if (this.currentSessionId && this.currentSessionId !== initialSessionId) {
        return this.currentSessionId;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn(`⚠️  Timeout waiting for SessionConfigured event`);
    return this.currentSessionId;
  }

  /**
   * Session management methods
   */
  listSessions() {
    console.log(`\n📋 Active Sessions (${this.sessions.size}):`);
    if (this.sessions.size === 0) {
      console.log("   (no sessions)");
      return [];
    }

    const sessions = [];
    this.sessions.forEach((session, sessionId) => {
      const isCurrent = sessionId === this.currentSessionId;
      sessions.push({
        sessionId,
        model: session.model,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        messageCount: session.messages.length,
        isCurrent
      });
    });

    return sessions;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getCurrentSession() {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
  }

  /**
   * Connection status
   */
  isReady() {
    return this.isConnected && !this.isConnecting;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      sessionCount: this.sessions.size,
      currentSessionId: this.currentSessionId
    };
  }
}

// Export singleton instance
export const codexService = new CodexService();
export default codexService;