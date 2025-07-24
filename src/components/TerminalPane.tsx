import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Project } from '../types/Project';

interface TerminalPaneProps {
  project: Project;
  onClose: () => void;
  onResize?: (width: number) => void;
  'data-component'?: string;
}

export const TerminalPane = ({ 
  project, 
  onClose,
  onResize,
  'data-component': dataComponent 
}: TerminalPaneProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !terminalRef.current) return;
      
      const container = terminalRef.current.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      const minWidth = 200; // Minimum width in pixels
      const maxWidth = containerRect.width * 0.7; // Maximum 70% of container
      
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      const widthPercentage = (clampedWidth / containerRect.width) * 100;
      
      // Don't apply width directly to terminal, let parent handle it
      onResize?.(widthPercentage);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  const handleMouseDown = () => {
    setIsResizing(true);
  };
  return (
    <div 
      ref={terminalRef}
      className="terminal-pane flex flex-col h-full relative"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      {/* Drag Handle */}
      <div
        ref={dragHandleRef}
        className="drag-handle absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 hover:bg-opacity-50 transition-colors z-10"
        style={{ 
          backgroundColor: isResizing ? 'var(--color-action-primary)' : 'transparent',
          marginLeft: '-2px'
        }}
        onMouseDown={handleMouseDown}
        data-control="resize-handle"
        title="Drag to resize terminal"
      />
      
      <div className="terminal-content-wrapper flex flex-col h-full pl-1">

      {/* Terminal Content */}
      <div 
        className="terminal-content flex-1 p-4 font-mono text-sm overflow-auto"
        style={{ 
          backgroundColor: '#1a1a1a',
          color: '#ffffff'
        }}
        data-section="terminal-content"
      >
        {/* Terminal Placeholder */}
        <div className="terminal-placeholder">
          <div className="terminal-prompt flex items-center gap-2 mb-2">
            <span className="text-green-400">➜</span>
            <span className="text-blue-400">~/{project.name}</span>
            <span className="text-gray-400">git:(main)</span>
            <span className="animate-pulse">▋</span>
          </div>
          
          <div className="terminal-history space-y-1 text-gray-300">
            <div>Welcome to the AI-powered terminal</div>
            <div>Project: {project.name}</div>
            <div>Type commands or ask for help...</div>
          </div>
        </div>
      </div>

      {/* Terminal Input (placeholder) */}
      <div 
        className="terminal-input-area px-4 py-2"
        style={{ 
          backgroundColor: '#1a1a1a'
        }}
        data-section="terminal-input"
      >
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-green-400">➜</span>
          <span className="text-blue-400">~/{project.name}</span>
          <input
            type="text"
            placeholder="Enter command..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
            style={{ caretColor: 'white' }}
            data-input="command"
          />
        </div>
      </div>
      </div>
    </div>
  );
};