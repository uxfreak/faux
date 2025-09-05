import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

interface TerminalCommandIndicatorProps {
  command: string;
  status: 'running' | 'completed' | 'error';
  output?: string[];
  duration?: number;
  'data-component'?: string;
}

export const TerminalCommandIndicator = ({
  command,
  status,
  output = [],
  duration,
  'data-component': dataComponent
}: TerminalCommandIndicatorProps) => {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <motion.div
      className="terminal-command-indicator font-mono text-sm"
      data-component={dataComponent}
      data-status={status}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Command Line */}
      <div className="command-line flex items-center gap-2 mb-1">
        {/* Prompt */}
        <span className="command-prompt text-green-400">➜</span>
        
        {/* Command */}
        <span className="command-text text-white">{command}</span>
        
        {/* Status Indicator */}
        <div className="command-status flex items-center gap-2">
          {status === 'running' && (
            <>
              <LoadingSpinner size="sm" color="white" />
              <motion.span
                className="status-text text-yellow-400 text-xs"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                running
              </motion.span>
            </>
          )}
          
          {status === 'completed' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              
              {duration && (
                <span className="status-text text-green-400 text-xs">
                  completed in {formatDuration(duration)}
                </span>
              )}
            </>
          )}
          
          {status === 'error' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>
              
              <span className="status-text text-red-400 text-xs">failed</span>
            </>
          )}
        </div>
      </div>

      {/* Output Lines */}
      {output.length > 0 && (
        <motion.div
          className="command-output ml-4 space-y-0.5"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {output.map((line, index) => (
            <motion.div
              key={index}
              className="output-line text-gray-300 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {line}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Streaming Indicator for Running Commands */}
      {status === 'running' && (
        <motion.div
          className="streaming-indicator ml-4 flex items-center gap-2 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="streaming-dots flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="dot w-1 h-1 bg-gray-400"
                animate={{ 
                  opacity: [0.3, 1, 0.3],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15
                }}
              />
            ))}
          </div>
          <span className="streaming-text text-gray-500 text-xs">
            streaming output
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};