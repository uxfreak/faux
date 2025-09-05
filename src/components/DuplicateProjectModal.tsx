import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types/Project';
import { ProgressModal } from './ProgressModal';
import { DuplicateProgress, DuplicateResult } from '../types/electron';

interface DuplicateProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onDuplicateComplete: (duplicatedProject: Project) => void;
}

interface DuplicateStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export const DuplicateProjectModal = ({ 
  isOpen, 
  project, 
  onClose, 
  onDuplicateComplete 
}: DuplicateProjectModalProps) => {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [steps, setSteps] = useState<DuplicateStep[]>([]);
  
  const progressCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  // Initialize steps when modal opens
  useEffect(() => {
    if (isOpen && project) {
      setSteps([
        { id: 'database', label: 'Creating database entry', status: 'pending' },
        { id: 'copy', label: 'Copying project files', status: 'pending' },
        { id: 'config', label: 'Updating configuration', status: 'pending' },
        { id: 'install', label: 'Installing dependencies', status: 'pending' },
        { id: 'thumbnail', label: 'Generating thumbnail', status: 'pending' },
        { id: 'complete', label: 'Finalizing duplication', status: 'pending' }
      ]);
      setCurrentMessage('');
      setIsDuplicating(false);
    }
  }, [isOpen, project]);

  // Start duplication when modal opens
  useEffect(() => {
    if (isOpen && project && !isDuplicating) {
      startDuplication();
    }
  }, [isOpen, project]);

  // Setup progress listener
  useEffect(() => {
    if (!window.electronAPI?.onDuplicateProgress || !isOpen) return;

    const cleanup = window.electronAPI.onDuplicateProgress((data: DuplicateProgress) => {
      console.log('📋 Duplicate progress:', data);
      setCurrentMessage(data.message);
      
      // Update steps based on progress
      if (data.progress <= 10) {
        updateStepStatus('database', 'active');
      } else if (data.progress <= 85) {
        updateStepStatus('database', 'completed');
        updateStepStatus('copy', 'active');
      } else if (data.progress <= 90) {
        updateStepStatus('copy', 'completed');
        updateStepStatus('config', 'active');
      } else if (data.progress <= 95) {
        updateStepStatus('config', 'completed');
        updateStepStatus('install', 'active');
      } else if (data.progress < 100) {
        updateStepStatus('install', 'completed');
        updateStepStatus('thumbnail', 'active');
      }

      if (data.status === 'error') {
        const activeStep = steps.find(step => step.status === 'active');
        if (activeStep) {
          updateStepStatus(activeStep.id, 'error');
        }
      }
    });

    progressCleanupRef.current = cleanup;
    return cleanup;
  }, [isOpen, steps]);

  // Setup completion listener
  useEffect(() => {
    if (!window.electronAPI?.onDuplicateComplete || !isOpen) return;

    const cleanup = window.electronAPI.onDuplicateComplete((data: { sourceProject: any; duplicateProject: any }) => {
      console.log('✅ Duplication complete:', data);
      
      // Mark all steps as completed
      setSteps(prev => prev.map(step => ({ ...step, status: 'completed' as const })));
      setCurrentMessage('Project duplicated successfully!');
      
      // Close modal after a brief delay
      setTimeout(() => {
        setIsDuplicating(false);
        onDuplicateComplete(data.duplicateProject);
        onClose();
      }, 1500);
    });

    completeCleanupRef.current = cleanup;
    return cleanup;
  }, [isOpen, onClose, onDuplicateComplete]);

  // Cleanup listeners when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
        progressCleanupRef.current = null;
      }
      if (completeCleanupRef.current) {
        completeCleanupRef.current();
        completeCleanupRef.current = null;
      }
    }
  }, [isOpen]);

  const updateStepStatus = (stepId: string, status: DuplicateStep['status']) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const startDuplication = async () => {
    if (!project || isDuplicating) return;

    setIsDuplicating(true);
    updateStepStatus('database', 'active');
    setCurrentMessage('Starting duplication...');

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Start the duplication process
      const result = await window.electronAPI.duplicateProject(project.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Duplication failed');
      }

      // Success is handled by the completion listener
    } catch (error) {
      console.error('Duplication failed:', error);
      setCurrentMessage(`Failed to duplicate project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Mark current active step as error
      const activeStep = steps.find(step => step.status === 'active');
      if (activeStep) {
        updateStepStatus(activeStep.id, 'error');
      }
      
      setIsDuplicating(false);
      
      // Show error for a moment then close
      setTimeout(() => {
        onClose();
      }, 3000);
    }
  };

  const handleClose = () => {
    if (!isDuplicating) {
      onClose();
    }
  };

  if (!project) return null;

  return (
    <ProgressModal
      isOpen={isOpen}
      title={`Duplicating "${project.name}"`}
      steps={steps}
      currentMessage={currentMessage}
      onClose={handleClose}
      closeable={!isDuplicating}
      data-component="duplicate-project-modal"
    />
  );
};