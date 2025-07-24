import { motion } from 'framer-motion';
import { ViewMode } from './ProjectViewer';

interface ModeOption {
  mode: ViewMode;
  label: string;
  icon: JSX.Element;
}

interface ModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  'data-control'?: string;
}

const modeOptions: ModeOption[] = [
  {
    mode: 'preview',
    label: 'Preview',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )
  },
  {
    mode: 'components',
    label: 'Components',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
];

export const ModeToggle = ({ 
  currentMode, 
  onModeChange, 
  'data-control': dataControl 
}: ModeToggleProps) => {
  return (
    <>
      {modeOptions.map((option) => (
        <motion.button
          key={option.mode}
          onClick={() => onModeChange(option.mode)}
          className="mode-button p-2 transition-colors"
          style={{
            color: currentMode === option.mode 
              ? 'var(--color-text-primary)' 
              : 'var(--color-text-secondary)',
            backgroundColor: currentMode === option.mode 
              ? 'var(--color-surface-hover)' 
              : 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            if (currentMode !== option.mode) {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentMode !== option.mode) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={option.label}
          data-mode={option.mode}
          data-active={currentMode === option.mode}
          data-control={dataControl}
        >
          {option.icon}
        </motion.button>
      ))}
    </>
  );
};