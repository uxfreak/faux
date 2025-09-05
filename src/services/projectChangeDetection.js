/**
 * Project Change Detection Service
 * Detects if project files have been modified since last deployment
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Get the most recent modification time of files in a project directory
 * @param {string} projectPath - Path to the project directory
 * @returns {Promise<Date>} - Most recent modification time
 */
export async function getLastModificationTime(projectPath) {
  try {
    let lastModTime = new Date(0); // Start with epoch
    
    // Recursively scan directory for file modifications
    async function scanDirectory(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        // Skip common directories that don't affect deployment
        if (item.isDirectory()) {
          const dirName = item.name;
          if (shouldSkipDirectory(dirName)) {
            continue;
          }
          await scanDirectory(fullPath);
        } else {
          // Skip files that don't affect deployment
          if (shouldSkipFile(item.name)) {
            continue;
          }
          
          const stats = await fs.stat(fullPath);
          if (stats.mtime > lastModTime) {
            lastModTime = stats.mtime;
          }
        }
      }
    }
    
    await scanDirectory(projectPath);
    return lastModTime;
  } catch (error) {
    console.error('Error scanning project for modifications:', error);
    // Return current time as fallback - this will trigger update
    return new Date();
  }
}

/**
 * Check if project has changed since last deployment
 * @param {Object} project - Project object with path and lastDeployedAt
 * @returns {Promise<boolean>} - True if project has changed
 */
export async function hasProjectChanged(project) {
  if (!project.lastDeployedAt) {
    // Never deployed, so it's new
    return false; // For first deployment, we show "Deploy" not "Update"
  }
  
  const lastModTime = await getLastModificationTime(project.path);
  return lastModTime > project.lastDeployedAt;
}

/**
 * Determine deployment state for a project
 * @param {Object} project - Project object
 * @returns {Promise<Object>} - Deployment state information
 */
export async function getProjectDeploymentState(project) {
  if (!project.deploymentUrl) {
    return {
      state: 'never-deployed',
      action: 'Deploy',
      showUrl: false
    };
  }
  
  const hasChanged = await hasProjectChanged(project);
  
  if (hasChanged) {
    return {
      state: 'needs-update',
      action: 'Update',
      showUrl: true,
      url: project.deploymentUrl
    };
  }
  
  return {
    state: 'up-to-date',
    action: null,
    showUrl: true,
    url: project.deploymentUrl
  };
}

/**
 * Directories to skip when scanning for changes
 */
function shouldSkipDirectory(dirName) {
  const skipDirs = [
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    'dist',
    'build',
    '.cache',
    '.temp',
    '.tmp',
    'coverage',
    '.nyc_output',
    'logs',
    '*.log',
    '.DS_Store',
    'Thumbs.db'
  ];
  
  return skipDirs.some(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(pattern.replace('*', '.*')).test(dirName);
    }
    return dirName === pattern || dirName.startsWith(pattern);
  });
}

/**
 * Files to skip when scanning for changes
 */
function shouldSkipFile(fileName) {
  const skipFiles = [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.cache',
    '*.pid',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local'
  ];
  
  return skipFiles.some(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(pattern.replace('*', '.*')).test(fileName);
    }
    return fileName === pattern;
  });
}