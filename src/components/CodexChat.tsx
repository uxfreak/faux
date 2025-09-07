import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Project } from '../types/Project';
import { codexIPCService, CodexApprovalRequest } from '../services/codexIPC';
import { CodexApprovalDialog } from './CodexApprovalDialog';
import { audioService } from '../services/audioService';

interface LoopState {
  id: string;
  status: string | null;
  message: string;
  isStreaming: boolean;
  phase: 'thinking' | 'executing' | 'messaging' | 'idle';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachedImages?: AttachedImage[]; // Track images in messages
  steps?: AgentStep[]; // Track agent reasoning phases
}

interface AttachedImage {
  id: string;
  path: string;
  thumbnail: string;
  name: string;
  size: number;
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
  const [sessionRestored, setSessionRestored] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [currentLoop, setCurrentLoop] = useState<LoopState>({
    id: '',
    status: null,
    message: '',
    isStreaming: false,
    phase: 'idle'
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const previousPhaseRef = useRef<string>('idle');
  const usedThinkingVariants = useRef<Set<string>>(new Set());
  const usedExecutingVariants = useRef<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<string>('');
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedSession = useRef(false);

  // Helper functions for status variants
  const getThinkingVariant = (): string => {
    const variants = [
      'Analyzing', 'Thinking', 'Reviewing', 'Considering',
      'Planning', 'Studying', 'Evaluating', 'Processing'
    ];
    
    const available = variants.filter(v => !usedThinkingVariants.current.has(v));
    if (available.length === 0) {
      usedThinkingVariants.current.clear();
      return variants[0];
    }
    
    const selected = available[Math.floor(Math.random() * available.length)];
    usedThinkingVariants.current.add(selected);
    return selected;
  };

  const getExecutingVariant = (): string => {
    const variants = [
      'Updating', 'Implementing', 'Modifying', 'Applying',
      'Building', 'Creating', 'Adjusting', 'Refining'
    ];
    
    const available = variants.filter(v => !usedExecutingVariants.current.has(v));
    if (available.length === 0) {
      usedExecutingVariants.current.clear();
      return variants[0];
    }
    
    const selected = available[Math.floor(Math.random() * available.length)];
    usedExecutingVariants.current.add(selected);
    return selected;
  };

  // Loop management functions
  const startNewLoop = () => {
    const newLoopId = `loop-${Date.now()}`;
    setCurrentLoop({
      id: newLoopId,
      status: null,
      message: '',
      isStreaming: false,
      phase: 'idle'
    });
    // Reset streaming content for new loop
    setStreamingContent('');
    streamingContentRef.current = '';
  };

  const updateLoopStatus = (status: string, phase: 'thinking' | 'executing') => {
    setCurrentLoop(prev => ({
      ...prev,
      status,
      message: '',
      phase,
      isStreaming: false
    }));
  };

  const clearLoopStatus = () => {
    setCurrentLoop(prev => ({
      ...prev,
      status: null,
      phase: 'messaging'
    }));
  };

  const updateLoopMessage = (content: string, isStreaming: boolean) => {
    setCurrentLoop(prev => ({
      ...prev,
      message: content,
      isStreaming,
      phase: 'messaging'
    }));
  };

  // Save session data to localStorage
  const saveSessionData = (messagesToSave?: Message[]) => {
    if (currentSessionId && project.id) {
      // Use provided messages or current state
      const finalMessages = messagesToSave || messages;
      
      // If the last message is still streaming, incorporate the streaming content
      const processedMessages = finalMessages.map((msg, idx) => {
        if (idx === finalMessages.length - 1 && msg.role === 'assistant' && msg.isStreaming) {
          // Incorporate any streaming content into the message before saving
          return {
            ...msg,
            content: streamingContentRef.current || msg.content,
            isStreaming: false // Mark as complete for saved version
          };
        }
        return msg;
      });
      
      const sessionData = {
        sessionId: currentSessionId,
        messages: processedMessages,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`codex_session_${project.id}`, JSON.stringify(sessionData));
      console.log(`💾 Saved session with ${processedMessages.length} messages`);
    }
  };

  // Load session data from localStorage
  const loadSessionData = async () => {
    if (project.id && !hasLoadedSession.current) {
      const savedData = localStorage.getItem(`codex_session_${project.id}`);
      if (savedData) {
        try {
          const sessionData = JSON.parse(savedData);
          // Check if session is less than 24 hours old
          const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
          if (sessionAge < 24 * 60 * 60 * 1000) { // 24 hours in milliseconds
            // First check if the session still exists on the backend
            const session = await codexIPCService.getSession(sessionData.sessionId);
            if (session) {
              // Session still exists, restore it
              setCurrentSessionId(sessionData.sessionId);
              setMessages(sessionData.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              })));
              hasLoadedSession.current = true;
              setSessionRestored(true);
              // Hide the restored notification after 3 seconds
              setTimeout(() => setSessionRestored(false), 3000);
              console.log(`🔄 Restored session ${sessionData.sessionId} for project ${project.name}`);
              return true;
            } else {
              // Session no longer exists, clear the saved data
              localStorage.removeItem(`codex_session_${project.id}`);
              console.log('⚠️ Saved session no longer exists, starting fresh');
            }
          } else {
            // Session is too old, clear it
            localStorage.removeItem(`codex_session_${project.id}`);
            console.log('⏰ Session expired, starting fresh');
          }
        } catch (error) {
          console.error('Error loading session data:', error);
          localStorage.removeItem(`codex_session_${project.id}`);
        }
      }
    }
    return false;
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Save session when messages change (but not while streaming)
  useEffect(() => {
    if (messages.length > 0 && currentSessionId) {
      // Only save if the last message is not streaming
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.isStreaming) {
        saveSessionData(messages);
      }
    }
  }, [messages, currentSessionId]);

  // Initialize connection and event listeners
  useEffect(() => {
    let isMounted = true;
    
    const initializeCodex = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        
        // Try to load existing session first
        const sessionLoaded = await loadSessionData();
        
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
          
          if (sessionLoaded) {
            console.log('📚 Previous session restored');
          }
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
          // Update loop message while streaming
          updateLoopMessage(updated, true);
          previousPhaseRef.current = 'messaging';
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
        
        // Get the final content
        const finalContent = streamingContentRef.current || data.content || 'No response received';
        
        // If this is the final task_complete message, add to permanent messages
        if (data.isFinal) {
          // Create the final assistant message
          const assistantMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: finalContent,
            timestamp: new Date(),
            isStreaming: false
          };
          
          setMessages(prev => {
            const newMessages = [...prev, assistantMessage];
            saveSessionData(newMessages);
            return newMessages;
          });
          
          // Clear the loop completely
          setCurrentLoop({
            id: '',
            status: null,
            message: '',
            isStreaming: false,
            phase: 'idle'
          });
        } else {
          // Just a loop message complete, keep it in currentLoop
          updateLoopMessage(finalContent, false);
        }
        
        // Clear streaming state
        setStreamingContent('');
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

    // Working status listener - simplified for live status display
    const unsubscribeWorkingStatus = codexIPCService.onWorkingStatus((data) => {
      if (isMounted) {
        console.log('📡 Working status received:', data);
        setIsWorking(data.isWorking);
        setWorkingMessage(data.message || '');
        
        if (data.isWorking && data.message && !data.message.toLowerCase().includes('working on it')) {
          const message = data.message.toLowerCase();
          
          // Detect phase and update status
          if (message.includes('analyz') || message.includes('consider') || 
              message.includes('plan') || message.includes('review') || 
              message.includes('study') || message.includes('think') ||
              message.includes('understand') || message.includes('evaluat')) {
            
            // Check for new loop (thinking after messaging)
            if (previousPhaseRef.current === 'messaging') {
              startNewLoop();
            }
            
            updateLoopStatus(getThinkingVariant(), 'thinking');
            previousPhaseRef.current = 'thinking';
            
          } else if (message.includes('updat') || message.includes('modif') || 
                     message.includes('adjust') || message.includes('apply') || 
                     message.includes('implement') || message.includes('chang') ||
                     message.includes('creat') || message.includes('generat') ||
                     message.includes('build') || message.includes('mak')) {
            
            updateLoopStatus(getExecutingVariant(), 'executing');
            previousPhaseRef.current = 'executing';
          }
        } else if (!data.isWorking) {
          // Clear status when not working
          if (currentLoop.phase === 'thinking' || currentLoop.phase === 'executing') {
            clearLoopStatus();
          }
        }
      }
    });

    // Initialize connection
    initializeCodex();

    return () => {
      isMounted = false;
      
      // Save session on unmount with current streaming content incorporated
      if (currentSessionId && project.id) {
        const finalMessages = messages.map((msg, idx) => {
          if (idx === messages.length - 1 && msg.role === 'assistant' && msg.isStreaming) {
            return {
              ...msg,
              content: streamingContentRef.current || msg.content,
              isStreaming: false
            };
          }
          return msg;
        });
        saveSessionData(finalMessages);
      }
      
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

  // Helper function to wrap prompts for designer-friendly responses
  const wrapPromptForDesigner = (prompt: string): string => {
    return `${prompt}

🎨 YOU ARE A PROTOTYPING AGENT collaborating with a UX designer:

Your role is to be their technical partner who brings their design visions to life in the prototype. You will actively make changes to the project based on their requests, but communicate like a fellow designer, not a developer.

CRITICAL INSTRUCTIONS:

✅ WHAT YOU SHOULD DO:
- Actually implement and update the prototype based on their requests
- Make real changes to improve the user experience
- Iterate on the design by modifying the project
- Test and validate that changes work properly
- Be proactive in suggesting design improvements

✅ HOW TO COMMUNICATE:
- Talk like a design collaborator, not a developer
- Describe what you're doing in visual and experiential terms
- Say things like "I'll update the navigation to be more intuitive" not "I'll modify the Nav component"
- Focus on outcomes: "The form now has better visual hierarchy with clearer labels"
- Use design language: spacing, hierarchy, flow, interaction patterns, visual feedback
- Celebrate design wins: "Great idea! This will make the experience much smoother"

❌ NEVER IN YOUR MESSAGES:
- Show any code snippets or technical syntax
- Mention file names, functions, or technical terms
- Explain HOW you're implementing (just WHAT the user will see)
- Use developer jargon (components, props, state, API, etc.)
- Talk about technical constraints unless absolutely necessary (and then frame it in design terms)

EXAMPLES OF GOOD RESPONSES:
- "I've updated the navigation - it now stays visible when scrolling and has a subtle shadow for better depth"
- "The form validation now shows friendly messages right below each field with a gentle fade-in animation"
- "I've reorganized the dashboard cards to follow a clear visual hierarchy with the most important metrics at the top"

Remember: You're a prototyping partner who makes things happen while speaking the designer's language. Be enthusiastic about design improvements and always frame your work in terms of user experience.`;
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0) || isLoading || !isConnected) return;

    // Build the message content with attached images
    let messageContent = input;
    const currentAttachedImages = [...attachedImages]; // Copy current attachments
    
    if (currentAttachedImages.length > 0) {
      messageContent += '\n\nAttached images:';
      currentAttachedImages.forEach((img, idx) => {
        messageContent += `\n- Image ${idx + 1}: ${img.path}`;
      });
      console.log('📎 Images attached to prompt:', currentAttachedImages.map(img => img.path));
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input, // Show only the text in the UI
      timestamp: new Date(),
      attachedImages: currentAttachedImages // Include images in message
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImages([]); // Clear attachments immediately
    setIsLoading(true);
    setStreamingContent('');
    streamingContentRef.current = '';
    
    // Reset textarea height after sending
    if (inputRef.current) {
      inputRef.current.style.height = '36px';
    }

    // Don't add a message placeholder anymore - we'll use currentLoop for display
    // and only add the final message when complete
    
    // Reset current loop for new message
    setCurrentLoop({
      id: `loop-${Date.now()}`,
      status: null,
      message: '',
      isStreaming: false,
      phase: 'idle'
    });

    // Set a very long fallback timeout (5 minutes) in case messageComplete event doesn't arrive
    messageTimeoutRef.current = setTimeout(() => {
      // Create a timeout message if we never got a proper response
      const timeoutContent = streamingContentRef.current || currentLoop.message || 'Response timed out';
      if (timeoutContent) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: timeoutContent,
          timestamp: new Date(),
          isStreaming: false
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
      
      // Clear the loop
      setCurrentLoop({
        id: '',
        status: null,
        message: '',
        isStreaming: false,
        phase: 'idle'
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
        const basePrompt = `Project: ${project.name}\nPath: ${project.path || 'Not specified'}\nDescription: ${project.description || 'No description'}\n\nUser request: ${messageContent}`;
        const designerPrompt = wrapPromptForDesigner(basePrompt);
        
        response = await codexIPCService.startConversation(designerPrompt, {
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
        // Continue existing conversation with designer context
        const designerPrompt = wrapPromptForDesigner(messageContent);
        response = await codexIPCService.continueConversation(currentSessionId, designerPrompt);
      }
      
      // Attachments already cleared above
      
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

  const handleClearSession = async () => {
    if (project.id) {
      localStorage.removeItem(`codex_session_${project.id}`);
      setMessages([]);
      
      // Close the session on backend if it exists
      if (currentSessionId) {
        await codexIPCService.closeSession(currentSessionId);
      }
      
      setCurrentSessionId(null);
      hasLoadedSession.current = false;
      console.log('🗑️ Session cleared for project', project.name);
    }
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

  // Image handling functions
  const processImageFile = async (file: File): Promise<AttachedImage | null> => {
    if (!file.type.startsWith('image/')) {
      console.error('Not an image file:', file.type);
      return null;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('Image too large:', file.size);
      return null;
    }

    setIsProcessingImage(true);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Save image via IPC
      const result = await codexIPCService.saveImage(
        project.path,
        base64,
        file.name,
        false
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to save image');
      }

      return {
        id: `img-${Date.now()}-${Math.random()}`,
        path: result.path!,
        thumbnail: result.thumbnail!,
        name: result.name!,
        size: result.size!
      };
    } catch (error) {
      console.error('Error processing image:', error);
      return null;
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: AttachedImage[] = [];
    
    for (const file of Array.from(files)) {
      const processedImage = await processImageFile(file);
      if (processedImage) {
        newImages.push(processedImage);
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages]);
      // Refocus input after file selection
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const processedImage = await processImageFile(file);
          if (processedImage) {
            setAttachedImages(prev => [...prev, processedImage]);
            // Refocus the input after processing the image
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }
        }
      }
    }
  };

  // Audio recording handlers
  const startRecording = async () => {
    try {
      await audioService.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Update duration every second
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Store interval ID for cleanup
      (window as any).recordingInterval = interval;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      // Clear duration interval
      if ((window as any).recordingInterval) {
        clearInterval((window as any).recordingInterval);
        delete (window as any).recordingInterval;
      }
      
      setIsRecording(false);
      setIsTranscribing(true);
      
      const audioBlob = await audioService.stopRecording();
      
      // Transcribe the audio
      const transcription = await audioService.transcribeAudio(audioBlob);
      
      // Add transcribed text to input
      setInput(prev => {
        const newText = prev ? `${prev} ${transcription}` : transcription;
        return newText;
      });
      
      // Auto-resize textarea if multiline and focus
      setTimeout(() => {
        if (inputRef.current) {
          // Reset and recalculate height for multiline text
          inputRef.current.style.height = '36px';
          const scrollHeight = inputRef.current.scrollHeight;
          inputRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
          
          // Focus and move cursor to end
          inputRef.current.focus();
          inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = () => {
    // Clear duration interval
    if ((window as any).recordingInterval) {
      clearInterval((window as any).recordingInterval);
      delete (window as any).recordingInterval;
    }
    
    audioService.cancelRecording();
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if leaving the entire chat area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    const newImages: AttachedImage[] = [];
    
    for (const file of imageFiles) {
      const processedImage = await processImageFile(file);
      if (processedImage) {
        newImages.push(processedImage);
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages]);
      // Refocus input after drag and drop
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const removeImage = (id: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  const clearAllImages = () => {
    setAttachedImages([]);
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
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-action-danger)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-action-danger)' }}>AI Assistant Unavailable</h3>
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for attachment button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'var(--color-bg-overlay)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center"
            style={{
              borderColor: 'var(--color-accent-primary)',
              backgroundColor: 'var(--color-bg-primary)'
            }}
          >
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>Drop images here</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>Images will be attached to your message</p>
          </div>
        </div>
      )}


      <div 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative"
        style={{ 
          background: 'linear-gradient(to bottom, var(--color-bg-primary), var(--color-bg-secondary))'
        }}
      >
        {/* Session restored notification */}
        {sessionRestored && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-4 right-4 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-action-primary)',
              color: 'var(--color-bg-primary)',
              zIndex: 10,
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Previous conversation restored
          </motion.div>
        )}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} flex-1`}
            >
              <div
                className={`flex flex-col rounded-lg text-sm`}
                style={{
                  maxWidth: '75%',
                  backgroundColor: message.role === 'user' 
                    ? 'var(--color-bg-secondary)'
                    : 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: message.role === 'assistant' 
                    ? '1px solid var(--color-border-primary)'
                    : 'none'
                }}
              >
                {/* Regular message content */}
                <div className="px-3 py-2">
                  <div className="break-words">
                    {/* Show attached images for user messages */}
                    {message.role === 'user' && message.attachedImages && message.attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {message.attachedImages.map((img, idx) => (
                          <div 
                            key={idx}
                            className="relative"
                            style={{ width: '60px', height: '60px' }}
                          >
                            <img
                              src={img.thumbnail}
                              alt={img.name}
                              className="w-full h-full object-cover rounded"
                              style={{ 
                                border: '1px solid var(--color-border-primary)',
                                backgroundColor: 'var(--color-surface-secondary)'
                              }}
                              onError={(e) => {
                                // Fallback if thumbnail fails
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'w-full h-full rounded flex items-center justify-center';
                                  fallback.style.backgroundColor = 'var(--color-surface-secondary)';
                                  fallback.style.border = '1px solid var(--color-border-primary)';
                                  fallback.innerHTML = `
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--color-text-tertiary)">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  `;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {message.isStreaming ? (
                    <>
                      {streamingContent ? (
                        <span>{streamingContent}</span>
                      ) : (
                        <motion.div className="flex items-center gap-2">
                          <motion.span
                            className="shimmer-text font-medium"
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
                          className="block mt-2 text-xs shimmer-text"
                          style={{ 
                            fontStyle: 'italic'
                          }}
                        >
                          {workingMessage}
                        </motion.span>
                      )}
                    </>
                  ) : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ inline, className, children, ...props }) => {
                          const codeString = String(children).replace(/\n$/, '');
                          const isReallyInline = inline !== false && !codeString.includes('\n') && codeString.length < 80;
                          
                          return isReallyInline ? (
                            <code 
                              className="px-1 py-0.5 rounded text-xs" 
                              style={{
                                backgroundColor: 'var(--color-surface-secondary)',
                                color: 'var(--color-text-primary)',
                                display: 'inline'
                              }}
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <pre 
                              className="p-2 rounded text-xs overflow-x-auto mb-2" 
                              style={{
                                backgroundColor: 'var(--color-surface-secondary)'
                              }}
                            >
                              <code className={className} {...props}>{children}</code>
                            </pre>
                          );
                        },
                        blockquote: ({ children }) => (
                          <blockquote className="pl-3 border-l-2 mb-2" style={{
                            borderColor: 'var(--color-border-primary)',
                            color: 'var(--color-text-secondary)'
                          }}>{children}</blockquote>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                    </div>
                  </div>
                  {/* Timestamp for regular messages */}
                  <div
                    className="text-xs mt-1 px-3 pb-2"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      opacity: 0.7
                    }}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Current loop display (temporary, shows status or message) */}
        {currentLoop.phase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex"
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm`}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-primary)'
              }}
            >
              {/* Show status OR message, never both */}
              {currentLoop.status && !currentLoop.message ? (
                <motion.div
                  key={currentLoop.status}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="shimmer-text font-medium"
                >
                  {currentLoop.status}
                </motion.div>
              ) : currentLoop.message ? (
                <div className="break-words">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      code: ({ inline, className, children, ...props }) => {
                        const codeString = String(children).replace(/\n$/, '');
                        const isReallyInline = inline !== false && !codeString.includes('\n') && codeString.length < 80;
                        
                        return isReallyInline ? (
                          <code 
                            className="px-1 py-0.5 rounded text-xs" 
                            style={{
                              backgroundColor: 'var(--color-surface-secondary)',
                              color: 'var(--color-text-primary)',
                              display: 'inline'
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <pre 
                            className="p-2 rounded text-xs overflow-x-auto mb-2" 
                            style={{
                              backgroundColor: 'var(--color-surface-secondary)'
                            }}
                          >
                            <code className={className} {...props}>{children}</code>
                          </pre>
                        );
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="pl-3 border-l-2 mb-2" style={{
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-secondary)'
                        }}>{children}</blockquote>
                      )
                    }}
                  >
                    {currentLoop.message}
                  </ReactMarkdown>
                  {currentLoop.isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div 
        className="border-t"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-secondary)'
        }}
      >
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div 
            className="border-b px-3 py-2"
            style={{ borderColor: 'var(--color-border-secondary)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {attachedImages.length} image{attachedImages.length > 1 ? 's' : ''} attached
              </span>
              <button
                onClick={clearAllImages}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  color: 'var(--color-text-tertiary)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                Clear all
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {attachedImages.map(img => (
                <div 
                  key={img.id} 
                  className="relative group flex-shrink-0 overflow-visible"
                  style={{ width: '60px', height: '60px' }}
                >
                  <img
                    src={img.thumbnail}
                    alt={img.name}
                    className="w-full h-full object-cover rounded"
                    style={{ 
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-surface-secondary)'
                    }}
                    onError={(e) => {
                      // Fallback to placeholder if thumbnail fails
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent && !parent.querySelector('.image-placeholder')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'image-placeholder w-full h-full rounded flex items-center justify-center';
                        placeholder.style.backgroundColor = 'var(--color-surface-secondary)';
                        placeholder.style.border = '1px solid var(--color-border-primary)';
                        placeholder.innerHTML = `
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--color-text-tertiary)">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        `;
                        parent.insertBefore(placeholder, parent.firstChild);
                      }
                    }}
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-0 right-0 w-4 h-4 rounded-full flex items-center justify-center transition-all z-10"
                    style={{
                      backgroundColor: 'var(--color-error)',
                      color: 'white',
                      opacity: 1,
                      transform: 'scale(0.9)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(0.9)';
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div 
                    className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b"
                    style={{
                      backgroundColor: 'var(--color-bg-overlay)',
                      color: 'var(--color-text-primary)'
                    }}
                    title={img.name}
                  >
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-3">
          <div className="flex items-center gap-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize textarea with proper min height
                const target = e.target;
                target.style.height = '36px'; // Reset to min height first
                const scrollHeight = target.scrollHeight;
                target.style.height = Math.min(scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask about your project..."
              disabled={isLoading || !isConnected || isProcessingImage}
              rows={1}
              className="flex-1 resize-none px-3 py-2 focus:outline-none transition-all text-sm"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-text-primary)',
                opacity: isLoading || !isConnected ? 0.5 : 1,
                cursor: isLoading || !isConnected ? 'not-allowed' : 'text',
                minHeight: '36px',
                maxHeight: '120px',
                overflow: 'auto'
              }}
            />
            {/* Attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !isConnected || isProcessingImage}
              className="p-2 transition-all flex items-center justify-center relative"
              style={{
                backgroundColor: 'transparent',
                color: attachedImages.length > 0 
                  ? 'var(--color-accent-primary)'
                  : (isLoading || !isConnected || isProcessingImage)
                    ? 'var(--color-text-tertiary)'
                    : 'var(--color-text-secondary)',
                cursor: (isLoading || !isConnected || isProcessingImage) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !isConnected || isProcessingImage) ? 0.3 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading && isConnected && !isProcessingImage) {
                  e.currentTarget.style.color = 'var(--color-accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && isConnected && !isProcessingImage && attachedImages.length === 0) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
              title="Attach images"
            >
              {isProcessingImage ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {attachedImages.length > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-action-primary)',
                        color: 'var(--color-bg-primary)',
                        fontSize: '10px'
                      }}
                    >
                      {attachedImages.length}
                    </span>
                  )}
                </>
              )}
            </button>
            {/* Microphone button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || !isConnected || isTranscribing}
              className="p-2 transition-all flex items-center justify-center relative"
              style={{
                backgroundColor: 'transparent',
                color: isRecording 
                  ? 'var(--color-action-danger)'
                  : isTranscribing
                    ? 'var(--color-text-secondary)'
                    : (isLoading || !isConnected)
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-secondary)',
                cursor: (isLoading || !isConnected || isTranscribing) ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !isConnected || isTranscribing) ? 0.3 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading && isConnected && !isTranscribing && !isRecording) {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && isConnected && !isTranscribing && !isRecording) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isTranscribing ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : isRecording ? (
                <>
                  <div className="audio-wave" style={{ color: 'var(--color-action-danger)' }}>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span 
                    className="absolute -top-1 -right-1 px-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-action-danger)',
                      color: 'var(--color-bg-primary)',
                      fontSize: '10px',
                      minWidth: '24px'
                    }}
                  >
                    {formatDuration(recordingDuration)}
                  </span>
                </>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            {/* Send button */}
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!input.trim() && attachedImages.length === 0) || !isConnected}
              className="p-2 transition-all flex items-center justify-center"
              style={{
                backgroundColor: 'transparent',
                color: isLoading || (!input.trim() && attachedImages.length === 0) || !isConnected
                  ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-secondary)',
                cursor: isLoading || (!input.trim() && attachedImages.length === 0) || !isConnected ? 'not-allowed' : 'pointer',
                opacity: isLoading || (!input.trim() && attachedImages.length === 0) || !isConnected ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading && (input.trim() || attachedImages.length > 0) && isConnected) {
                  e.currentTarget.style.color = 'var(--color-accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && (input.trim() || attachedImages.length > 0) && isConnected) {
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
                <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
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