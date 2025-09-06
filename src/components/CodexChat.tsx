import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';
import { codexIPCService, CodexApprovalRequest } from '../services/codexIPC';
import { CodexApprovalDialog } from './CodexApprovalDialog';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface CodexChatProps {
  project: Project;
  onClose?: () => void;
  'data-component'?: string;
}

export const CodexChat = ({ 
  project, 
  onClose,
  'data-component': dataComponent 
}: CodexChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentApproval, setCurrentApproval] = useState<CodexApprovalRequest | null>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<string>('');
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Initialize connection and event listeners
  useEffect(() => {
    let isMounted = true;
    
    const initializeCodex = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        
        // Check connection status first
        const status = await codexIPCService.getStatus();
        
        if (!status.connected) {
          console.log('🔌 Connecting to Codex...');
          const result = await codexIPCService.connect();
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to connect to Codex');
          }
        }
        
        if (isMounted) {
          setIsConnected(true);
          setIsConnecting(false);
          console.log('✅ Codex connected successfully');
        }
        
      } catch (error: any) {
        console.error('❌ Codex connection failed:', error);
        if (isMounted) {
          setError(error.message || 'Failed to connect to AI assistant');
          setIsConnecting(false);
          setIsConnected(false);
        }
      }
    };

    // Set up event listeners
    const unsubscribeConnected = codexIPCService.onConnected(() => {
      if (isMounted) {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        console.log('📡 Codex connected event received');
      }
    });

    const unsubscribeDisconnected = codexIPCService.onDisconnected(() => {
      if (isMounted) {
        setIsConnected(false);
        setCurrentSessionId(null);
        console.log('📡 Codex disconnected event received');
      }
    });

    const unsubscribeError = codexIPCService.onConnectionError((error) => {
      if (isMounted) {
        setError(error.message || 'Connection error');
        setIsConnecting(false);
        setIsConnected(false);
        console.error('📡 Codex connection error:', error);
      }
    });

    // Streaming events
    const unsubscribeStream = codexIPCService.onMessageStream((data) => {
      if (isMounted && data.delta) {
        setStreamingContent(prev => {
          const updated = prev + data.delta;
          streamingContentRef.current = updated;
          return updated;
        });
      }
    });

    const unsubscribeComplete = codexIPCService.onMessageComplete((data) => {
      if (isMounted && data.isFinal) {
        console.log('📡 Final message complete:', data);
        
        // Clear any pending timeout
        if (messageTimeoutRef.current) {
          clearTimeout(messageTimeoutRef.current);
          messageTimeoutRef.current = null;
        }
        
        // Update the last assistant message with the completed content
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            // If we have accumulated streaming content, use that
            // Otherwise use the final message content (for cases where AI starts with tools)
            // This handles both streaming and non-streaming scenarios
            lastMessage.content = streamingContentRef.current || data.content || 'No response received';
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
        
        setStreamingContent(''); // Clear any streaming content
        streamingContentRef.current = '';
        setIsLoading(false);
        setIsWorking(false);
      }
    });

    // Conversation events
    const unsubscribeStarted = codexIPCService.onConversationStarted((data) => {
      if (isMounted) {
        setCurrentSessionId(data.sessionId);
        console.log('📡 Conversation started:', data.sessionId);
      }
    });

    // Approval events
    const unsubscribeApprovalRequest = codexIPCService.onApprovalRequest((approval) => {
      if (isMounted) {
        console.log('📡 Approval request received:', approval);
        setCurrentApproval(approval);
        setIsApprovalDialogOpen(true);
      }
    });

    const unsubscribeApprovalResponse = codexIPCService.onApprovalResponse((data) => {
      if (isMounted) {
        console.log('📡 Approval response:', data);
        // Close dialog after response
        setIsApprovalDialogOpen(false);
        setCurrentApproval(null);
      }
    });

    // Working status listener
    const unsubscribeWorkingStatus = codexIPCService.onWorkingStatus((data) => {
      if (isMounted) {
        console.log('📡 Working status received:', data);
        setIsWorking(data.isWorking);
        setWorkingMessage(data.message || '');
      }
    });

    // Initialize connection
    initializeCodex();

    return () => {
      isMounted = false;
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
      unsubscribeStream();
      unsubscribeComplete();
      unsubscribeStarted();
      unsubscribeApprovalRequest();
      unsubscribeApprovalResponse();
      unsubscribeWorkingStatus();
    };
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !isConnected) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    // Add assistant message placeholder
    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Set a very long fallback timeout (5 minutes) in case messageComplete event doesn't arrive
    messageTimeoutRef.current = setTimeout(() => {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          // Just finalize whatever content we have
          lastMessage.content = streamingContentRef.current || lastMessage.content || '';
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
      setStreamingContent('');
      streamingContentRef.current = '';
      setIsLoading(false);
      setIsWorking(false);
    }, 300000); // 5 minute timeout - essentially never triggers for normal operations

    try {
      let response;
      
      if (!currentSessionId) {
        // Start new conversation with project context
        const projectPrompt = `Project: ${project.name}\nPath: ${project.path || 'Not specified'}\nDescription: ${project.description || 'No description'}\n\nUser request: ${input}`;
        
        response = await codexIPCService.startConversation(projectPrompt, {
          model: 'gpt-5',
          sandbox: 'danger-full-access',
          approvalPolicy: 'untrusted',
          projectContext: {
            name: project.name,
            path: project.path || '',
            description: project.description || ''
          }
        });
        
        if (response.success && response.sessionId) {
          setCurrentSessionId(response.sessionId);
        }
      } else {
        // Continue existing conversation
        response = await codexIPCService.continueConversation(currentSessionId, input);
      }
      
      if (!response.success && response.error) {
        throw new Error(response.error);
      }
      
    } catch (error: any) {
      console.error('❌ Send message error:', error);
      
      // Update the assistant message with error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = `Error: ${error.message || 'Failed to send message'}`;
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetryConnection = () => {
    setError(null);
    setIsConnecting(true);
    // Re-run the connection logic
    window.location.reload(); // Simple retry for now
  };

  // Approval handlers
  const handleApprovalApprove = async (callId: string, feedback?: string) => {
    console.log('Approving request:', callId, feedback);
    const result = await codexIPCService.respondToApproval(callId, 'yes', feedback);
    if (!result.success) {
      console.error('Approval failed:', result.error);
    }
  };

  const handleApprovalDeny = async (callId: string, feedback?: string) => {
    console.log('Denying request:', callId, feedback);
    const result = await codexIPCService.respondToApproval(callId, 'no', feedback);
    if (!result.success) {
      console.error('Denial failed:', result.error);
    }
  };

  const handleApprovalAlways = async (callId: string, feedback?: string) => {
    console.log('Always approving request:', callId, feedback);
    const result = await codexIPCService.respondToApproval(callId, 'always', feedback);
    if (!result.success) {
      console.error('Always approval failed:', result.error);
    }
  };

  const handleApprovalClose = () => {
    setIsApprovalDialogOpen(false);
    setCurrentApproval(null);
  };

  // Loading state
  if (isConnecting) {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        data-component={dataComponent}
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
            style={{ borderColor: 'var(--color-text-primary)' }}
          ></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Connecting to AI assistant...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        data-component={dataComponent}
      >
        <div className="text-center p-8">
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-600 mb-2">AI Assistant Unavailable</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {error}
          </p>
          <button
            onClick={handleRetryConnection}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'var(--color-button-text)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div 
      className="flex flex-col h-full relative"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-component={dataComponent}
      data-project-id={project.id}
    >


      <div 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
        style={{ 
          background: 'linear-gradient(to bottom, var(--color-bg-primary), var(--color-bg-secondary))'
        }}
      >
        {messages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mt-12"
          >
            <motion.div 
              className="mb-6"
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
            >
              <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ 
                opacity: 0.2,
                strokeWidth: 0.5,
                color: 'var(--color-accent-primary)'
              }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </motion.div>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Start a conversation
            </p>
            
            {/* Quick action suggestions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {[
                "Explain the project structure",
                "Show recent changes",
                "Help me debug an issue",
                "Suggest improvements"
              ].map((suggestion, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs rounded-full transition-all"
                  style={{
                    backgroundColor: 'var(--color-surface-primary)',
                    border: '1px solid var(--color-border-secondary)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                className={`max-w-[75%] rounded-lg px-4 py-3 shadow-sm`}
                style={{
                  backgroundColor: message.role === 'user' 
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-surface-primary)',
                  color: message.role === 'user'
                    ? 'var(--color-button-text)'
                    : 'var(--color-text-primary)',
                  border: message.role === 'assistant' 
                    ? '1px solid var(--color-border-primary)'
                    : 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.isStreaming ? (
                    <>
                      {streamingContent ? (
                        <span>{streamingContent}</span>
                      ) : (
                        <motion.div className="flex items-center gap-2">
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Thinking
                          </motion.span>
                          <motion.div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <motion.span
                                key={i}
                                className="w-1 h-1 rounded-full"
                                style={{ backgroundColor: 'var(--color-accent-primary)' }}
                                animate={{ 
                                  y: [0, -4, 0],
                                  opacity: [0.3, 1, 0.3]
                                }}
                                transition={{ 
                                  duration: 1,
                                  repeat: Infinity,
                                  delay: i * 0.2
                                }}
                              />
                            ))}
                          </motion.div>
                        </motion.div>
                      )}
                      {isWorking && workingMessage && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="block mt-2 text-xs"
                          style={{ 
                            color: 'var(--color-text-tertiary)',
                            fontStyle: 'italic'
                          }}
                        >
                          {workingMessage}
                        </motion.span>
                      )}
                    </>
                  ) : (
                    message.content
                  )}
                </div>
                <div
                  className="text-xs mt-2 flex items-center gap-2"
                  style={{
                    color: message.role === 'user' 
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--color-text-tertiary)'
                  }}
                >
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                  {message.role === 'assistant' && !message.isStreaming && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs">Complete</span>
                    </motion.span>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      <div 
        className="border-t"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-secondary)'
        }}
      >
        <div className="p-3">
          <div className="flex items-center gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your project or request changes..."
              disabled={isLoading || !isConnected}
              rows={1}
              className="flex-1 resize-none px-3 py-2 focus:outline-none transition-all text-sm"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-text-primary)',
                opacity: isLoading || !isConnected ? 0.5 : 1,
                cursor: isLoading || !isConnected ? 'not-allowed' : 'text',
                minHeight: '36px',
                maxHeight: '100px'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || !isConnected}
              className="p-2 transition-all"
              style={{
                backgroundColor: 'transparent',
                color: isLoading || !input.trim() || !isConnected
                  ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-secondary)',
                cursor: isLoading || !input.trim() || !isConnected ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() || !isConnected ? 0.3 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading && input.trim() && isConnected) {
                  e.currentTarget.style.color = 'var(--color-accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && input.trim() && isConnected) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
              title="Send message"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {input.length > 0 && (
          <div className="px-3 pb-2 text-xs" style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }}>
            <span>⏎ to send</span>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <CodexApprovalDialog
        approval={currentApproval}
        isOpen={isApprovalDialogOpen}
        onApprove={handleApprovalApprove}
        onDeny={handleApprovalDeny}
        onAlways={handleApprovalAlways}
        onClose={handleApprovalClose}
        data-component="codex-approval-dialog"
      />
    </div>
  );
};