import { motion } from 'framer-motion';
import { ModeToggle } from './ModeToggle';
import { ThemeToggle } from './ThemeToggle';
import { LoadingSpinner } from './LoadingSpinner';
import { Project } from '../types/Project';
import { ViewMode } from './ProjectViewer';
import { ProjectServerState } from '../hooks/useProjectServers';

interface ProjectHeaderProps {
  project: Project;
  viewMode: ViewMode;
  isTerminalOpen: boolean;
  isFullscreen: boolean;
  serverState: ProjectServerState;
  onBack: () => void;
  onModeChange: (mode: ViewMode) => void;
  onTerminalToggle: () => void;
  onFullscreenToggle: () => void;
  onStartServers: () => Promise<void>;
  onStopServers: () => Promise<void>;
  'data-section'?: string;
}

export const ProjectHeader = ({ 
  project, 
  viewMode, 
  isTerminalOpen,
  isFullscreen,
  serverState,
  onBack, 
  onModeChange,
  onTerminalToggle,
  onFullscreenToggle,
  onStartServers,
  onStopServers,
  'data-section': dataSection 
}: ProjectHeaderProps) => {
  return (
    <div 
      className="project-header flex items-center justify-between px-8 py-4 border-b flex-shrink-0"
      style={{ 
        borderColor: 'var(--color-border-secondary)',
        backgroundColor: 'var(--color-bg-primary)'
      }}
      data-section={dataSection}
    >
      {/* Left: Back Navigation */}
      <div className="header-navigation flex items-center gap-4" data-section="navigation">
        <motion.button
          onClick={onBack}
          className="back-button transition-colors"
          style={{ 
            padding: '8px',
            marginLeft: '-8px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-control="back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <span 
          className="project-title text-base font-medium"
          style={{ color: 'var(--color-text-primary)' }}
          title={project.description}
          data-info="title"
        >
          {project.name}
        </span>
      </div>

      {/* Right: Controls */}
      <div className="header-controls flex items-center gap-2" data-section="controls">
        {/* Server Controls */}
        <div className="server-controls flex items-center gap-1">
          {serverState.viteServer || serverState.storybookServer ? (
            <motion.button
              onClick={onStopServers}
              disabled={serverState.isStarting}
              className="server-button px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '0'
              }}
              onMouseEnter={(e) => {
                if (!serverState.isStarting) {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }
              }}
              onMouseLeave={(e) => {
                if (!serverState.isStarting) {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                }
              }}
              whileHover={{ scale: serverState.isStarting ? 1 : 1.02 }}
              whileTap={{ scale: serverState.isStarting ? 1 : 0.98 }}
              title="Stop Development Servers"
              data-control="stop-servers"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop Servers
            </motion.button>
          ) : (
            <motion.button
              onClick={onStartServers}
              className="server-button px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#059669';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="Start Development Servers"
              data-control="start-servers"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start Servers
            </motion.button>
          )}
          
          {/* Server Status Indicator */}
          {(serverState.viteServer || serverState.storybookServer) && (
            <div 
              className="server-status w-2 h-2 rounded-full ml-1"
              style={{ 
                backgroundColor: serverState.isHealthy ? '#10b981' : '#ef4444' 
              }}
              title={`Servers ${serverState.isHealthy ? 'healthy' : 'unhealthy'}`}
            />
          )}
        </div>
        
        <div className="divider w-px h-4" style={{ backgroundColor: 'var(--color-border-secondary)' }} />
        
        <ModeToggle
          currentMode={viewMode}
          onModeChange={onModeChange}
          data-control="mode-toggle"
        />
        
        {/* Fullscreen Toggle - only show in preview mode */}
        {viewMode === 'preview' && (
          <motion.button
            onClick={onFullscreenToggle}
            className="fullscreen-toggle p-2 transition-colors"
            style={{
              color: isFullscreen 
                ? 'var(--color-text-primary)' 
                : 'var(--color-text-secondary)',
              backgroundColor: isFullscreen 
                ? 'var(--color-surface-hover)' 
                : 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              if (!isFullscreen) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isFullscreen) {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Toggle Fullscreen"
            data-control="fullscreen"
            data-active={isFullscreen}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </motion.button>
        )}
        
        {/* Terminal Toggle */}
        <motion.button
          onClick={onTerminalToggle}
          className="terminal-toggle p-2 transition-colors"
          style={{
            color: isTerminalOpen 
              ? 'var(--color-text-primary)' 
              : 'var(--color-text-secondary)',
            backgroundColor: isTerminalOpen 
              ? 'var(--color-surface-hover)' 
              : 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            if (!isTerminalOpen) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isTerminalOpen) {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Toggle Terminal"
          data-control="terminal"
          data-active={isTerminalOpen}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </motion.button>
        
        <div className="divider w-px h-4" style={{ backgroundColor: 'var(--color-border-secondary)' }} />
        
        <ThemeToggle />
      </div>
    </div>
  );
};