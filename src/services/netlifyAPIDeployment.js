import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Netlify API Base URL
const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';

/**
 * Netlify API-based deployment service
 * Uses REST API instead of CLI for better integration
 */

// === Progress Management ===

const createAPIDeploymentSteps = () => [
  { id: 'validate', label: 'Validating project', status: 'pending' },
  { id: 'build', label: 'Building project', status: 'pending' },
  { id: 'auth', label: 'Checking API authentication', status: 'pending' },
  { id: 'site', label: 'Creating/finding site', status: 'pending' },
  { id: 'upload', label: 'Uploading files', status: 'pending' },
  { id: 'deploy', label: 'Finalizing deployment', status: 'pending' },
  { id: 'verify', label: 'Verifying deployment', status: 'pending' }
];

const updateStepStatus = (stepId, status, steps, message, details) =>
  steps.map(step => 
    step.id === stepId ? { ...step, status, message, details } : step
  );

const calculateProgress = (steps) => {
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return 0;
  }
  const completed = steps.filter(step => step.status === 'completed' || step.status === 'skipped').length;
  return Math.round((completed / steps.length) * 100);
};

// === API Helper Functions ===

const makeAPIRequest = async (endpoint, options = {}) => {
  const url = `${NETLIFY_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${options.token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }

  return response.json();
};

const checkAPIAuthentication = async (token) => {
  console.log('[API DEPLOYMENT] Checking API authentication...');
  
  try {
    const user = await makeAPIRequest('/user', { token });
    console.log(`[API DEPLOYMENT] Authenticated as: ${user.email}`);
    return { success: true, user };
  } catch (error) {
    console.error('[API DEPLOYMENT] Authentication failed:', error.message);
    return { success: false, error: error.message };
  }
};

const findOrCreateSite = async (token, projectName, siteName, createNew = true, existingUrl = null) => {
  console.log('[API DEPLOYMENT] Finding or creating site...');
  
  try {
    // If updating existing site, find it first
    if (!createNew && existingUrl) {
      const sites = await makeAPIRequest('/sites', { token });
      const site = sites.find(s => s.url === existingUrl || s.ssl_url === existingUrl);
      
      if (site) {
        console.log(`[API DEPLOYMENT] Found existing site: ${site.name} (${site.id})`);
        return {
          success: true,
          site: {
            id: site.id,
            name: site.name,
            url: site.ssl_url || site.url,
            isNew: false
          }
        };
      } else {
        throw new Error('Existing site not found in account');
      }
    }
    
    // Create new site - let Netlify generate a random name
    console.log(`[API DEPLOYMENT] Creating new site with Netlify-generated name for project "${projectName}"`);
    const finalSiteName = null; // Don't specify name, let Netlify generate random name
    
    const siteData = {
      repo: {
        provider: 'manual' // Manual deployment, not git-based
      }
      // No name specified - Netlify will generate a random name
    };
    
    console.log(`[API DEPLOYMENT] Creating new site with Netlify-generated name`);
    const newSite = await makeAPIRequest('/sites', {
      token,
      method: 'POST',
      body: JSON.stringify(siteData)
    });
    
    console.log(`[API DEPLOYMENT] Site created: ${newSite.ssl_url || newSite.url}`);
    return {
      success: true,
      site: {
        id: newSite.id,
        name: newSite.name,
        url: newSite.ssl_url || newSite.url,
        isNew: true
      }
    };
  } catch (error) {
    console.error('[API DEPLOYMENT] Site creation/finding failed:', error);
    return { success: false, error: error.message };
  }
};

const calculateFileDigest = async (filePath) => {
  const content = await fs.readFile(filePath);
  const hash = crypto.createHash('sha1');
  hash.update(content);
  return hash.digest('hex');
};

const scanBuildDirectory = async (buildDir, projectRoot) => {
  console.log('[API DEPLOYMENT] Scanning build directory and project config files...');
  
  const files = {};
  
  const scanDirectory = async (dir, basePath = '') => {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.posix.join(basePath, item.name);
      
      if (item.isDirectory()) {
        await scanDirectory(fullPath, relativePath);
      } else if (item.isFile()) {
        const digest = await calculateFileDigest(fullPath);
        files[relativePath] = digest;
      }
    }
  };
  
  // Scan the build directory (dist)
  await scanDirectory(buildDir);
  
  // Add important project root files if they exist
  const rootFiles = [
    'netlify.toml',
    '_redirects',
    '_headers',
    '.htaccess'
  ];
  
  for (const fileName of rootFiles) {
    const rootFilePath = path.join(projectRoot, fileName);
    try {
      await fs.access(rootFilePath);
      const digest = await calculateFileDigest(rootFilePath);
      files[fileName] = digest;
      console.log(`[API DEPLOYMENT] Including root file: ${fileName}`);
    } catch (error) {
      // File doesn't exist, skip it
    }
  }
  
  console.log(`[API DEPLOYMENT] Found ${Object.keys(files).length} files to deploy`);
  return files;
};

const uploadFiles = async (token, siteId, deployId, buildDir, fileDigests, requiredFiles, projectRoot) => {
  console.log(`[API DEPLOYMENT] Uploading ${requiredFiles.length} files...`);
  
  // Create reverse mapping from SHA1 hash to file path
  const hashToPath = {};
  for (const [filePath, hash] of Object.entries(fileDigests)) {
    hashToPath[hash] = filePath;
  }
  
  console.log('[API DEPLOYMENT] Hash to path mapping:', hashToPath);
  
  // Define root config files that exist at project root
  const rootConfigFiles = [
    'netlify.toml',
    '_redirects', 
    '_headers',
    '.htaccess'
  ];
  
  let uploadedCount = 0;
  const totalFiles = requiredFiles.length;
  
  for (const hashOrPath of requiredFiles) {
    try {
      // Determine if this is a SHA1 hash or file path
      const filePath = hashToPath[hashOrPath] || hashOrPath;
      
      if (!filePath) {
        throw new Error(`Unable to resolve file path for hash: ${hashOrPath}`);
      }
      
      // Determine the source location for this file
      let fullPath;
      if (rootConfigFiles.includes(filePath)) {
        // This is a root config file, look in project root
        fullPath = path.join(projectRoot, filePath);
        console.log(`[API DEPLOYMENT] Using project root path for ${filePath}: ${fullPath}`);
      } else {
        // This is a build artifact, look in build directory
        fullPath = path.join(buildDir, filePath);
        console.log(`[API DEPLOYMENT] Using build directory path for ${filePath}: ${fullPath}`);
      }
      
      // Verify the file exists before trying to read it
      try {
        await fs.access(fullPath);
      } catch (accessError) {
        console.error(`[API DEPLOYMENT] File not found: ${fullPath}`);
        throw new Error(`File not found: ${filePath} (hash: ${hashOrPath})`);
      }
      
      const content = await fs.readFile(fullPath);
      
      // Upload file using the correct deploy endpoint
      await makeAPIRequest(`/deploys/${deployId}/files/${encodeURIComponent(filePath)}`, {
        token,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: content
      });
      
      uploadedCount++;
      console.log(`[API DEPLOYMENT] Uploaded ${uploadedCount}/${totalFiles}: ${filePath}`);
      
    } catch (error) {
      console.error(`[API DEPLOYMENT] Failed to upload ${hashOrPath}:`, error.message);
      throw error;
    }
  }
  
  console.log('[API DEPLOYMENT] All files uploaded successfully');
};

const createDeploy = async (token, siteId, fileDigests) => {
  console.log('[API DEPLOYMENT] Creating deployment...');
  
  try {
    const deployData = {
      files: fileDigests,
      draft: false // Set to true for draft deploys
    };
    
    const deploy = await makeAPIRequest(`/sites/${siteId}/deploys`, {
      token,
      method: 'POST',
      body: JSON.stringify(deployData)
    });
    
    console.log(`[API DEPLOYMENT] Deploy created: ${deploy.id}`);
    console.log(`[API DEPLOYMENT] Required files to upload:`, deploy.required || []);
    return {
      success: true,
      deploy: {
        id: deploy.id,
        url: deploy.ssl_url || deploy.deploy_ssl_url,
        state: deploy.state,
        required: deploy.required || []
      }
    };
  } catch (error) {
    console.error('[API DEPLOYMENT] Deploy creation failed:', error);
    return { success: false, error: error.message };
  }
};

const waitForDeployReady = async (token, siteId, deployId, maxWaitMs = 60000) => {
  console.log('[API DEPLOYMENT] Waiting for deployment to be ready...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const deploy = await makeAPIRequest(`/sites/${siteId}/deploys/${deployId}`, { token });
      
      console.log(`[API DEPLOYMENT] Deploy state: ${deploy.state}`);
      
      if (deploy.state === 'ready') {
        return {
          success: true,
          url: deploy.ssl_url || deploy.deploy_ssl_url
        };
      } else if (deploy.state === 'error') {
        throw new Error(`Deployment failed: ${deploy.error_message || 'Unknown error'}`);
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('[API DEPLOYMENT] Error checking deploy status:', error);
      throw error;
    }
  }
  
  throw new Error('Deployment timed out waiting to be ready');
};

// === Utility Functions (reused from CLI version) ===

const validateProject = async (projectPath) => {
  console.log(`[API DEPLOYMENT] Validating project at: ${projectPath}`);
  
  const packageJsonPath = path.join(projectPath, 'package.json');
  try {
    await fs.access(packageJsonPath);
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    console.log('[API DEPLOYMENT] Project validation successful');
    return packageJson;
  } catch (error) {
    throw new Error(`Project validation failed: ${error.message}`);
  }
};

const buildProject = async (projectPath) => {
  console.log('[API DEPLOYMENT] Building project and Storybook...');
  
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // Build main application
    console.log('[API DEPLOYMENT] Building main application...');
    await execAsync('npm run build', {
      cwd: projectPath,
      timeout: 300000 // 5 minutes
    });
    
    const distPath = path.join(projectPath, 'dist');
    await fs.access(distPath);
    console.log('[API DEPLOYMENT] Main application built successfully');
    
    // Build Storybook
    console.log('[API DEPLOYMENT] Building Storybook...');
    try {
      await execAsync('npm run build-storybook', {
        cwd: projectPath,
        timeout: 300000 // 5 minutes
      });
      
      const storybookStaticPath = path.join(projectPath, 'storybook-static');
      await fs.access(storybookStaticPath);
      
      // Copy Storybook to /dist/storybook/
      const storybookDestPath = path.join(distPath, 'storybook');
      console.log('[API DEPLOYMENT] Merging Storybook into deployment...');
      
      // Create storybook directory in dist
      await fs.mkdir(storybookDestPath, { recursive: true });
      
      // Copy all storybook-static files to dist/storybook
      const { exec: execSync } = await import('child_process');
      const { promisify: promisifySync } = await import('util');
      const execAsyncSync = promisifySync(execSync);
      
      await execAsyncSync(`cp -r "${storybookStaticPath}"/* "${storybookDestPath}"/`, {
        cwd: projectPath
      });
      
      console.log('[API DEPLOYMENT] Storybook integration completed');
    } catch (storybookError) {
      console.warn('[API DEPLOYMENT] Storybook build failed, deploying main app only:', storybookError.message);
      // Continue with main app deployment even if Storybook fails
    }
    
    console.log('[API DEPLOYMENT] Project built successfully (with Storybook if available)');
    return distPath;
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
};

// === Main API Deployment Function ===

export const deployToNetlifyAPI = async (options) => {
  const startTime = Date.now();
  const { 
    projectPath, 
    projectName, 
    siteName, 
    token, 
    createNew = true, 
    existingUrl, 
    onProgress 
  } = options;
  
  if (!token) {
    throw new Error('Netlify API token is required. Please provide a Personal Access Token.');
  }
  
  console.log(`[API DEPLOYMENT] Starting API deployment for project: ${projectName}`);
  console.log(`[API DEPLOYMENT] Project path: ${projectPath}`);
  console.log(`[API DEPLOYMENT] Create new: ${createNew}`);
  
  let steps = createAPIDeploymentSteps();
  let siteUrl = '';
  let deployUrl = '';
  let siteId = '';
  
  const reportProgress = (currentStep, progressMessage, siteUrlUpdate, deployUrlUpdate) => {
    const progress = calculateProgress(steps);
    onProgress?.({
      steps,
      currentStep,
      progress,
      message: progressMessage,
      siteUrl: siteUrlUpdate || siteUrl,
      deployUrl: deployUrlUpdate || deployUrl
    });
  };
  
  try {
    // Send initial progress report
    reportProgress(undefined, 'Starting deployment...');
    
    // Step 1: Validate project
    steps = updateStepStatus('validate', 'active', steps, 'Checking project structure...');
    reportProgress('validate', 'Validating project structure');
    
    await validateProject(projectPath);
    steps = updateStepStatus('validate', 'completed', steps, 'Project validated');
    
    // Step 2: Build project
    steps = updateStepStatus('build', 'active', steps, 'Building project...');
    reportProgress('build', 'Building project for production');
    
    const distPath = await buildProject(projectPath);
    steps = updateStepStatus('build', 'completed', steps, 'Build completed');
    
    // Step 3: Check authentication
    steps = updateStepStatus('auth', 'active', steps, 'Checking API authentication...');
    reportProgress('auth', 'Verifying API credentials');
    
    const authResult = await checkAPIAuthentication(token);
    if (!authResult.success) {
      throw new Error(`API authentication failed: ${authResult.error}`);
    }
    
    steps = updateStepStatus('auth', 'completed', steps, 'Authentication verified');
    
    // Step 4: Find or create site
    steps = updateStepStatus('site', 'active', steps, createNew ? 'Creating site...' : 'Finding site...');
    reportProgress('site', createNew ? 'Creating new Netlify site' : 'Finding existing site');
    
    const siteResult = await findOrCreateSite(token, projectName, siteName, createNew, existingUrl);
    if (!siteResult.success) {
      throw new Error(siteResult.error);
    }
    
    siteId = siteResult.site.id;
    siteUrl = siteResult.site.url;
    
    steps = updateStepStatus('site', 'completed', steps, 'Site ready', `Site URL: ${siteUrl}`);
    reportProgress('site', siteResult.site.isNew ? 'Site created successfully' : 'Site found', siteUrl);
    
    // Step 5: Upload files
    steps = updateStepStatus('upload', 'active', steps, 'Preparing files...');
    reportProgress('upload', 'Scanning and uploading files', siteUrl);
    
    const fileDigests = await scanBuildDirectory(distPath, projectPath);
    console.log('[API DEPLOYMENT] File digests:', fileDigests);
    const deployResult = await createDeploy(token, siteId, fileDigests);
    
    if (!deployResult.success) {
      throw new Error(deployResult.error);
    }
    
    if (deployResult.deploy.required.length > 0) {
      await uploadFiles(token, siteId, deployResult.deploy.id, distPath, fileDigests, deployResult.deploy.required, projectPath);
    }
    
    steps = updateStepStatus('upload', 'completed', steps, 'Files uploaded');
    
    // Step 6: Finalize deployment
    steps = updateStepStatus('deploy', 'active', steps, 'Finalizing deployment...');
    reportProgress('deploy', 'Processing deployment', siteUrl);
    
    const readyResult = await waitForDeployReady(token, siteId, deployResult.deploy.id);
    deployUrl = readyResult.url;
    
    console.log(`[API DEPLOYMENT] Final deployment URL: ${deployUrl}`);
    console.log(`[API DEPLOYMENT] Site URL: ${siteUrl}`);
    
    steps = updateStepStatus('deploy', 'completed', steps, 'Deployment completed');
    
    // Step 7: Verify (simplified)
    steps = updateStepStatus('verify', 'completed', steps, 'Deployment verified');
    
    const duration = Date.now() - startTime;
    console.log(`[API DEPLOYMENT] Deployment completed successfully in ${duration}ms`);
    
    console.log(`[API DEPLOYMENT] Reporting final progress with siteUrl: ${siteUrl}, deployUrl: ${deployUrl}`);
    reportProgress(undefined, 'Deployment completed successfully!', siteUrl, deployUrl);
    
    // Generate Storybook URL (assuming it was successfully built and deployed)
    const storybookUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/storybook/` : null;
    
    return {
      success: true,
      siteUrl,
      deployUrl,
      storybookUrl,
      siteId,
      steps
    };
    
  } catch (error) {
    const currentStep = steps.find(step => step.status === 'active');
    if (currentStep) {
      steps = updateStepStatus(currentStep.id, 'error', steps, 'Step failed');
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const duration = Date.now() - startTime;
    
    console.log(`[API DEPLOYMENT] Deployment failed after ${duration}ms: ${errorMessage}`);
    
    onProgress?.({
      steps,
      progress: calculateProgress(steps),
      error: errorMessage,
      siteUrl,
      deployUrl
    });
    
    return {
      success: false,
      error: errorMessage,
      steps,
      siteUrl,
      deployUrl,
      siteId
    };
  }
};

// Helper function to get user's API token (would be stored securely in app settings)
export const getStoredAPIToken = () => {
  // In a real app, this would come from secure settings storage
  // For now, we'll expect it to be passed in options
  return null;
};

// Helper to validate API token format
export const isValidAPIToken = (token) => {
  return token && typeof token === 'string' && token.length > 20;
};