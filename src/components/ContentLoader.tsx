import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

interface ContentLoaderProps {
  message?: string;
  showSpinner?: boolean;
  variant?: 'overlay' | 'placeholder';
  'data-component'?: string;
}

export const ContentLoader = ({ 
  message = 'Loading...', 
  showSpinner = true,
  variant = 'overlay',
  'data-component': dataComponent 
}: ContentLoaderProps) => {
  const isOverlay = variant === 'overlay';
  
  return (
    <motion.div
      className={`content-loader flex flex-col items-center justify-center gap-4 ${
        isOverlay ? 'absolute inset-0 z-20' : 'flex-1'
      }`}
      style={{
        backgroundColor: isOverlay 
          ? 'rgba(var(--color-bg-primary-rgb), 0.9)' 
          : 'var(--color-bg-primary)'
      }}
      data-component={dataComponent}
      data-variant={variant}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Loading content */}
      <div className="loader-content flex flex-col items-center gap-4 text-center">
        {showSpinner && (
          <LoadingSpinner 
            size="lg" 
            color="primary"
            data-component="content-spinner"
          />
        )}
        
        {message && (
          <div className="loader-message flex flex-col gap-2">
            <motion.p
              className="loader-text text-base font-medium"
              style={{ color: 'var(--color-text-primary)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {message}
            </motion.p>
            
            {/* Animated dots */}
            <div className="loader-dots flex items-center justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="dot w-1 h-1"
                  style={{ backgroundColor: 'var(--color-text-secondary)' }}
                  animate={{ 
                    opacity: [0.3, 1, 0.3],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};