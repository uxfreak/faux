import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';
import { codexIPCService } from '../services/codexIPC';

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<string>('');

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
      if (isMounted) {
        console.log('📡 Message complete:', data);
        
        // Add assistant message to messages array
        if (data.content) {
          const assistantMessage: Message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            isStreaming: false
          };
          
          setMessages(prev => [...prev, assistantMessage]);
          setStreamingContent(''); // Clear any streaming content
          streamingContentRef.current = '';
        }
        
        setIsLoading(false);
      }
    });

    // Conversation events
    const unsubscribeStarted = codexIPCService.onConversationStarted((data) => {
      if (isMounted) {
        setCurrentSessionId(data.sessionId);
        console.log('📡 Conversation started:', data.sessionId);
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

    try {
      let response;
      
      if (!currentSessionId) {
        // Start new conversation with project context
        const projectPrompt = `Project: ${project.name}\nPath: ${project.path || 'Not specified'}\nDescription: ${project.description || 'No description'}\n\nUser request: ${input}`;
        
        response = await codexIPCService.startConversation(projectPrompt, {
          model: 'gpt-5',
          sandbox: 'workspace-write',
          approvalPolicy: 'on-request',
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
    } finally {
      // Finalize streaming after a delay to capture any remaining content
      setTimeout(() => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            lastMessage.content = streamingContentRef.current || lastMessage.content || 'No response received';
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
      }, 1000);
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
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 border-b"
        style={{
          backgroundColor: 'var(--color-surface-primary)',
          borderColor: 'var(--color-border-primary)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              AI Assistant
            </span>
            <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              • {project.name}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs flex items-center" style={{ color: 'var(--color-success)' }}>
              <span 
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: 'var(--color-success)' }}
              ></span>
              Connected
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Close AI assistant"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        {messages.length === 0 && (
          <div className="text-center mt-8" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-lg">AI Assistant Ready</p>
            <p className="text-sm mt-2">Ask questions about your project or request code changes</p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2`}
                style={{
                  backgroundColor: message.role === 'user' 
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-surface-primary)',
                  color: message.role === 'user'
                    ? 'var(--color-button-text)'
                    : 'var(--color-text-primary)',
                  border: message.role === 'assistant' 
                    ? '1px solid var(--color-border-primary)'
                    : 'none'
                }}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.isStreaming ? (
                    <>
                      {streamingContent || (
                        <span className="animate-pulse" style={{ opacity: 0.6 }}>
                          Thinking...
                        </span>
                      )}
                    </>
                  ) : (
                    message.content
                  )}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{
                    color: message.role === 'user' 
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--color-text-tertiary)',
                    opacity: 0.7
                  }}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div 
        className="p-4 border-t"
        style={{
          backgroundColor: 'var(--color-surface-primary)',
          borderColor: 'var(--color-border-primary)'
        }}
      >
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI assistant about your project..."
            disabled={isLoading || !isConnected}
            rows={1}
            className="flex-1 resize-none px-3 py-2 rounded-lg focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              color: 'var(--color-text-primary)',
              opacity: isLoading || !isConnected ? 0.5 : 1,
              cursor: isLoading || !isConnected ? 'not-allowed' : 'text',
              minHeight: '38px',
              maxHeight: '120px'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim() || !isConnected}
            className="px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'var(--color-button-text)',
              opacity: isLoading || !input.trim() || !isConnected ? 0.5 : 1,
              cursor: isLoading || !input.trim() || !isConnected ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim() && isConnected) {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
          >
            {isLoading ? (
              <span className="animate-pulse">...</span>
            ) : (
              'Send'
            )}
          </button>
        </div>
        <div className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};