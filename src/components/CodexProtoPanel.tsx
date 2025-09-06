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
      animate={{ width: 420, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 35,
        opacity: { duration: 0.15 }
      }}
      className="codex-panel flex flex-col h-full relative overflow-hidden shadow-xl"
      style={{ 
        backgroundColor: 'var(--color-bg-primary)',
        borderLeft: '2px solid var(--color-border-primary)',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)'
      }}
      data-component={dataComponent}
      data-project-id={project.id}
    >
      {/* Panel Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="panel-header flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
        style={{ 
          background: 'linear-gradient(to bottom, var(--color-surface-primary), var(--color-surface-secondary))',
          borderColor: 'var(--color-border-primary)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="panel-info flex items-center gap-3">
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 3 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ 
              color: 'var(--color-accent-primary)',
              filter: 'drop-shadow(0 0 4px rgba(var(--color-accent-primary-rgb), 0.3))'
            }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold text-sm">
                AI Assistant
              </span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }} className="text-xs">
              {project.name}
            </div>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="panel-close p-2 transition-all rounded-lg"
          style={{ 
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-error)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Close AI assistant"
          data-control="close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Panel Content */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="panel-content flex-1 overflow-hidden"
      >
        <CodexChat 
          project={project} 
          data-component="codex-chat"
        />
      </motion.div>

      {/* Resize Handle */}
      <motion.div
        className="resize-handle absolute left-0 top-0 w-2 h-full cursor-col-resize transition-all"
        style={{ 
          background: 'linear-gradient(to right, transparent, var(--color-accent-primary))',
          opacity: 0
        }}
        whileHover={{ opacity: 0.3 }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.4';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0';
        }}
        title="Drag to resize panel"
      />

    </motion.div>
  );
};