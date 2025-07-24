import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressModalProps {
  isOpen: boolean;
  title: string;
  steps: ProgressStep[];
  currentMessage?: string;
  onClose?: () => void;
  closeable?: boolean;
  'data-component'?: string;
}

export const ProgressModal = ({
  isOpen,
  title,
  steps,
  currentMessage,
  onClose,
  closeable = false,
  'data-component': dataComponent
}: ProgressModalProps) => {
  const currentStep = steps.find(step => step.status === 'active');
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="progress-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeable ? onClose : undefined}
            data-component="modal-backdrop"
          >
            {/* Modal */}
            <motion.div
              className="progress-modal w-full max-w-md p-6 flex flex-col gap-6"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-secondary)',
                border: '1px solid'
              }}
              data-component={dataComponent}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="modal-header flex items-center justify-between" data-section="header">
                <h2 
                  className="modal-title text-lg font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {title}
                </h2>
                
                {closeable && onClose && (
                  <motion.button
                    onClick={onClose}
                    className="close-button p-1 transition-colors"
                    style={{ 
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="progress-section" data-section="progress">
                <div 
                  className="progress-bar w-full h-2 overflow-hidden mb-2"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                >
                  <motion.div
                    className="progress-fill h-full"
                    style={{ backgroundColor: 'var(--color-action-primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                
                <div className="progress-text flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    Step {completedSteps + 1} of {totalSteps}
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>

              {/* Steps List */}
              <div className="steps-section" data-section="steps">
                <div className="steps-list flex flex-col gap-3">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      className="step-item flex items-center gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      data-step={step.id}
                      data-status={step.status}
                    >
                      {/* Step Icon */}
                      <div className="step-icon flex items-center justify-center w-6 h-6">
                        {step.status === 'completed' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="var(--color-action-primary)" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.div>
                        )}
                        
                        {step.status === 'active' && (
                          <LoadingSpinner size="sm" color="primary" />
                        )}
                        
                        {step.status === 'error' && (
                          <svg className="w-5 h-5" fill="none" stroke="var(--color-error)" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        
                        {step.status === 'pending' && (
                          <div 
                            className="step-pending w-2 h-2 rounded-full"
                            style={{ backgroundColor: 'var(--color-border-secondary)' }}
                          />
                        )}
                      </div>
                      
                      {/* Step Label */}
                      <span 
                        className="step-label text-sm"
                        style={{ 
                          color: step.status === 'active' 
                            ? 'var(--color-text-primary)' 
                            : 'var(--color-text-secondary)',
                          fontWeight: step.status === 'active' ? 500 : 400
                        }}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Current Message */}
              {currentMessage && (
                <motion.div
                  className="message-section p-3"
                  style={{ 
                    backgroundColor: 'var(--color-surface-hover)',
                    borderColor: 'var(--color-border-secondary)',
                    border: '1px solid'
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-section="message"
                >
                  <p 
                    className="message-text text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {currentMessage}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};