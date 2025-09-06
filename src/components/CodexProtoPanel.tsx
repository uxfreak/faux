import { motion } from 'framer-motion';
import { Project } from '../types/Project';
import { CodexChat } from './CodexChat';

interface CodexProtoPanelProps {
  project: Project;
  onClose: () => void;
  onResize?: (widthPixels: number) => void;
  'data-component'?: string;
}

export const CodexProtoPanel = ({ 
  project, 
  onClose,
  'data-component': dataComponent 
}: CodexProtoPanelProps) => {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        opacity: { duration: 0.2 }
      }}
      className="codex-panel flex flex-col h-full relative overflow-hidden"
      style={{ 
        backgroundColor: 'var(--color-bg-primary)',
        borderLeft: '1px solid var(--color-border-primary)'
      }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      {/* Panel Header */}
      <div 
        className="panel-header flex items-center justify-between px-3 py-2 border-b bg-opacity-95 backdrop-blur-sm"
        style={{ 
          backgroundColor: 'var(--color-surface-primary)',
          borderColor: 'var(--color-border-secondary)'
        }}
      >
        <div className="panel-info flex items-center gap-2 text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
            AI Assistant
          </span>
          <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {project.name}
          </span>
        </div>
        
        <button
          onClick={onClose}
          className="panel-close p-1 transition-colors rounded"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Close AI assistant"
          data-control="close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="panel-content flex-1 overflow-hidden">
        <CodexChat 
          project={project} 
          data-component="codex-chat"
        />
      </div>

      {/* Resize Handle (Optional - for future enhancement) */}
      <div
        className="resize-handle absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:bg-opacity-50 transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
          e.currentTarget.style.opacity = '0.3';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.opacity = '1';
        }}
        title="Drag to resize panel"
      />

      {/* Panel Status Bar (Optional) */}
      <div 
        className="panel-status px-3 py-1 border-t text-xs flex items-center justify-between"
        style={{
          backgroundColor: 'var(--color-surface-secondary)',
          borderColor: 'var(--color-border-secondary)',
          color: 'var(--color-text-tertiary)'
        }}
      >
        <span>Ready</span>
        <span>gpt-5</span>
      </div>
    </motion.div>
  );
};