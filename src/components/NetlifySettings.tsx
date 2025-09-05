import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface NetlifySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (token: string) => void;
  currentToken?: string;
}

export const NetlifySettings = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentToken 
}: NetlifySettingsProps) => {
  const [token, setToken] = useState(currentToken || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    user?: { email: string; name: string };
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setToken(currentToken || '');
      setValidationResult(null);
    }
  }, [isOpen, currentToken]);

  const validateToken = async () => {
    if (!token.trim()) return;
    
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        setValidationResult({
          isValid: true,
          user: { email: user.email, name: user.full_name || user.email }
        });
      } else {
        const errorText = await response.text();
        setValidationResult({
          isValid: false,
          error: `Invalid token (${response.status}): ${errorText}`
        });
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    if (validationResult?.isValid) {
      onSave(token.trim());
      onClose();
    }
  };

  const handleGetToken = () => {
    // Open Netlify personal access token page
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal('https://app.netlify.com/user/applications#personal-access-tokens');
    } else {
      // Fallback for development
      window.open('https://app.netlify.com/user/applications#personal-access-tokens', '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-component="netlify-settings-modal"
    >
      <motion.div
        className="relative p-6 max-w-md w-full mx-4"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)'
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        data-section="modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6" data-section="header">
          <h2 
            className="text-lg font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Netlify API Settings
          </h2>
          <button
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
            data-control="close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="mb-4" data-section="description">
          <p 
            className="text-sm mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Enter your Netlify Personal Access Token to enable deployment to your Netlify account.
          </p>
          <button
            onClick={handleGetToken}
            className="text-sm underline transition-colors"
            style={{ color: 'var(--color-action-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-action-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-action-primary)';
            }}
            data-control="get-token-link"
          >
            Get your Personal Access Token →
          </button>
        </div>

        {/* Token Input */}
        <div className="mb-4" data-section="token-input">
          <label 
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Personal Access Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setValidationResult(null);
              }}
              placeholder="Enter your Netlify API token..."
              className="flex-1 px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '0'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-focus)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
              data-control="token-input"
            />
            <button
              onClick={validateToken}
              disabled={!token.trim() || isValidating}
              className="px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-action-primary)',
                color: 'white',
                borderRadius: '0'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = 'var(--color-action-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
              }}
              data-control="validate-token"
            >
              {isValidating ? '...' : 'Test'}
            </button>
          </div>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div 
            className="mb-4 p-3 text-sm"
            style={{
              backgroundColor: validationResult.isValid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderColor: validationResult.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              color: validationResult.isValid ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            data-section="validation-result"
            data-valid={validationResult.isValid}
          >
            {validationResult.isValid ? (
              <div>
                <div className="font-medium">✓ Token is valid</div>
                <div className="mt-1 opacity-90">
                  Authenticated as: {validationResult.user?.name || validationResult.user?.email}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-medium">✗ Token is invalid</div>
                <div className="mt-1 opacity-90">{validationResult.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end" data-section="actions">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border-primary)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '0'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            data-control="cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!validationResult?.isValid}
            className="px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-action-primary)',
              color: 'white',
              borderRadius: '0'
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-action-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-action-primary)';
            }}
            data-control="save"
          >
            Save Token
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};