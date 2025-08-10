import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NetlifySettings } from './NetlifySettings';

interface DeploymentState {
  isDeploying: boolean;
  progress: any;
  sessionId: string | null;
}

interface ShareDialogProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  existingSiteUrl?: string;
  deploymentState: DeploymentState;
  onClose: () => void;
  onDeploy: (createNew: boolean) => void;
  onClearDeployment: () => void;
}

export const ShareDialog = ({ 
  isOpen,
  projectId,
  projectName, 
  existingSiteUrl,
  deploymentState,
  onClose, 
  onDeploy,
  onClearDeployment
}: ShareDialogProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [netlifyToken, setNetlifyToken] = useState<string>('');
  const [projectDeploymentState, setProjectDeploymentState] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Use deployment state from parent
  const { isDeploying, progress: deployProgress } = deploymentState;

  // Load settings and deployment state when dialog opens
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      // Load current token
      if (window.electronAPI.settings) {
        window.electronAPI.settings.getNetlifyToken().then(token => {
          setNetlifyToken(token || '');
        });
      }
      
      // Get project deployment state
      if (window.electronAPI.getProjectDeploymentState) {
        window.electronAPI.getProjectDeploymentState(projectId).then(state => {
          setProjectDeploymentState(state);
        });
      }
    }
  }, [isOpen, projectId]);

  // Note: Deployment events are now handled by the parent ProjectViewer component

  const handleDeploy = async () => {
    onDeploy(existingSiteUrl ? false : true); // Update existing if URL exists, create new otherwise
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleSaveToken = async (token: string) => {
    if (window.electronAPI?.settings) {
      await window.electronAPI.settings.setNetlifyToken(token);
      setNetlifyToken(token);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
        key="deployment-overlay"
        className="fixed inset-0 z-50 flex items-start justify-end p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="deployment-overlay w-80 border shadow-lg"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-secondary)',
            boxShadow: 'var(--shadow-lg)'
          }}
          initial={{ opacity: 0, x: 20, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 20, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          data-component="deployment-overlay"
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border-secondary)' }}
          >
            <span 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Share
            </span>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1 transition-colors"
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
                title="Netlify Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </motion.button>
              <motion.button
                onClick={onClose}
                className="p-1 transition-colors"
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {!isDeploying && !deployProgress ? (
              <>

                {/* Context-Aware Content */}
                {projectDeploymentState ? (
                  <>
                    {projectDeploymentState.state === 'never-deployed' && (
                      // First time - Show Deploy button
                      <motion.button
                        onClick={handleDeploy}
                        className="w-full p-3 text-center border transition-colors"
                        style={{
                          backgroundColor: 'var(--color-action-primary)',
                          borderColor: 'var(--color-action-primary)',
                          color: 'var(--color-bg-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
                          e.currentTarget.style.borderColor = 'var(--color-action-primary-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
                          e.currentTarget.style.borderColor = 'var(--color-action-primary)';
                        }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="text-sm font-medium">Deploy</div>
                      </motion.button>
                    )}

                    {projectDeploymentState.state === 'up-to-date' && projectDeploymentState.showUrl && (
                      // Has deployment, no changes - Show URL with copy icon
                      <div 
                        className="p-3 border"
                        style={{ 
                          borderColor: 'var(--color-border-primary)',
                          backgroundColor: 'var(--color-surface-hover)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                              Live Site
                            </div>
                            <div className="text-sm font-mono break-all" style={{ color: 'var(--color-text-primary)' }}>
                              {projectDeploymentState.url}
                            </div>
                          </div>
                          <motion.button
                            onClick={() => handleCopyUrl(projectDeploymentState.url)}
                            className="ml-3 p-2 transition-colors"
                            style={{
                              color: copySuccess ? 'var(--color-success, #10b981)' : 'var(--color-text-secondary)',
                              backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              if (!copySuccess) {
                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!copySuccess) {
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title={copySuccess ? 'Copied!' : 'Copy link'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {copySuccess ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              )}
                            </svg>
                          </motion.button>
                        </div>
                      </div>
                    )}

                    {projectDeploymentState.state === 'needs-update' && projectDeploymentState.showUrl && (
                      // Has deployment but needs update - Show URL with copy icon + Update button
                      <div className="space-y-3">
                        <div 
                          className="p-3 border"
                          style={{ 
                            borderColor: 'var(--color-border-primary)',
                            backgroundColor: 'var(--color-surface-hover)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                Current Site
                              </div>
                              <div className="text-sm font-mono break-all" style={{ color: 'var(--color-text-primary)' }}>
                                {projectDeploymentState.url}
                              </div>
                            </div>
                            <motion.button
                              onClick={() => handleCopyUrl(projectDeploymentState.url)}
                              className="ml-3 p-2 transition-colors"
                              style={{
                                color: copySuccess ? 'var(--color-success, #10b981)' : 'var(--color-text-secondary)',
                                backgroundColor: 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (!copySuccess) {
                                  e.currentTarget.style.color = 'var(--color-text-primary)';
                                  e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!copySuccess) {
                                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title={copySuccess ? 'Copied!' : 'Copy link'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {copySuccess ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                )}
                              </svg>
                            </motion.button>
                          </div>
                        </div>
                        
                        <motion.button
                          onClick={handleDeploy}
                          className="w-full p-3 text-center border transition-colors"
                          style={{
                            backgroundColor: 'var(--color-action-primary)',
                            borderColor: 'var(--color-action-primary)',
                            color: 'var(--color-bg-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-action-primary-hover)';
                            e.currentTarget.style.borderColor = 'var(--color-action-primary-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
                            e.currentTarget.style.borderColor = 'var(--color-action-primary)';
                          }}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-sm font-medium">Update</span>
                          </div>
                        </motion.button>
                      </div>
                    )}
                  </>
                ) : (
                  // Loading state
                  <div className="text-center py-4">
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Loading...
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Deployment Progress */}
                {deployProgress ? (
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {deployProgress.message || 'Deploying...'}
                        </span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {Math.round(deployProgress.progress || 0)}%
                        </span>
                      </div>
                      <div 
                        className="h-2 w-full overflow-hidden"
                        style={{ backgroundColor: 'var(--color-surface-hover)' }}
                      >
                        <motion.div
                          className="h-full"
                          style={{ backgroundColor: 'var(--color-action-primary)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${deployProgress.progress || 0}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>

                    {/* Success */}
                    {deployProgress.progress === 100 && (deployProgress.siteUrl || deployProgress.deployUrl) && (
                      <div className="space-y-3">
                        <div 
                          className="p-3 border"
                          style={{ 
                            borderColor: 'var(--color-success, #10b981)',
                            backgroundColor: 'var(--color-surface-hover)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs mb-1" style={{ color: 'var(--color-success, #10b981)' }}>
                                ✅ Deployed Successfully
                              </div>
                              <div className="text-sm font-mono break-all" style={{ color: 'var(--color-text-primary)' }}>
                                {deployProgress.siteUrl || deployProgress.deployUrl}
                              </div>
                            </div>
                            <motion.button
                              onClick={() => handleCopyUrl(deployProgress.siteUrl || deployProgress.deployUrl)}
                              className="ml-3 p-2 transition-colors"
                              style={{
                                color: copySuccess ? 'var(--color-success, #10b981)' : 'var(--color-text-secondary)',
                                backgroundColor: 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (!copySuccess) {
                                  e.currentTarget.style.color = 'var(--color-text-primary)';
                                  e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!copySuccess) {
                                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title={copySuccess ? 'Copied!' : 'Copy link'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {copySuccess ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                )}
                              </svg>
                            </motion.button>
                          </div>
                        </div>
                        
                        <motion.button
                          onClick={onClearDeployment}
                          className="w-full px-3 py-1 text-xs border transition-colors"
                          style={{
                            backgroundColor: 'transparent',
                            borderColor: 'var(--color-border-primary)',
                            color: 'var(--color-text-secondary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Done
                        </motion.button>
                      </div>
                    )}

                    {/* Error */}
                    {deployProgress.error && (
                      <div className="text-xs text-center" style={{ color: 'var(--color-error, #ef4444)' }}>
                        {deployProgress.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                    Preparing deployment...
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
        </motion.div>
      )}
      
      {/* Settings Modal */}
      <NetlifySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveToken}
        currentToken={netlifyToken}
      />
    </AnimatePresence>
  );
};