import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectHeader } from './ProjectHeader';
import { MainContent } from './MainContent';
import { TerminalPane } from './TerminalPane';
import { Project } from '../types/Project';
import { useProjectServers } from '../hooks/useProjectServers';
import { useThumbnails } from '../hooks/useThumbnails';

export type ViewMode = 'preview' | 'components';

interface ProjectViewerProps {
  project: Project;
  onBack: () => void;
}

export const ProjectViewer = ({ project, onBack }: ProjectViewerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalWidth, setTerminalWidth] = useState(400); // Default 400px
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closeButtonPosition, setCloseButtonPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCloseButton, setIsDraggingCloseButton] = useState(false);
  const [hasBeenDragged, setHasBeenDragged] = useState(false);
  const [isTerminalResizing, setIsTerminalResizing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const terminalWrapperRef = useRef<HTMLDivElement>(null);

  // Server management
  const { serverState, startServers, stopServers, retryConnection } = useProjectServers(project);

  // Thumbnail management
  const { 
    captureOnProjectOpen, 
    captureThumbnail, 
    cleanup: cleanupThumbnails 
  } = useThumbnails({
    autoCapture: true,
    captureOnOpen: true,
    periodicCapture: true,
    periodicInterval: 30000, // 30 seconds
    debounceMs: 5000
  });

  // Auto-start servers when project opens
  useEffect(() => {
    startServers();
  }, [project.id]); // Re-start if project changes

  // Capture thumbnails when servers become available
  useEffect(() => {
    const captureFromServer = async () => {
      // For preview mode, use Vite server
      if (viewMode === 'preview' && serverState.viteServer?.status === 'running' && serverState.viteServer.url) {
        console.log('📸 Vite server ready, capturing thumbnail for preview mode');
        await captureOnProjectOpen(project, serverState.viteServer.url);
      }
      // For components mode, use Storybook server
      else if (viewMode === 'components' && serverState.storybookServer?.status === 'running' && serverState.storybookServer.url) {
        console.log('📸 Storybook server ready, capturing thumbnail for components mode');
        await captureOnProjectOpen(project, serverState.storybookServer.url);
      }
    };

    captureFromServer();
  }, [
    project.id,
    viewMode,
    serverState.viteServer?.status,
    serverState.viteServer?.url,
    serverState.storybookServer?.status,
    serverState.storybookServer?.url,
    captureOnProjectOpen
  ]);

  // Cleanup thumbnails when component unmounts or project changes
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up thumbnails for project:', project.name);
      cleanupThumbnails(project.id);
    };
  }, [project.id, cleanupThumbnails]);

  // Manual thumbnail refresh
  const handleThumbnailRefresh = async () => {
    try {
      console.log('🔄 Manual thumbnail refresh requested for project:', project.name);
      
      let serverUrl: string | undefined;
      
      // Use the appropriate server based on current view mode
      if (viewMode === 'preview' && serverState.viteServer?.url) {
        serverUrl = serverState.viteServer.url;
      } else if (viewMode === 'components' && serverState.storybookServer?.url) {
        serverUrl = serverState.storybookServer.url;
      }
      
      if (serverUrl) {
        const result = await captureThumbnail(project.id, serverUrl);
        if (result.success) {
          console.log('✅ Manual thumbnail refresh successful');
        } else {
          console.warn('❌ Manual thumbnail refresh failed:', result.error);
        }
      } else {
        console.warn('🚫 No server available for thumbnail refresh');
      }
    } catch (error) {
      console.error('❌ Manual thumbnail refresh error:', error);
    }
  };

  const handleModeChange = (mode: ViewMode) => {
    console.log('🔄 Mode change requested:', { from: viewMode, to: mode });
    try {
      setViewMode(mode);
      console.log('✅ Mode change successful');
    } catch (error) {
      console.error('❌ Error during mode change:', error);
    }
  };

  
  

  const handleTerminalToggle = () => {
    setIsTerminalOpen(!isTerminalOpen);
  };

  const handleTerminalClose = () => {
    setIsTerminalOpen(false);
  };

  const handleTerminalResize = (widthPixels: number) => {
    setTerminalWidth(widthPixels);
  };

  // Terminal resize handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isTerminalResizing) return;
      
      // Prevent default to ensure we capture all mouse movements
      e.preventDefault();
      
      // Find the project-content container
      const container = document.querySelector('[data-section="content"]') as HTMLElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const terminalWidthPixels = rect.width - mouseX;
      
      // Apply constraints
      const minWidthPixels = 200;
      const maxWidthPixels = rect.width * 0.75;
      const constrainedWidth = Math.max(minWidthPixels, Math.min(maxWidthPixels, terminalWidthPixels));
      
      setTerminalWidth(constrainedWidth);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsTerminalResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };

    // Add mouseleave handler to prevent resize from stopping when cursor leaves window
    const handleMouseLeave = (e: MouseEvent) => {
      // Only stop resizing if mouse actually left the window, not just a child element
      if (e.target === document.documentElement) {
        setIsTerminalResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
      }
    };

    if (isTerminalResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none'; // Prevent interference from other elements
      
      // Use capture phase to ensure we get all events
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      // Clean up styles in case component unmounts during resize
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };
  }, [isTerminalResizing]);

  const handleTerminalResizeStart = () => {
    setIsTerminalResizing(true);
  };


  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleFullscreenClose = (e?: React.MouseEvent) => {
    // Prevent closing if this was triggered by a drag operation
    if (hasBeenDragged) {
      setHasBeenDragged(false);
      return;
    }
    
    setIsFullscreen(false);
    // Reset close button position when exiting fullscreen
    setCloseButtonPosition({ x: 0, y: 0 });
  };

  // Handle close button dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingCloseButton || !closeButtonRef.current) return;

      const container = closeButtonRef.current.offsetParent as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const buttonWidth = closeButtonRef.current.offsetWidth;
      const buttonHeight = closeButtonRef.current.offsetHeight;

      // Calculate new position relative to container
      const newX = e.clientX - containerRect.left - buttonWidth / 2;
      const newY = e.clientY - containerRect.top - buttonHeight / 2;

      // Constrain to container bounds
      const clampedX = Math.max(0, Math.min(containerRect.width - buttonWidth, newX));
      const clampedY = Math.max(0, Math.min(containerRect.height - buttonHeight, newY));

      setCloseButtonPosition({ x: clampedX, y: clampedY });
      setHasBeenDragged(true); // Mark that dragging has occurred
    };

    const handleMouseUp = () => {
      setIsDraggingCloseButton(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDraggingCloseButton) {
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCloseButton]);

  const handleCloseButtonMouseDown = (e: React.MouseEvent) => {
    // Prevent click event when starting drag
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCloseButton(true);
    setHasBeenDragged(false); // Reset drag flag when starting new drag
  };

  const handleBackWithCleanup = async () => {
    // Stop servers when leaving project view
    await stopServers();
    
    // Clean up terminals for this project
    try {
      await window.electronAPI.terminal.destroyProject(project.id);
      console.log(`[ProjectViewer] Cleaned up terminals for project ${project.name}`);
    } catch (error) {
      console.error(`[ProjectViewer] Failed to cleanup terminals for project ${project.name}:`, error);
    }
    
    onBack();
  };

  return (
    <motion.div
      className="project-viewer flex flex-col w-full h-full"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      data-component="project-viewer"
      data-project-id={project.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Header - hidden in fullscreen */}
      {!isFullscreen && (
        <ProjectHeader
          project={project}
          viewMode={viewMode}
          isTerminalOpen={isTerminalOpen}
          isFullscreen={isFullscreen}
          serverState={serverState}
          onBack={handleBackWithCleanup}
          onModeChange={handleModeChange}
          onTerminalToggle={handleTerminalToggle}
          onFullscreenToggle={handleFullscreenToggle}
          onThumbnailRefresh={handleThumbnailRefresh}
          data-section="header"
        />
      )}

      {/* Main Content Area */}
      <div 
        className={`project-content flex flex-1 overflow-hidden relative ${isFullscreen ? 'absolute inset-0 z-50' : ''}`}
        data-section="content"
        data-fullscreen={isFullscreen}
      >
        {/* Main Content */}
        <div 
          className="main-content-wrapper flex flex-col relative"
          style={{
            width: isFullscreen ? '100%' : (isTerminalOpen ? `calc(100% - ${terminalWidth}px)` : '100%')
          }}
          data-section="main-content"
        >
          <MainContent
            project={project}
            viewMode={viewMode}
            serverState={serverState}
            isFullscreen={isFullscreen}
            onRetryConnection={retryConnection}
            data-content="embedded-view"
          />
          
          {/* Floating draggable close button for fullscreen */}
          {isFullscreen && (
            <motion.button
              ref={closeButtonRef}
              onClick={handleFullscreenClose}
              onMouseDown={handleCloseButtonMouseDown}
              className="fullscreen-close absolute z-10 p-2 transition-colors select-none"
              style={{
                top: closeButtonPosition.y || 16,
                left: closeButtonPosition.x || 'calc(100% - 56px)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                backdropFilter: 'blur(4px)',
                cursor: isDraggingCloseButton ? 'grabbing' : 'grab'
              }}
              onMouseEnter={(e) => {
                if (!isDraggingCloseButton) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDraggingCloseButton) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                }
              }}
              whileHover={{ scale: isDraggingCloseButton ? 1 : 1.1 }}
              whileTap={{ scale: isDraggingCloseButton ? 1 : 0.9 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              title={isDraggingCloseButton ? "Drag to move" : "Exit fullscreen (drag to move)"}
              data-control="fullscreen-close"
              data-dragging={isDraggingCloseButton}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </div>

        {/* Drag Handle - positioned between main content and terminal */}
        {!isFullscreen && isTerminalOpen && (
          <div
            className="terminal-drag-handle absolute w-1 cursor-col-resize z-20 group top-0 bottom-0"
            style={{ 
              right: `${terminalWidth}px`,
              marginRight: '-2px'
            }}
            onMouseDown={handleTerminalResizeStart}
            title="Drag to resize terminal"
            data-control="terminal-resize-handle"
          >
            <div 
              className="w-full h-full transition-colors group-hover:bg-blue-500 group-hover:bg-opacity-50"
              style={{ 
                backgroundColor: isTerminalResizing ? 'var(--color-action-primary)' : 'transparent'
              }}
            />
          </div>
        )}

        {/* Terminal Pane - hidden in fullscreen */}
        {!isFullscreen && (
          <AnimatePresence>
            {isTerminalOpen && (
              <div
                ref={terminalWrapperRef}
                className="terminal-wrapper border-l relative"
                style={{ 
                  width: `${terminalWidth}px`,
                  borderColor: 'var(--color-border-secondary)',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
                data-section="terminal"
              >
                <TerminalPane
                  project={project}
                  onClose={handleTerminalClose}
                  onResize={handleTerminalResize}
                  data-component="terminal-pane"
                />
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};