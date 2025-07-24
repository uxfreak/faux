import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const CreateProjectModal = ({ isOpen, onClose, onCreateProject }: CreateProjectModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onCreateProject({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined
    });

    // Reset form
    setFormData({ name: '', description: '' });
    onClose();
  };


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
            disabled={!formData.name.trim()}
            className="px-4 py-2 text-sm  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-action-primary)',
              color: formData.name.trim() ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
              borderColor: 'var(--color-action-primary)'
            }}
            onMouseEnter={(e) => {
              if (formData.name.trim()) {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (formData.name.trim()) {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
              }
            }}
            whileHover={formData.name.trim() ? { scale: 1.02 } : {}}
            whileTap={formData.name.trim() ? { scale: 0.98 } : {}}
          >
            Create Project
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};