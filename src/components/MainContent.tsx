import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Project } from '../types/Project';
import { ViewMode, ViewportMode } from './ProjectViewer';
import { ContentLoader } from './ContentLoader';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectServerState } from '../hooks/useProjectServers';

interface MainContentProps {
  project: Project;
  viewMode: ViewMode;
  viewportMode?: ViewportMode;
  serverState: ProjectServerState;
  isFullscreen?: boolean;
  onRetryConnection?: () => void;
  'data-content'?: string;
}

export const MainContent = ({ 
  project, 
  viewMode,
  viewportMode = 'desktop',
  serverState,
  isFullscreen = false,
  onRetryConnection,
  'data-content': dataContent 
}: MainContentProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  const renderServerContent = (serverUrl: string, serverName: string, icon: React.ReactNode, isStorybook = false) => {
    const finalUrl = serverUrl;
    
    console.log('🎬 Rendering server content:', {
      serverName,
      isStorybook,
      serverUrl,
      finalUrl,
      projectId: project.id
    });
    
    const handleIframeRef = (iframe: HTMLIFrameElement | null) => {
      if (!iframe) {
        console.log('🗑️ Iframe removed, cleaning up');
        // Cleanup when iframe is removed
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      
    };
    
    return (
      <div className="server-content flex flex-col flex-1 overflow-hidden">
        {/* Viewport Container */}
        <div 
          className={`viewport-container flex-1 ${viewportMode === 'mobile' ? 'flex items-center justify-center' : ''}`}
          style={{
            backgroundColor: viewportMode === 'mobile' ? 'var(--color-bg-secondary)' : 'transparent',
            padding: viewportMode === 'mobile' ? '20px 0' : '0'
          }}
        >
          {/* Embedded Server Content */}
          <div 
            className={`server-iframe-container ${viewportMode === 'mobile' ? 'mobile-viewport' : 'flex-1'} relative`}
            style={viewportMode === 'mobile' ? {
              width: '375px',
              height: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-primary)',
              transition: 'all 0.3s ease-in-out'
            } : {
              width: '100%',
              height: '100%'
            }}
          >
            <iframe
              ref={handleIframeRef}
              src={finalUrl}
              className="w-full h-full border-0"
              title={`${serverName} - ${project.name}`}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              loading="lazy"
              style={{
                borderRadius: viewportMode === 'mobile' ? '8px' : '0'
              }}
            />
          </div>
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
    try {
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

      console.log('🎭 Rendering content for mode:', viewMode);
    
    switch (viewMode) {
      case 'preview':
        console.log('🔍 Preview mode - Vite server check:', !!serverState.viteServer?.url);
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
        console.log('📚 Components mode - Storybook server check:', !!serverState.storybookServer?.url);
        if (serverState.storybookServer?.url) {
          return renderServerContent(
            serverState.storybookServer.url,
            'Storybook',
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>,
            true // isStorybook = true
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
    } catch (error) {
      console.error('❌ Error in MainContent renderContent:', error);
      return (
        <div className="error-content flex items-center justify-center flex-1">
          <div className="error-placeholder text-center">
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Render Error
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </div>
        </div>
      );
    }
  };

  return (
    <motion.div
      className="main-content flex flex-col flex-1 overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      data-content={dataContent}
      data-project-id={project.id}
      data-mode={viewMode}
      data-viewport={viewportMode}
      data-fullscreen={isFullscreen}
      key={`${viewMode}-${viewportMode}-${isFullscreen}`}
      initial={{ opacity: 0, y: isFullscreen ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isFullscreen ? 0.4 : 0.2, ease: 'easeInOut' }}
    >
      {renderContent()}
    </motion.div>
  );
};