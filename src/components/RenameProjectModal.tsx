import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';

interface RenameProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onRename: (project: Project, newName: string) => Promise<void>;
  existingProjects: Project[];
}

export const RenameProjectModal = ({ 
  isOpen, 
  project, 
  onClose, 
  onRename,
  existingProjects 
}: RenameProjectModalProps) => {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && project) {
      setNewName(project.name);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, project]);

  // Validation function
  const validateName = (name: string): string | null => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return 'Project name is required';
    }
    
    if (trimmedName.length < 2) {
      return 'Project name must be at least 2 characters';
    }
    
    if (trimmedName.length > 50) {
      return 'Project name must be less than 50 characters';
    }
    
    // Check for invalid characters (basic filesystem safety)
    if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(trimmedName)) {
      return 'Project name can only contain letters, numbers, spaces, hyphens, underscores, and periods';
    }
    
    // Check for duplicate names (case-insensitive, excluding current project)
    const isDuplicate = existingProjects.some(p => 
      p.id !== project?.id && 
      p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (isDuplicate) {
      return 'A project with this name already exists';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || isSubmitting) return;

    const trimmedName = newName.trim();
    const validationError = validateName(trimmedName);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    // If name hasn't changed, just close modal
    if (trimmedName === project.name) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onRename(project, trimmedName);
      onClose();
    } catch (error) {
      console.error('Failed to rename project:', error);
      setError(error instanceof Error ? error.message : 'Failed to rename project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            data-component="modal-backdrop"
          >
            {/* Modal */}
            <motion.div
              className="w-full max-w-md flex flex-col"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-secondary)'
              }}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              data-component="rename-project-modal"
            >
              {/* Header */}
              <div 
                className="modal-header px-6 py-4 border-b"
                style={{ borderColor: 'var(--color-border-secondary)' }}
              >
                <h2 
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Rename Project
                </h2>
                <p 
                  className="text-sm mt-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Rename "{project.name}"
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="modal-body p-6">
                <div className="form-field">
                  <label 
                    htmlFor="project-name" 
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    New Project Name *
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setError(''); // Clear error when user types
                    }}
                    className="w-full px-3 py-2 text-sm border transition-colors focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: error ? '#ef4444' : 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = error ? '#ef4444' : 'var(--color-border-focus)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = error ? '#ef4444' : 'var(--color-border-primary)';
                    }}
                    placeholder="Enter new project name"
                    disabled={isSubmitting}
                    autoFocus
                    required
                  />
                  
                  {/* Error message */}
                  {error && (
                    <motion.p 
                      className="text-sm mt-2"
                      style={{ color: '#ef4444' }}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {error}
                    </motion.p>
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
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                  whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!newName.trim() || isSubmitting || newName.trim() === project.name}
                  className="px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--color-action-primary)',
                    color: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-action-primary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting && newName.trim() && newName.trim() !== project.name) {
                      e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
                    }
                  }}
                  whileHover={!isSubmitting && newName.trim() && newName.trim() !== project.name ? { scale: 1.02 } : {}}
                  whileTap={!isSubmitting && newName.trim() && newName.trim() !== project.name ? { scale: 0.98 } : {}}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Renaming...
                    </>
                  ) : (
                    'Rename Project'
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};