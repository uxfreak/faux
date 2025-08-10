import { deployToNetlifyAPI } from './netlifyAPIDeployment.js';

/**
 * Netlify deployment service - API only
 * Requires API token for deployment
 */

export const deployToNetlify = async (options) => {
  const { token, onProgress, ...otherOptions } = options;
  
  console.log('[API DEPLOYMENT] Starting API-only deployment process');
  
  // Check if we have an API token
  if (!token || token.trim().length === 0) {
    const error = 'API token is required for deployment. Please configure your Netlify API token in settings.';
    console.error('[API DEPLOYMENT]', error);
    
    onProgress?.({
      error,
      method: 'api-required',
      progress: 0
    });
    
    return {
      success: false,
      error,
      method: 'api-required'
    };
  }
  
  console.log('[API DEPLOYMENT] API token available, starting deployment...');
  
  try {
    const apiOptions = {
      ...otherOptions,
      token: token.trim(),
      onProgress: (progress) => {
        onProgress?.({
          ...progress,
          method: 'api'
        });
      }
    };
    
    const result = await deployToNetlifyAPI(apiOptions);
    
    if (result.success) {
      console.log('[API DEPLOYMENT] Deployment successful');
      return {
        ...result,
        method: 'api'
      };
    } else {
      console.log('[API DEPLOYMENT] Deployment failed:', result.error);
      return {
        ...result,
        method: 'api'
      };
    }
  } catch (error) {
    console.error('[API DEPLOYMENT] Deployment error:', error.message);
    
    return {
      success: false,
      error: error.message,
      method: 'api'
    };
  }
};

// Helper function to check if API deployment is available
export const isAPIDeploymentAvailable = (token) => {
  return token && typeof token === 'string' && token.trim().length > 20;
};

// Get deployment method recommendations - API only
export const getDeploymentRecommendations = async (token) => {
  const hasAPIToken = isAPIDeploymentAvailable(token);
  
  if (hasAPIToken) {
    return {
      preferred: 'api',
      fallback: 'none',
      message: 'API deployment ready'
    };
  } else {
    return {
      preferred: 'none',
      fallback: 'none',
      message: 'API token required. Configure your Netlify API token in settings.'
    };
  }
};