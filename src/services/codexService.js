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
    this.currentProjectPath = null; // Store current project path
    
    // Real-time streaming state
    this.eventQueue = [];
    this.streamingState = new Map(); // requestId -> streaming state
    
    console.log('🧠 CodexService initialized (Fixed Version)');
  }

  /**
   * Initialize and connect to Codex MCP with proper notification handler
   * @param {string} projectPath - Optional project path to use as working directory
   */
  async connect(projectPath = null) {
    if (this.isConnected || this.isConnecting) {
      console.log('🔄 Codex already connected or connecting');
      return true;
    }

    this.isConnecting = true;
    this.currentProjectPath = projectPath;
    console.log('🔌 Connecting to Codex MCP...');
    if (projectPath) {
      console.log(`📁 Using project directory: ${projectPath}`);
    }

    try {
      // Create MCP client
      this.client = new Client({
        name: "faux-codex-integration",
        version: "1.0.0"
      });

      // Create stdio transport with project path as working directory
      const transportConfig = {
        command: "codex",
        args: ["mcp"]
      };
      
      // Set working directory if project path provided
      if (projectPath) {
        transportConfig.cwd = projectPath;
      }
      
      this.transport = new StdioClientTransport(transportConfig);

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
      this.currentProjectPath = null;
      
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
        
      case 'exec_approval_request':
        this.handleExecApprovalRequest(event);
        break;
        
      case 'apply_patch_approval_request':
        this.handleApplyPatchApprovalRequest(event);
        break;
        
      case 'exec_command_begin':
        this.handleCommandBegin(event);
        break;
        
      case 'exec_command_output_delta':
        this.handleCommandOutputDelta(event);
        break;
        
      case 'exec_command_complete':
      case 'exec_command_end':
        this.handleCommandComplete(event);
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
    
    // Reset working status flags for new task cycle
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.hasEmittedAnalyzing = false;
      session.hasEmittedUpdating = false;
    }
    
    // Emit working indicator when task starts
    this.emit('workingStatus', {
      sessionId: this.currentSessionId,
      isWorking: true,
      message: 'Working on it...'
    });
    
    this.emit('taskStarted', { taskId: event.id });
  }

  /**
   * Handle reasoning stream updates
   */
  handleReasoningSectionBreak(event) {
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.reasoningContent += '\n--- New Reasoning Section ---\n';
      
      // CRITICAL: Reset streaming content when a new loop begins
      // This prevents message accumulation across loops
      if (session.streamingContent && session.streamingContent.length > 0) {
        console.log('🔄 New loop detected - resetting streaming content');
        session.streamingContent = '';
        session.hasEmittedUpdating = false;
      }
    }
    this.emit('reasoningSectionBreak', event);
  }

  handleReasoningDelta(event) {
    const delta = event.msg.delta;
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      session.reasoningContent += delta;
      
      // Emit working status for timeline UI - first reasoning means analyzing
      if (!session.hasEmittedAnalyzing) {
        this.emit('workingStatus', {
          sessionId: this.currentSessionId,
          isWorking: true,
          message: 'Analyzing'
        });
        session.hasEmittedAnalyzing = true;
        
        // Reset streaming content when starting a new reasoning phase
        // This happens when reasoning starts after a message was sent
        if (session.streamingContent && session.streamingContent.length > 0) {
          console.log('🔄 New reasoning phase detected - resetting streaming content');
          session.streamingContent = '';
          session.hasEmittedUpdating = false;
        }
      }
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
      // Reset the analyzing flag after reasoning completes
      // so next reasoning will trigger a new "Analyzing" status
      session.hasEmittedAnalyzing = false;
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
      
      // Emit working status for timeline UI - message means updating/creating
      if (!session.hasEmittedUpdating) {
        this.emit('workingStatus', {
          sessionId: this.currentSessionId,
          isWorking: true,
          message: 'Updating'
        });
        session.hasEmittedUpdating = true;
      }
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
    
    console.log(`📤 Message complete (intermediate): ${finalMessage?.substring(0, 100)}...`);
    
    // IMPORTANT: agent_message events are intermediate states from the agent
    // They are NOT meant to be displayed to the user
    // We should ONLY show content from:
    // 1. agent_message_delta events (for real streaming)
    // 2. task_complete event (for the final message)
    
    // Do NOT emit any events here - these are internal agent states
    // that would cause message accumulation if shown
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
    console.log(`📝 Last message: ${event.msg.last_agent_message?.substring(0, 100)}...`);
    
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      
      // Store the final complete message from task_complete
      const finalContent = event.msg.last_agent_message || session.streamingContent || '';
      
      // Clear the streaming state and flags
      session.streamingContent = '';
      session.hasEmittedAnalyzing = false;
      session.hasEmittedUpdating = false;
      session.lastUsed = new Date();
    }
    
    // Clear working status BEFORE emitting message complete
    this.emit('workingStatus', {
      sessionId: this.currentSessionId,
      isWorking: false,
      message: ''
    });
    
    // Emit final message complete with the full message
    // This is the ONLY place we finalize the message
    this.emit('messageComplete', {
      sessionId: this.currentSessionId,
      content: event.msg.last_agent_message,
      isFinal: true
    });
    
    this.emit('taskComplete', {
      sessionId: this.currentSessionId,
      lastMessage: event.msg.last_agent_message
    });
  }

  /**
   * Handle execution approval requests - CRITICAL for tool execution
   */
  handleExecApprovalRequest(event) {
    console.log(`🤔 Execution approval request received: ${event.msg.type}`);
    console.log(`📋 Command: ${event.msg.command?.join(' ') || 'unknown'}`);
    console.log(`📁 Working directory: ${event.msg.cwd || 'unknown'}`);
    console.log(`📄 Reason: ${event.msg.reason || 'No reason provided'}`);
    
    const approval = {
      id: event.msg.call_id || event.id,  // Use call_id if available
      sessionId: this.currentSessionId,
      type: 'exec-approval',
      timestamp: new Date(),
      command: event.msg.command,
      cwd: event.msg.cwd,
      description: event.msg.reason || 'Command execution request',
      metadata: event.msg
    };
    
    // Store pending approval
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      if (!session.pendingApprovals) {
        session.pendingApprovals = new Map();
      }
      session.pendingApprovals.set(approval.id, approval);
    }
    
    this.emit('approvalRequest', approval);
  }

  /**
   * Handle patch approval requests
   */
  handleApplyPatchApprovalRequest(event) {
    console.log(`🤔 Patch approval request received: ${event.msg.type}`);
    console.log(`📄 Changes: ${JSON.stringify(event.msg.changes, null, 2)}`);
    console.log(`📄 Reason: ${event.msg.reason || 'No reason provided'}`);
    
    const approval = {
      id: event.msg.call_id || event.id,  // Use call_id if available
      sessionId: this.currentSessionId,
      type: 'patch-approval',
      timestamp: new Date(),
      command: ['patch', 'apply'],  // Represent as command array
      cwd: event.msg.cwd,
      description: event.msg.reason || 'File patch application request',
      metadata: {
        ...event.msg,
        changes: event.msg.changes,
        grantRoot: event.msg.grant_root
      }
    };
    
    // Store pending approval
    if (this.currentSessionId && this.sessions.has(this.currentSessionId)) {
      const session = this.sessions.get(this.currentSessionId);
      if (!session.pendingApprovals) {
        session.pendingApprovals = new Map();
      }
      session.pendingApprovals.set(approval.id, approval);
    }
    
    this.emit('approvalRequest', approval);
  }

  /**
   * Start a new conversation - Fixed parameters
   * @param {string} prompt - The prompt to send
   * @param {string} label - Optional label for the session
   * @param {string} projectPath - Optional project path to set as working directory
   */
  async startNewSession(prompt, label = null, projectPath = null) {
    // If we have a new project path and not connected, or different project, reconnect
    if (projectPath && (!this.isConnected || this.currentProjectPath !== projectPath)) {
      console.log(`🔄 Switching to project: ${projectPath}`);
      await this.disconnect();
      await this.connect(projectPath);
    } else if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    console.log(`\n📝 Starting new session: "${label || prompt.substring(0, 50)}..."`)
    if (this.currentProjectPath) {
      console.log(`📁 Working in: ${this.currentProjectPath}`);
    }
    
    try {
      // Use CORRECT parameter names based on tests
      const response = await this.client.callTool({
        name: "codex",
        arguments: {
          prompt: prompt,
          model: "gpt-5",  // Using gpt-5 model
          sandbox: "danger-full-access",  // Full access with approval for unsafe commands
          approval_policy: "untrusted"  // Triggers approval for unsafe operations
        }
      }, undefined, {
        timeout: 300000,              // 5 minutes instead of default 60 seconds
        resetTimeoutOnProgress: true  // Reset timeout on progress events
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
   * Handle command execution events
   */
  handleCommandBegin(event) {
    console.log(`🚀 Command execution started: ${event.msg.command?.join(' ') || 'unknown command'}`);
    console.log(`📁 Working directory: ${event.msg.cwd || 'unknown'}`);
    
    // Emit working indicator for tool execution
    this.emit('workingStatus', {
      sessionId: this.currentSessionId,
      isWorking: true,
      message: 'Working on it...'
    });
    
    this.emit('commandBegin', {
      sessionId: this.currentSessionId,
      command: event.msg.command,
      cwd: event.msg.cwd,
      commandId: event.id
    });
  }

  handleCommandOutputDelta(event) {
    const output = event.msg.output || event.msg.delta || '';
    
    this.emit('commandOutput', {
      sessionId: this.currentSessionId,
      commandId: event.id,
      output: output,
      isError: event.msg.is_error || false
    });
  }

  handleCommandComplete(event) {
    console.log(`✅ Command execution completed with exit code: ${event.msg.exit_code || 'unknown'}`);
    
    this.emit('commandComplete', {
      sessionId: this.currentSessionId,
      commandId: event.id,
      exitCode: event.msg.exit_code,
      finalOutput: event.msg.final_output
    });
  }

  /**
   * Respond to approval request
   */
  async respondToApproval(callId, decision, feedback) {
    if (!this.isConnected) {
      throw new Error('Not connected to Codex MCP');
    }

    console.log(`📋 Responding to approval ${callId}: ${decision}`);
    if (feedback) {
      console.log(`💬 Feedback: ${feedback}`);
    }

    try {
      // Try sending approval response as notification instead of tool call
      await this.client.sendNotification({
        method: 'approval/response',
        params: {
          call_id: callId,
          decision: decision,
          feedback: feedback || ''
        }
      });

      console.log(`✅ Approval response sent as notification`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to send approval notification: ${error.message}`);
      
      // Fallback: just log the approval without sending
      console.log(`📋 Approval decision recorded locally: ${decision} for ${callId}`);
      return { success: false, error: error.message };
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
    
    // Set as current session
    this.currentSessionId = sessionId;
    
    // Reset streaming content for new message
    session.streamingContent = '';
    session.reasoningContent = '';

    try {
      // Use codex-reply with session ID
      const response = await this.client.callTool({
        name: "codex-reply",
        arguments: {
          sessionId: sessionId,
          prompt: prompt
        }
      }, undefined, {
        timeout: 300000,              // 5 minutes instead of default 60 seconds
        resetTimeoutOnProgress: true  // Reset timeout on progress events
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