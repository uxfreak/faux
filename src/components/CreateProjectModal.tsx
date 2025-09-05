import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';
import { ProgressModal } from './ProgressModal';
import { ScaffoldOptions, ScaffoldProgress, ScaffoldResult } from '../types/electron';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> & { path?: string }) => void;
}

export const CreateProjectModal = ({ isOpen, onClose, onCreateProject }: CreateProjectModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customPath: ''
  });
  
  const [isScaffolding, setIsScaffolding] = useState(false);
  const [scaffoldProgress, setScaffoldProgress] = useState<ScaffoldProgress & { projectName: string } | null>(null);
  const [useCustomPath, setUseCustomPath] = useState(false);
  
  const progressCleanupRef = useRef<(() => void) | null>(null);


  const getProjectPath = () => {
    if (useCustomPath && formData.customPath.trim()) {
      return formData.customPath.trim();
    }
    // Default to ~/faux-projects/{project-name}
    return undefined; // Let scaffolding service use default
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || isScaffolding) return;

    setIsScaffolding(true);
    setScaffoldProgress({
      projectName: formData.name.trim(),
      steps: [],
      progress: 0,
      currentStep: 0 // This should match the ScaffoldProgress interface (number is correct)
    });

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Setup progress listener
      const cleanup = window.electronAPI.onScaffoldProgress((progress) => {
        setScaffoldProgress(progress);
      });
      progressCleanupRef.current = cleanup;

      // Start scaffolding
      const scaffoldOptions: ScaffoldOptions = {
        projectName: formData.name.trim(),
        targetPath: getProjectPath()
      };

      const result = await window.electronAPI.scaffoldProject(scaffoldOptions);

      if (result.success) {
        // Create project in database
        const projectData = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          path: result.projectPath
        };

        onCreateProject(projectData);
        
        // Give a moment for progress to update to 100% before closing
        setTimeout(() => {
          // Reset form and close
          setFormData({ name: '', description: '', customPath: '' });
          setIsScaffolding(false);
          setScaffoldProgress(null);
          onClose();
        }, 500);
      } else {
        throw new Error(result.error || 'Scaffolding failed');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      setScaffoldProgress(prev => prev ? {
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      } : null);
    }
  };

  // Cleanup progress listener on unmount
  useEffect(() => {
    return () => {
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
      }
    };
  }, []);


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center" 
          style={{ backgroundColor: 'var(--color-bg-overlay)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="modal-backdrop absolute inset-0" 
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          <motion.div 
            className="modal-content relative w-full max-w-md mx-4  shadow-xl"
            style={{ 
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)'
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              type: "spring",
              duration: 0.4,
              bounce: 0.3
            }}
          >
        {/* Header */}
        <div 
          className="modal-header px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border-secondary)' }}
        >
          <div className="flex items-center justify-between">
            <h2 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Create New Project
            </h2>
            <motion.button
              onClick={onClose}
              className="modal-close p-1  hover:bg-opacity-10 transition-colors"
              style={{ 
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body p-6 space-y-4">
          {/* Project Name */}
          <div className="form-field">
            <label 
              htmlFor="project-name" 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Project Name *
            </label>
            <input
              id="project-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border transition-colors focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-border-focus)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border-primary)';
              }}
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Description */}
          <div className="form-field">
            <label 
              htmlFor="project-description" 
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Description
            </label>
            <textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm  border transition-colors focus:outline-none resize-none"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-border-focus)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border-primary)';
              }}
              placeholder="Brief description of your project"
            />
          </div>

          {/* Project Path */}
          <div className="form-field">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="custom-path"
                checked={useCustomPath}
                onChange={(e) => setUseCustomPath(e.target.checked)}
                className="w-4 h-4"
              />
              <label 
                htmlFor="custom-path" 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Custom project path
              </label>
            </div>
            
            {useCustomPath && (
              <input
                type="text"
                value={formData.customPath}
                onChange={(e) => setFormData(prev => ({ ...prev, customPath: e.target.value }))}
                className="w-full px-3 py-2 text-sm border transition-colors focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-border-focus)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-primary)';
                }}
                placeholder="/path/to/your/project"
              />
            )}
            
            {!useCustomPath && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Default: ~/faux-projects/{formData.name.trim() || 'project-name'}
              </p>
            )}
          </div>


        </form>

        {/* Footer */}
        <div 
          className="modal-footer px-6 py-4 border-t flex justify-end gap-3"
          style={{ borderColor: 'var(--color-border-secondary)' }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm  border transition-colors"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || isScaffolding}
            className="px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-action-primary)',
              color: (formData.name.trim() && !isScaffolding) ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
              borderColor: 'var(--color-action-primary)'
            }}
            onMouseEnter={(e) => {
              if (formData.name.trim() && !isScaffolding) {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (formData.name.trim() && !isScaffolding) {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
              }
            }}
            whileHover={(formData.name.trim() && !isScaffolding) ? { scale: 1.02 } : {}}
            whileTap={(formData.name.trim() && !isScaffolding) ? { scale: 0.98 } : {}}
          >
            {isScaffolding && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isScaffolding ? 'Creating...' : 'Create Project'}
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* Progress Modal */}
      {scaffoldProgress && (
        <ProgressModal
          isOpen={true}
          title={`Creating ${scaffoldProgress.projectName}`}
          steps={scaffoldProgress.steps}
          progress={scaffoldProgress.progress}
          error={scaffoldProgress.error || undefined}
        />
      )}
    </AnimatePresence>
  );
};