import { motion } from 'framer-motion';
import { Project } from '../types/Project';
import { ViewMode } from './ProjectViewer';

interface MainContentProps {
  project: Project;
  viewMode: ViewMode;
  isFullscreen?: boolean;
  'data-content'?: string;
}

export const MainContent = ({ 
  project, 
  viewMode, 
  isFullscreen = false,
  'data-content': dataContent 
}: MainContentProps) => {
  
  const renderContent = () => {
    switch (viewMode) {
      case 'preview':
        return (
          <div 
            className="preview-content flex items-center justify-center flex-1"
            data-view="preview"
          >
            <div className="preview-placeholder flex flex-col items-center gap-4 text-center">
              <div 
                className="placeholder-icon w-16 h-16 flex items-center justify-center border-2 border-dashed"
                style={{ 
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="placeholder-text">
                <h3 
                  className="text-lg font-medium mb-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Preview Mode
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Vite development server will be embedded here
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'components':
        return (
          <div 
            className="components-content flex items-center justify-center flex-1"
            data-view="components"
          >
            <div className="components-placeholder flex flex-col items-center gap-4 text-center">
              <div 
                className="placeholder-icon w-16 h-16 flex items-center justify-center border-2 border-dashed"
                style={{ 
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="placeholder-text">
                <h3 
                  className="text-lg font-medium mb-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Components Mode
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Storybook interface will be embedded here
                </p>
              </div>
            </div>
          </div>
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