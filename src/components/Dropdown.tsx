import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  trigger: React.ReactNode;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  align?: 'left' | 'right';
}

export const Dropdown = ({ trigger, options, value, onChange, align = 'right' }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const currentOption = options.find(option => option.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 transition-colors"
        style={{ 
          color: isOpen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }
        }}
        whileTap={{ scale: 0.95 }}
      >
        {trigger}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute top-full mt-2 border shadow-lg whitespace-nowrap z-50 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              boxShadow: 'var(--shadow-lg)'
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {options.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className={`w-full pl-3 pr-8 py-2 text-left text-sm transition-colors flex items-center gap-3 ${
                  option.value === value ? 'font-medium' : ''
                }`}
                style={{
                  color: option.value === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = option.value === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                whileTap={{ scale: 0.98 }}
              >
                {option.icon && (
                  <div className="w-4 h-4 flex-shrink-0">
                    {option.icon}
                  </div>
                )}
                <span>{option.label}</span>
                {option.value === value && (
                  <motion.div
                    className="ml-auto"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};