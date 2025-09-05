import { useState } from 'react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectCardSkeleton } from './ProjectCardSkeleton';
import { ContentLoader } from './ContentLoader';
import { ProgressModal } from './ProgressModal';
import { TerminalCommandIndicator } from './TerminalCommandIndicator';

interface LoadingStatesDemoProps {
  onBack?: () => void;
}

export const LoadingStatesDemo = ({ onBack }: LoadingStatesDemoProps = {}) => {
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([
    { id: 'scaffold', label: 'Scaffolding project structure', status: 'completed' as const },
    { id: 'dependencies', label: 'Installing dependencies', status: 'active' as const },
    { id: 'config', label: 'Setting up configuration', status: 'pending' as const },
    { id: 'finalize', label: 'Finalizing project', status: 'pending' as const },
  ]);

  const simulateProgress = () => {
    setShowProgressModal(true);
    
    // Simulate progress updates
    setTimeout(() => {
      setProgressSteps(prev => prev.map(step => 
        step.id === 'dependencies' ? { ...step, status: 'completed' } :
        step.id === 'config' ? { ...step, status: 'active' } : step
      ));
    }, 2000);

    setTimeout(() => {
      setProgressSteps(prev => prev.map(step => 
        step.id === 'config' ? { ...step, status: 'completed' } :
        step.id === 'finalize' ? { ...step, status: 'active' } : step
      ));
    }, 4000);

    setTimeout(() => {
      setProgressSteps(prev => prev.map(step => 
        step.id === 'finalize' ? { ...step, status: 'completed' } : step
      ));
      setTimeout(() => setShowProgressModal(false), 1000);
    }, 6000);
  };

  return (
    <div 
      className="loading-states-demo w-full h-full p-8 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      data-component="loading-demo"
    >
      <div className="demo-content max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="demo-header space-y-4">
          {/* Back button */}
          {onBack && (
            <div className="demo-navigation">
              <motion.button
                onClick={onBack}
                className="back-button flex items-center gap-2 transition-colors"
                style={{ 
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Projects
              </motion.button>
            </div>
          )}
          
          <div className="demo-title-section text-center space-y-4">
            <h1 
              className="demo-title text-3xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Loading States Demo
            </h1>
            <p 
              className="demo-subtitle text-lg"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Preview all loading states and animations
            </p>
          </div>
        </div>

        {/* Loading Spinners */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Loading Spinners
          </h2>
          
          <div className="spinners-grid grid grid-cols-3 gap-8">
            <div className="spinner-demo text-center space-y-3">
              <h3 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Small
              </h3>
              <div className="flex justify-center">
                <LoadingSpinner size="sm" color="primary" />
              </div>
            </div>
            
            <div className="spinner-demo text-center space-y-3">
              <h3 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Medium
              </h3>
              <div className="flex justify-center">
                <LoadingSpinner size="md" color="primary" />
              </div>
            </div>

            <div className="spinner-demo text-center space-y-3">
              <h3 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Large
              </h3>
              <div className="flex justify-center">
                <LoadingSpinner size="lg" color="primary" />
              </div>
            </div>
          </div>
        </section>

        {/* Project Card Skeletons */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Project Card Skeletons
          </h2>
          
          <div className="cards-grid grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <ProjectCardSkeleton key={i} data-component={`skeleton-${i}`} />
            ))}
          </div>
        </section>

        {/* Content Loaders */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Content Loaders
          </h2>
          
          <div className="loaders-grid grid grid-cols-2 gap-8">
            <div className="loader-demo space-y-3">
              <h3 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Placeholder Variant
              </h3>
              <div 
                className="loader-container h-48 border relative"
                style={{ 
                  borderColor: 'var(--color-border-secondary)',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
              >
                <ContentLoader 
                  message="Starting Vite server" 
                  variant="placeholder"
                />
              </div>
            </div>

            <div className="loader-demo space-y-3">
              <h3 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Overlay Variant
              </h3>
              <div 
                className="loader-container h-48 border relative"
                style={{ 
                  borderColor: 'var(--color-border-secondary)',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
              >
                {/* Fake content behind overlay */}
                <div className="fake-content p-4 space-y-2">
                  <div 
                    className="h-4 w-3/4"
                    style={{ backgroundColor: 'var(--color-surface-hover)' }}
                  />
                  <div 
                    className="h-4 w-1/2"
                    style={{ backgroundColor: 'var(--color-surface-hover)' }}
                  />
                  <div 
                    className="h-4 w-2/3"
                    style={{ backgroundColor: 'var(--color-surface-hover)' }}
                  />
                </div>
                
                <ContentLoader 
                  message="Switching to Components mode" 
                  variant="overlay"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Progress Modal */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Progress Modal
          </h2>
          
          <div className="modal-demo">
            <motion.button
              onClick={simulateProgress}
              className="demo-button px-6 py-3 transition-colors"
              style={{
                backgroundColor: 'var(--color-action-primary)',
                color: 'var(--color-bg-primary)',
                border: '1px solid var(--color-action-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Simulate Project Creation
            </motion.button>
          </div>
        </section>

        {/* Terminal Command Indicators */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Terminal Command Indicators
          </h2>
          
          <div 
            className="terminal-demo p-4 space-y-4 font-mono"
            style={{ 
              backgroundColor: '#1a1a1a',
              color: '#ffffff'
            }}
          >
            <TerminalCommandIndicator
              command="npm install"
              status="completed"
              duration={3240}
              output={[
                "added 1421 packages from 837 contributors",
                "audited 1421 packages in 3.24s",
                "found 0 vulnerabilities"
              ]}
            />
            
            <TerminalCommandIndicator
              command="npm run dev"
              status="running"
              output={[
                "Local:   http://localhost:5173/",
                "Network: http://192.168.1.100:5173/"
              ]}
            />
            
            <TerminalCommandIndicator
              command="npm run build"
              status="error"
              output={[
                "Error: Module not found: Error: Can't resolve './missing-file'",
                "Build failed with 1 error"
              ]}
            />
          </div>
        </section>

        {/* Button Loading States */}
        <section className="demo-section space-y-6">
          <h2 
            className="section-title text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Button Loading States
          </h2>
          
          <div className="buttons-grid grid grid-cols-3 gap-6">
            <motion.button
              className="demo-button px-4 py-2 flex items-center justify-center gap-2 transition-colors"
              style={{
                backgroundColor: 'var(--color-action-primary)',
                color: 'var(--color-bg-primary)',
                border: '1px solid var(--color-action-primary)',
                opacity: 0.7,
                cursor: 'not-allowed'
              }}
              disabled
            >
              <LoadingSpinner size="sm" color="white" />
              Opening Project...
            </motion.button>

            <motion.button
              className="demo-button px-4 py-2 flex items-center justify-center gap-2 transition-colors"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-secondary)',
                opacity: 0.7,
                cursor: 'not-allowed'
              }}
              disabled
            >
              <LoadingSpinner size="sm" color="secondary" />
              Deleting...
            </motion.button>

            <motion.button
              className="demo-button px-4 py-2 flex items-center justify-center gap-2 transition-colors"
              style={{
                backgroundColor: 'var(--color-action-primary)',
                color: 'var(--color-bg-primary)',
                border: '1px solid var(--color-action-primary)',
                opacity: 0.7,
                cursor: 'not-allowed'
              }}
              disabled
            >
              <LoadingSpinner size="sm" color="white" />
              Installing...
            </motion.button>
          </div>
        </section>

      </div>

      {/* Progress Modal */}
      <ProgressModal
        isOpen={showProgressModal}
        title="Creating New Project"
        steps={progressSteps}
        currentMessage="This may take a few moments..."
        onClose={() => setShowProgressModal(false)}
        closeable={false}
        data-component="demo-progress-modal"
      />
    </div>
  );
};