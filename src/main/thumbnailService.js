import { BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export class ThumbnailService {
  constructor() {
    this.captureQueue = new Map(); // Track ongoing captures to prevent duplicates
    this.captureDebounce = new Map(); // Debounce multiple capture requests
  }

  /**
   * Capture a thumbnail from a running server URL
   * @param {string} projectId - Project identifier
   * @param {string} serverUrl - URL of the running Vite server
   * @param {Object} options - Capture options
   * @returns {Promise<string>} Base64 encoded thumbnail
   */
  async captureFromUrl(projectId, serverUrl, options = {}) {
    const {
      width = 2560,
      height = 1440,
      thumbnailWidth = 800,
      thumbnailHeight = 500,
      timeout = 10000,
      waitForLoad = 2000
    } = options;

    // Prevent duplicate captures for the same project
    if (this.captureQueue.has(projectId)) {
      console.log(`📸 Thumbnail capture already in progress for project ${projectId}`);
      return this.captureQueue.get(projectId);
    }

    // Debounce rapid capture requests
    if (this.captureDebounce.has(projectId)) {
      clearTimeout(this.captureDebounce.get(projectId));
    }

    const capturePromise = this._performCapture(projectId, serverUrl, {
      width,
      height,
      thumbnailWidth,
      thumbnailHeight,
      timeout,
      waitForLoad
    });

    this.captureQueue.set(projectId, capturePromise);

    try {
      const result = await capturePromise;
      return result;
    } finally {
      this.captureQueue.delete(projectId);
      this.captureDebounce.delete(projectId);
    }
  }

  /**
   * Perform the actual screenshot capture
   * @private
   */
  async _performCapture(projectId, serverUrl, options) {
    let captureWindow = null;

    try {
      console.log(`📸 Starting thumbnail capture for project ${projectId} at ${serverUrl}`);
      console.log(`📐 Using capture dimensions: ${options.width}x${options.height} → ${options.thumbnailWidth}x${options.thumbnailHeight}`);

      // Create a hidden browser window for capturing
      captureWindow = new BrowserWindow({
        width: options.width,
        height: options.height,
        show: false, // Hidden window
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false // Allow loading local dev servers
        }
      });

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Thumbnail capture timeout')), options.timeout);
      });

      // Load the URL and wait for it to be ready
      const loadPromise = new Promise((resolve, reject) => {
        captureWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
          reject(new Error(`Failed to load ${serverUrl}: ${errorDescription}`));
        });

        captureWindow.webContents.once('did-finish-load', () => {
          // Wait additional time for content to render
          setTimeout(() => {
            resolve();
          }, options.waitForLoad);
        });

        captureWindow.loadURL(serverUrl);
      });

      // Wait for page to load or timeout
      await Promise.race([loadPromise, timeoutPromise]);

      // Capture the page
      const image = await captureWindow.webContents.capturePage({
        x: 0,
        y: 0,
        width: options.width,
        height: options.height
      });

      // Resize to thumbnail dimensions with high quality
      const thumbnail = image.resize({
        width: options.thumbnailWidth,
        height: options.thumbnailHeight,
        quality: 'best'
      });

      // Convert to base64
      const base64 = thumbnail.toPNG().toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      console.log(`✅ Thumbnail captured successfully for project ${projectId}`);
      return dataUrl;

    } catch (error) {
      console.error(`❌ Failed to capture thumbnail for project ${projectId}:`, error.message);
      throw error;
    } finally {
      // Clean up the capture window
      if (captureWindow && !captureWindow.isDestroyed()) {
        captureWindow.close();
      }
    }
  }

  /**
   * Capture thumbnail with debouncing to prevent excessive captures
   * @param {string} projectId - Project identifier  
   * @param {string} serverUrl - URL of the running server
   * @param {number} debounceMs - Debounce delay in milliseconds
   * @param {Object} options - Capture options
   * @returns {Promise<string>} Base64 encoded thumbnail
   */
  async debouncedCapture(projectId, serverUrl, debounceMs = 5000, options = {}) {
    return new Promise((resolve, reject) => {
      // Clear existing debounce timer
      if (this.captureDebounce.has(projectId)) {
        clearTimeout(this.captureDebounce.get(projectId));
      }

      // Set new debounce timer
      const timeoutId = setTimeout(async () => {
        try {
          const thumbnail = await this.captureFromUrl(projectId, serverUrl, options);
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      }, debounceMs);

      this.captureDebounce.set(projectId, timeoutId);
    });
  }

  /**
   * Check if a server URL is accessible for screenshot capture
   * @param {string} serverUrl - URL to check
   * @returns {Promise<boolean>} True if accessible
   */
  async isServerAccessible(serverUrl) {
    try {
      const testWindow = new BrowserWindow({
        width: 100,
        height: 100,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false
        }
      });

      const accessible = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);

        testWindow.webContents.once('did-finish-load', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        testWindow.webContents.once('did-fail-load', () => {
          clearTimeout(timeout);
          resolve(false);
        });

        testWindow.loadURL(serverUrl);
      });

      testWindow.close();
      return accessible;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a fallback thumbnail with project name
   * @param {string} projectName - Name of the project
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Base64 encoded fallback thumbnail
   */
  async generateFallbackThumbnail(projectName, options = {}) {
    const {
      width = 800,
      height = 500,
      backgroundColor = '#6B7280',
      textColor = '#FFFFFF',
      fontSize = 96
    } = options;

    // This creates a simple colored rectangle with the first letter
    // In a real implementation, you might use a canvas library or generate SVG
    const initial = projectName.charAt(0).toUpperCase();
    
    // For now, return a simple data URL - you could enhance this with canvas generation
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <text x="50%" y="50%" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="${fontSize}" 
              font-weight="bold" 
              fill="${textColor}" 
              text-anchor="middle" 
              dominant-baseline="middle">
          ${initial}
        </text>
      </svg>
    `;

    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Cleanup any pending captures and timers
   */
  cleanup() {
    // Clear all debounce timers
    for (const timeoutId of this.captureDebounce.values()) {
      clearTimeout(timeoutId);
    }
    this.captureDebounce.clear();

    // Note: captureQueue promises will resolve/reject naturally
    console.log('🧹 ThumbnailService cleanup completed');
  }
}

// Export singleton instance
let thumbnailServiceInstance = null;

export const getThumbnailService = () => {
  if (!thumbnailServiceInstance) {
    thumbnailServiceInstance = new ThumbnailService();
  }
  return thumbnailServiceInstance;
};