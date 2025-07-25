import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Project } from '../types/Project';

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
  return (
    <div 
      ref={terminalRef}
      className="terminal-pane flex flex-col h-full relative"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      <div className="terminal-content-wrapper flex flex-col h-full">

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