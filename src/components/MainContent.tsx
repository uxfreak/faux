import { motion } from 'framer-motion';
import { Project } from '../types/Project';
import { ViewMode } from './ProjectViewer';
import { ContentLoader } from './ContentLoader';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectServerState } from '../hooks/useProjectServers';

interface MainContentProps {
  project: Project;
  viewMode: ViewMode;
  serverState: ProjectServerState;
  isFullscreen?: boolean;
  onRetryConnection?: () => void;
  'data-content'?: string;
}

export const MainContent = ({ 
  project, 
  viewMode, 
  serverState,
  isFullscreen = false,
  onRetryConnection,
  'data-content': dataContent 
}: MainContentProps) => {
  
  const renderServerContent = (serverUrl: string, serverName: string, icon: React.ReactNode) => {
    return (
      <div className="server-content flex flex-col flex-1 overflow-hidden">
        {/* Server URL Bar */}
        <div 
          className="server-url-bar flex items-center gap-3 px-4 py-2 border-b text-sm"
          style={{ 
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)'
          }}
        >
          <div className="server-icon flex items-center">
            {icon}
          </div>
          <div className="server-url-info flex items-center gap-2 flex-1">
            <span className="server-label font-medium">{serverName}:</span>
            <span className="server-url font-mono">{serverUrl}</span>
          </div>
          <div 
            className="health-indicator w-2 h-2 rounded-full"
            style={{ 
              backgroundColor: serverState.isHealthy ? '#10b981' : '#ef4444' 
            }}
            title={serverState.isHealthy ? 'Server healthy' : 'Server unhealthy'}
          />
        </div>
        
        {/* Embedded Server Content */}
        <div className="server-iframe-container flex-1 relative">
          <iframe
            src={serverUrl}
            className="w-full h-full border-0"
            title={`${serverName} - ${project.name}`}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            loading="lazy"
          />
        </div>
      </div>
    );
  };

  const renderErrorState = (error: string) => {
    return (
      <div className="error-content flex items-center justify-center flex-1">
        <div className="error-placeholder flex flex-col items-center gap-4 text-center max-w-md">
          <div 
            className="error-icon w-16 h-16 flex items-center justify-center border-2 border-dashed"
            style={{ 
              borderColor: 'var(--color-border-secondary)',
              color: '#ef4444'
            }}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="error-text">
            <h3 
              className="text-lg font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Server Error
            </h3>
            <p 
              className="text-sm mb-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {error}
            </p>
            {onRetryConnection && serverState.retryCount < 3 && (
              <button
                onClick={onRetryConnection}
                className="retry-button px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Connection ({serverState.retryCount + 1}/3)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPlaceholder = (mode: string, description: string, icon: React.ReactNode) => {
    return (
      <div className="placeholder-content flex items-center justify-center flex-1">
        <div className="content-placeholder flex flex-col items-center gap-4 text-center">
          <div 
            className="placeholder-icon w-16 h-16 flex items-center justify-center border-2 border-dashed"
            style={{ 
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-tertiary)'
            }}
          >
            {icon}
          </div>
          <div className="placeholder-text">
            <h3 
              className="text-lg font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {mode}
            </h3>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {description}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    // Show error state if there's an error
    if (serverState.error) {
      return renderErrorState(serverState.error);
    }

    // Show loading state if servers are starting
    if (serverState.isStarting) {
      return (
        <div className="loading-content flex items-center justify-center flex-1">
          <ContentLoader
            message="Starting development servers..."
            size="large"
          />
        </div>
      );
    }

    switch (viewMode) {
      case 'preview':
        if (serverState.viteServer?.url) {
          return renderServerContent(
            serverState.viteServer.url,
            'Vite Dev Server',
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          );
        }
        return renderPlaceholder(
          'Preview Mode',
          'Click "Start Servers" to launch the Vite development server',
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      
      case 'components':
        if (serverState.storybookServer?.url) {
          return renderServerContent(
            serverState.storybookServer.url,
            'Storybook',
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          );
        }
        return renderPlaceholder(
          'Components Mode',
          'Click "Start Servers" to launch the Storybook interface',
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="main-content flex flex-col flex-1 overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-content={dataContent}
      data-project-id={project.id}
      data-mode={viewMode}
      data-fullscreen={isFullscreen}
      key={`${viewMode}-${isFullscreen}`}
      initial={{ opacity: 0, y: isFullscreen ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isFullscreen ? 0.4 : 0.2, ease: 'easeInOut' }}
    >
      {renderContent()}
    </motion.div>
  );
};