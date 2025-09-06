import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodexApprovalRequest } from '../services/codexIPC';

interface CodexApprovalDialogProps {
  approval: CodexApprovalRequest | null;
  isOpen: boolean;
  onApprove: (callId: string, feedback?: string) => void;
  onDeny: (callId: string, feedback?: string) => void;
  onAlways: (callId: string, feedback?: string) => void;
  onClose: () => void;
  'data-component'?: string;
}

export const CodexApprovalDialog = ({
  approval,
  isOpen,
  onApprove,
  onDeny,
  onAlways,
  onClose,
  'data-component': dataComponent
}: CodexApprovalDialogProps) => {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!approval) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(approval.id, feedback);
      handleClose();
    } catch (error) {
      console.error('Approval error:', error);
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    try {
      await onDeny(approval.id, feedback);
      handleClose();
    } catch (error) {
      console.error('Deny error:', error);
      setIsSubmitting(false);
    }
  };

  const handleAlways = async () => {
    setIsSubmitting(true);
    try {
      await onAlways(approval.id, feedback);
      handleClose();
    } catch (error) {
      console.error('Always error:', error);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedback('');
    setIsSubmitting(false);
    onClose();
  };

  const getApprovalIcon = () => {
    switch (approval.type) {
      case 'exec-approval':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m13 0h-6" />
          </svg>
        );
      case 'patch-approval':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getApprovalTitle = () => {
    switch (approval.type) {
      case 'exec-approval':
        return 'Command Execution Request';
      case 'patch-approval':
        return 'File Modification Request';
      default:
        return 'AI Assistant Request';
    }
  };

  const getApprovalDescription = () => {
    switch (approval.type) {
      case 'exec-approval':
        return 'The AI assistant wants to execute a command on your system.';
      case 'patch-approval':
        return 'The AI assistant wants to modify files in your project.';
      default:
        return 'The AI assistant is requesting permission to perform an action.';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={handleClose}
          >
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-md w-full max-h-[80vh] overflow-auto rounded-lg shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface-primary)',
                border: '1px solid var(--color-border-primary)'
              }}
              onClick={e => e.stopPropagation()}
              data-component={dataComponent}
            >
              {/* Header */}
              <div 
                className="px-6 py-4 border-b"
                style={{ borderColor: 'var(--color-border-primary)' }}
              >
                <div className="flex items-center">
                  <div 
                    className="mr-3 p-2 rounded-lg"
                    style={{ 
                      backgroundColor: 'var(--color-accent-primary)',
                      color: 'var(--color-button-text)'
                    }}
                  >
                    {getApprovalIcon()}
                  </div>
                  <div>
                    <h3 
                      className="text-lg font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {getApprovalTitle()}
                    </h3>
                    <p 
                      className="text-sm mt-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {getApprovalDescription()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                {/* Command/Description */}
                {approval.command && (
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Command to execute:
                    </label>
                    <div 
                      className="p-3 rounded-lg font-mono text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-secondary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      {Array.isArray(approval.command) ? approval.command.join(' ') : approval.command}
                    </div>
                  </div>
                )}

                {approval.description && (
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Description:
                    </label>
                    <div 
                      className="p-3 rounded-lg text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-secondary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      {approval.description}
                    </div>
                  </div>
                )}

                {/* Working Directory */}
                {approval.cwd && (
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Working directory:
                    </label>
                    <div 
                      className="p-3 rounded-lg font-mono text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-secondary)',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      {approval.cwd}
                    </div>
                  </div>
                )}

                {/* Optional Feedback */}
                <div>
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Optional feedback or instructions:
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Add any additional context or constraints..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg resize-none focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div 
                className="px-6 py-4 border-t flex flex-col space-y-3"
                style={{ borderColor: 'var(--color-border-primary)' }}
              >
                {/* Primary Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--color-accent-primary)',
                      color: 'var(--color-button-text)',
                      opacity: isSubmitting ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
                    }}
                  >
                    {isSubmitting ? 'Processing...' : 'Approve Once'}
                  </button>
                  <button
                    onClick={handleDeny}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                    style={{
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                      opacity: isSubmitting ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                    }}
                  >
                    Deny
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleAlways}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-accent-primary)',
                      color: 'var(--color-accent-primary)',
                      opacity: isSubmitting ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
                        e.currentTarget.style.color = 'var(--color-button-text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--color-accent-primary)';
                    }}
                  >
                    Always Approve Similar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};