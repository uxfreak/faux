import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  'data-component'?: string;
}

export const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary',
  'data-component': dataComponent 
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  const colorStyles = {
    primary: 'var(--color-action-primary)',
    secondary: 'var(--color-text-secondary)',
    white: '#ffffff'
  };

  return (
    <motion.div
      className={`loading-spinner ${sizeClasses[size]} inline-block`}
      data-component={dataComponent}
      data-size={size}
      data-color={color}
      animate={{ rotate: 360 }}
      transition={{ 
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    >
      <svg 
        className="w-full h-full" 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="60"
          strokeDashoffset="20"
          style={{ color: colorStyles[color], opacity: 0.3 }}
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="15"
          style={{ color: colorStyles[color] }}
        />
      </svg>
    </motion.div>
  );
};