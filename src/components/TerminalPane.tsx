import { useRef, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Project } from '../types/Project';
import { getTerminalService } from '../services/terminalIPC';
import type { TerminalSession, TerminalDataEvent, TerminalExitEvent, TerminalErrorEvent } from '../services/terminalIPC';
import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  project: Project;
  onClose: () => void;
  onResize?: (widthPixels: number) => void;
  'data-component'?: string;
}

export const TerminalPane = ({ 
  project, 
  onClose,
  onResize,
  'data-component': dataComponent 
}: TerminalPaneProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    console.log(`[TerminalPane] Initializing terminal for project ${project.name} (${project.id})`);
    
    const initializeTerminal = async () => {
      try {
        // Create xterm.js terminal instance
        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1a1a1a',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#1a1a1a',
            red: '#ef4444',
            green: '#10b981',
            yellow: '#f59e0b',
            blue: '#3b82f6',
            magenta: '#8b5cf6',
            cyan: '#06b6d4',
            white: '#ffffff',
            brightBlack: '#374151',
            brightRed: '#f87171',
            brightGreen: '#34d399',
            brightYellow: '#fbbf24',
            brightBlue: '#60a5fa',
            brightMagenta: '#a78bfa',
            brightCyan: '#22d3ee',
            brightWhite: '#f9fafb'
          },
          scrollback: 1000,
          allowTransparency: false
        });

        // Create and attach addons
        const fit = new FitAddon();
        const webLinks = new WebLinksAddon();
        
        terminal.loadAddon(fit);
        terminal.loadAddon(webLinks);
        
        // Store references
        terminalInstance.current = terminal;
        fitAddon.current = fit;

        // Open terminal in DOM
        terminal.open(terminalRef.current);
        
        // Fit terminal to container
        fit.fit();

        // Get terminal service and create session
        const terminalService = getTerminalService();
        
        // Check if terminal already exists for this project
        const existingTerminals = await terminalService.getProjectTerminals(project.id);
        console.log(`[TerminalPane] Found ${existingTerminals.length} existing terminals for project ${project.id}`);
        
        let session: TerminalSession;
        if (existingTerminals.length > 0) {
          // Use existing terminal
          session = {
            sessionId: existingTerminals[0].sessionId,
            projectId: project.id,
            projectPath: project.path || `~/faux-projects/${project.name}`,
            cols: terminal.cols,
            rows: terminal.rows,
            shell: '/bin/zsh' // Default shell
          };
          console.log(`[TerminalPane] Reusing existing terminal session ${session.sessionId}`);
        } else {
          // Create new terminal session
          session = await terminalService.createTerminal({
            projectPath: project.path || `~/faux-projects/${project.name}`,
            projectId: project.id,
            cols: terminal.cols,
            rows: terminal.rows
          });
          console.log(`[TerminalPane] Created new terminal session ${session.sessionId}`);
        }

        sessionRef.current = session;

        // Set up event listeners
        const cleanup = setupEventListeners(terminal, terminalService, session.sessionId);

        setIsReady(true);
        console.log(`[TerminalPane] Terminal ready for project ${project.name}, session ${session.sessionId}`);

        // Cleanup function
        return () => {
          cleanup();
          if (sessionRef.current) {
            terminalService.destroyTerminal(sessionRef.current.sessionId).catch(console.error);
          }
          terminal.dispose();
        };

      } catch (err) {
        console.error('[TerminalPane] Failed to initialize terminal:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
      }
    };

    initializeTerminal();
  }, [project.id]); // Only re-create terminal when project changes

  // Set up terminal event listeners
  const setupEventListeners = (terminal: Terminal, terminalService: any, sessionId: string) => {
    // Handle user input
    const onDataHandler = (data: string) => {
      terminalService.writeToTerminal(sessionId, data).catch((err: Error) => {
        console.error('[TerminalPane] Failed to write to terminal:', err);
      });
    };
    terminal.onData(onDataHandler);

    // Handle terminal output from main process
    const onTerminalData = (event: TerminalDataEvent) => {
      if (event.sessionId === sessionId) {
        terminal.write(event.data);
      }
    };
    const removeDataListener = terminalService.on('data', onTerminalData);

    // Handle terminal exit
    const onTerminalExit = (event: TerminalExitEvent) => {
      if (event.sessionId === sessionId) {
        terminal.write(`\r\n\x1b[31mTerminal session ended (exit code: ${event.exitCode})\x1b[0m\r\n`);
        console.log(`[TerminalPane] Terminal session ${sessionId} exited with code ${event.exitCode}`);
      }
    };
    const removeExitListener = terminalService.on('exit', onTerminalExit);

    // Handle terminal errors
    const onTerminalError = (event: TerminalErrorEvent) => {
      if (event.sessionId === sessionId) {
        terminal.write(`\r\n\x1b[31mTerminal error: ${event.error}\x1b[0m\r\n`);
        console.error(`[TerminalPane] Terminal session ${sessionId} error:`, event.error);
      }
    };
    const removeErrorListener = terminalService.on('error', onTerminalError);

    // Handle resize events
    const onResizeHandler = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (sessionRef.current) {
          terminalService.resizeTerminal(
            sessionRef.current.sessionId,
            terminal.cols,
            terminal.rows
          ).catch((err: Error) => {
            console.error('[TerminalPane] Failed to resize terminal:', err);
          });
        }
      }
    };
    terminal.onResize(onResizeHandler);

    // Return cleanup function
    return () => {
      removeDataListener();
      removeExitListener();
      removeErrorListener();
    };
  };

  // Handle external resize (when terminal pane is resized)
  useEffect(() => {
    if (isReady && fitAddon.current) {
      const resizeTimer = setTimeout(() => {
        fitAddon.current?.fit();
      }, 100); // Small delay to allow container to resize

      return () => clearTimeout(resizeTimer);
    }
  }, [onResize, isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        const terminalService = getTerminalService();
        terminalService.destroyTerminal(sessionRef.current.sessionId).catch(console.error);
      }
    };
  }, []);

  if (error) {
    return (
      <div 
        className="terminal-pane flex flex-col h-full relative"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        data-component={dataComponent}
        data-project-id={project.id}
      >
        <div className="terminal-error flex items-center justify-center h-full">
          <div className="error-content text-center p-4">
            <div className="error-icon mb-2">
              <svg className="w-8 h-8 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-red-600 mb-1">Terminal Error</h3>
            <p className="text-xs text-gray-500">{error}</p>
            <button
              onClick={() => {
                setError(null);
                window.location.reload(); // Simple recovery
              }}
              className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="terminal-pane flex flex-col h-full relative"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      <div className="terminal-content-wrapper flex flex-col h-full">
        {/* Terminal Header */}
        <div 
          className="terminal-header flex items-center justify-between px-3 py-2 border-b"
          style={{ 
            backgroundColor: '#1a1a1a',
            borderColor: 'var(--color-border-secondary)'
          }}
        >
          <div className="terminal-info flex items-center gap-2 text-xs">
            <span className="text-green-400">●</span>
            <span className="text-gray-400">Terminal</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{project.name}</span>
          </div>
          <button
            onClick={onClose}
            className="terminal-close p-1 text-gray-400 hover:text-white transition-colors"
            title="Close terminal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Terminal Content */}
        <div 
          ref={terminalRef}
          className="terminal-content flex-1 overflow-hidden"
          style={{ backgroundColor: '#1a1a1a' }}
          data-section="terminal-content"
        />

        {/* Loading state */}
        {!isReady && !error && (
          <div className="terminal-loading absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="loading-content text-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
              <div className="text-xs text-gray-400">Initializing terminal...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};