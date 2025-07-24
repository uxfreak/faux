import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectHeader } from './ProjectHeader';
import { MainContent } from './MainContent';
import { TerminalPane } from './TerminalPane';
import { Project } from '../types/Project';
import { useProjectServers } from '../hooks/useProjectServers';

export type ViewMode = 'preview' | 'components';

interface ProjectViewerProps {
  project: Project;
  onBack: () => void;
}

export const ProjectViewer = ({ project, onBack }: ProjectViewerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalWidth, setTerminalWidth] = useState(30); // Default 30%
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closeButtonPosition, setCloseButtonPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCloseButton, setIsDraggingCloseButton] = useState(false);
  const [hasBeenDragged, setHasBeenDragged] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Server management
  const { serverState, startServers, stopServers, retryConnection } = useProjectServers(project);

  // Auto-start servers when project opens
  useEffect(() => {
    startServers();
  }, [project.id]); // Re-start if project changes

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleTerminalToggle = () => {
    setIsTerminalOpen(!isTerminalOpen);
  };

  const handleTerminalClose = () => {
    setIsTerminalOpen(false);
  };

  const handleTerminalResize = (width: number) => {
    setTerminalWidth(width);
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
          data-section="header"
        />
      )}

      {/* Main Content Area */}
      <div 
        className={`project-content flex flex-1 overflow-hidden ${isFullscreen ? 'absolute inset-0 z-50' : ''}`}
        data-section="content"
        data-fullscreen={isFullscreen}
      >
        {/* Main Content */}
        <div 
          className="main-content-wrapper flex flex-col transition-all duration-300 relative"
          style={{
            width: isFullscreen ? '100%' : (isTerminalOpen ? `${100 - terminalWidth}%` : '100%')
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

        {/* Terminal Pane - hidden in fullscreen */}
        {!isFullscreen && (
          <AnimatePresence>
            {isTerminalOpen && (
              <motion.div
                className="terminal-wrapper border-l"
                style={{ 
                  width: `${terminalWidth}%`,
                  borderColor: 'var(--color-border-secondary)',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
                data-section="terminal"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${terminalWidth}%`, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <TerminalPane
                  project={project}
                  onClose={handleTerminalClose}
                  onResize={handleTerminalResize}
                  data-component="terminal-pane"
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};