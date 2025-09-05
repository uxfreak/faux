import { motion } from 'framer-motion';

interface ProjectCardSkeletonProps {
  'data-component'?: string;
}

export const ProjectCardSkeleton = ({ 
  'data-component': dataComponent 
}: ProjectCardSkeletonProps) => {
  return (
    <motion.div
      className="project-card-skeleton w-full bg-transparent border transition-all"
      style={{
        aspectRatio: '16/9',
        borderColor: 'var(--color-border-secondary)',
        backgroundColor: 'var(--color-bg-primary)'
      }}
      data-component={dataComponent}
      data-state="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Thumbnail skeleton */}
      <div 
        className="skeleton-thumbnail w-full flex-1 relative overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface-hover)' }}
        data-section="thumbnail"
      >
        {/* Animated shimmer effect */}
        <motion.div
          className="skeleton-shimmer absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            backgroundSize: '200% 100%'
          }}
          animate={{ 
            backgroundPosition: ['200% 0', '-200% 0'] 
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        
        {/* Placeholder icon */}
        <div className="skeleton-icon absolute inset-0 flex items-center justify-center">
          <div 
            className="w-8 h-8"
            style={{ 
              backgroundColor: 'var(--color-border-secondary)',
              opacity: 0.5
            }}
          >
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info section skeleton */}
      <div 
        className="skeleton-info p-4 flex flex-col gap-2"
        data-section="info"
      >
        {/* Project name skeleton */}
        <div 
          className="skeleton-title h-4 w-3/4"
          style={{ backgroundColor: 'var(--color-surface-hover)' }}
        >
          <motion.div
            className="skeleton-shimmer h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              backgroundSize: '200% 100%'
            }}
            animate={{ 
              backgroundPosition: ['200% 0', '-200% 0'] 
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
              delay: 0.2
            }}
          />
        </div>
        
        {/* Description skeleton */}
        <div 
          className="skeleton-description h-3 w-1/2"
          style={{ backgroundColor: 'var(--color-surface-hover)', opacity: 0.7 }}
        >
          <motion.div
            className="skeleton-shimmer h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              backgroundSize: '200% 100%'
            }}
            animate={{ 
              backgroundPosition: ['200% 0', '-200% 0'] 
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
              delay: 0.4
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};