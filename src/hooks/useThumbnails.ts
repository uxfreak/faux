import { useCallback, useEffect, useRef } from 'react';
import { Project } from '../types/Project';
import { ThumbnailOptions } from '../types/electron';

export interface ThumbnailHookOptions {
  autoCapture?: boolean;
  captureOnOpen?: boolean;
  periodicCapture?: boolean;
  periodicInterval?: number; // milliseconds
  debounceMs?: number;
}

export const useThumbnails = (options: ThumbnailHookOptions = {}) => {
  const {
    autoCapture = true,
    captureOnOpen = true,
    periodicCapture = true,
    periodicInterval = 30000, // 30 seconds
    debounceMs = 5000
  } = options;

  const periodicTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const captureInProgress = useRef<Set<string>>(new Set());

  /**
   * Capture thumbnail for a project
   */
  const captureThumbnail = useCallback(async (
    projectId: string,
    serverUrl: string,
    thumbnailOptions?: ThumbnailOptions
  ) => {
    if (!window.electronAPI?.thumbnail) {
      console.warn('Thumbnail API not available');
      return { success: false, error: 'API not available' };
    }

    if (captureInProgress.current.has(projectId)) {
      console.log(`📸 Thumbnail capture already in progress for project ${projectId}`);
      return { success: false, error: 'Capture in progress' };
    }

    try {
      captureInProgress.current.add(projectId);
      console.log(`📸 Capturing thumbnail for project ${projectId} from ${serverUrl}`);

      const result = await window.electronAPI.thumbnail.capture(
        projectId,
        serverUrl,
        thumbnailOptions
      );

      if (result.success) {
        console.log(`✅ Thumbnail captured successfully for project ${projectId}`);
      } else {
        console.warn(`❌ Thumbnail capture failed for project ${projectId}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`❌ Thumbnail capture error for project ${projectId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      captureInProgress.current.delete(projectId);
    }
  }, []);

  /**
   * Capture thumbnail with debouncing
   */
  const debouncedCapture = useCallback(async (
    projectId: string,
    serverUrl: string,
    thumbnailOptions?: ThumbnailOptions
  ) => {
    if (!window.electronAPI?.thumbnail) {
      console.warn('Thumbnail API not available');
      return { success: false, error: 'API not available' };
    }

    try {
      console.log(`📸 Debounced thumbnail capture for project ${projectId}`);
      
      const result = await window.electronAPI.thumbnail.debouncedCapture(
        projectId,
        serverUrl,
        debounceMs,
        thumbnailOptions
      );

      return result;
    } catch (error) {
      console.error(`❌ Debounced thumbnail capture error for project ${projectId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [debounceMs]);

  /**
   * Generate fallback thumbnail for a project
   */
  const generateFallback = useCallback(async (
    projectId: string,
    projectName: string,
    fallbackOptions?: any
  ) => {
    if (!window.electronAPI?.thumbnail) {
      console.warn('Thumbnail API not available');
      return { success: false, error: 'API not available' };
    }

    try {
      console.log(`🎨 Generating fallback thumbnail for project ${projectId}`);
      
      const result = await window.electronAPI.thumbnail.generateFallback(
        projectId,
        projectName,
        fallbackOptions
      );

      return result;
    } catch (error) {
      console.error(`❌ Fallback thumbnail generation error for project ${projectId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  /**
   * Check if a server URL is accessible
   */
  const checkServerAccessibility = useCallback(async (serverUrl: string) => {
    if (!window.electronAPI?.thumbnail) {
      return { accessible: false };
    }

    try {
      const result = await window.electronAPI.thumbnail.checkServer(serverUrl);
      return result;
    } catch (error) {
      console.error('Error checking server accessibility:', error);
      return { accessible: false };
    }
  }, []);

  /**
   * Start periodic thumbnail capture for a project
   */
  const startPeriodicCapture = useCallback((
    projectId: string,
    serverUrl: string,
    thumbnailOptions?: ThumbnailOptions
  ) => {
    if (!periodicCapture) return;

    // Clear existing timer if any
    stopPeriodicCapture(projectId);

    console.log(`⏰ Starting periodic thumbnail capture for project ${projectId} (every ${periodicInterval}ms)`);

    const timerId = setInterval(async () => {
      // Check if server is still accessible before capturing
      const { accessible } = await checkServerAccessibility(serverUrl);
      if (accessible) {
        await debouncedCapture(projectId, serverUrl, thumbnailOptions);
      } else {
        console.log(`🚫 Server not accessible, stopping periodic capture for project ${projectId}`);
        stopPeriodicCapture(projectId);
      }
    }, periodicInterval);

    periodicTimers.current.set(projectId, timerId);
  }, [periodicCapture, periodicInterval, debouncedCapture, checkServerAccessibility]);

  /**
   * Stop periodic thumbnail capture for a project
   */
  const stopPeriodicCapture = useCallback((projectId: string) => {
    const timerId = periodicTimers.current.get(projectId);
    if (timerId) {
      clearInterval(timerId);
      periodicTimers.current.delete(projectId);
      console.log(`⏹️ Stopped periodic thumbnail capture for project ${projectId}`);
    }
  }, []);

  /**
   * Capture thumbnail when project is opened
   */
  const captureOnProjectOpen = useCallback(async (
    project: Project,
    serverUrl: string,
    thumbnailOptions?: ThumbnailOptions
  ) => {
    if (!captureOnOpen) return;

    console.log(`🚀 Project opened, capturing thumbnail for ${project.name}`);

    // First check if server is accessible
    const { accessible } = await checkServerAccessibility(serverUrl);
    
    if (accessible) {
      // Capture immediately
      await captureThumbnail(project.id, serverUrl, thumbnailOptions);
      
      // Start periodic updates if enabled
      if (periodicCapture) {
        startPeriodicCapture(project.id, serverUrl, thumbnailOptions);
      }
    } else {
      console.log(`🚫 Server not accessible, generating fallback thumbnail for ${project.name}`);
      await generateFallback(project.id, project.name);
    }
  }, [
    captureOnOpen,
    periodicCapture,
    checkServerAccessibility,
    captureThumbnail,
    startPeriodicCapture,
    generateFallback
  ]);

  /**
   * Capture thumbnail when project is created
   */
  const captureOnProjectCreate = useCallback(async (
    project: Project,
    serverUrl: string,
    thumbnailOptions?: ThumbnailOptions
  ) => {
    if (!autoCapture) return;

    console.log(`🆕 New project created, will capture thumbnail for ${project.name} when server is ready`);

    // Wait a bit longer for new projects as server needs time to start
    const extendedOptions = {
      waitForLoad: 5000, // Wait 5 seconds for new projects
      timeout: 15000, // Extended timeout
      ...thumbnailOptions
    };

    // Retry logic for new projects
    let retries = 3;
    let delay = 2000; // Start with 2 seconds

    const attemptCapture = async (): Promise<void> => {
      const { accessible } = await checkServerAccessibility(serverUrl);
      
      if (accessible) {
        const result = await captureThumbnail(project.id, serverUrl, extendedOptions);
        
        if (result.success) {
          // Start periodic updates
          if (periodicCapture) {
            startPeriodicCapture(project.id, serverUrl, thumbnailOptions);
          }
        } else if (retries > 0) {
          retries--;
          console.log(`⏳ Thumbnail capture failed, retrying in ${delay}ms (${retries} retries left)`);
          setTimeout(attemptCapture, delay);
          delay *= 1.5; // Exponential backoff
        } else {
          console.log(`🎨 All retries failed, generating fallback thumbnail for ${project.name}`);
          await generateFallback(project.id, project.name);
        }
      } else if (retries > 0) {
        retries--;
        console.log(`⏳ Server not ready, retrying in ${delay}ms (${retries} retries left)`);
        setTimeout(attemptCapture, delay);
        delay *= 1.5; // Exponential backoff
      } else {
        console.log(`🎨 Server never became ready, generating fallback thumbnail for ${project.name}`);
        await generateFallback(project.id, project.name);
      }
    };

    // Start the capture attempt after initial delay
    setTimeout(attemptCapture, delay);
  }, [
    autoCapture,
    periodicCapture,
    checkServerAccessibility,
    captureThumbnail,
    startPeriodicCapture,
    generateFallback
  ]);

  /**
   * Cleanup when component unmounts or project is closed
   */
  const cleanup = useCallback((projectId?: string) => {
    if (projectId) {
      // Clean up specific project
      stopPeriodicCapture(projectId);
      captureInProgress.current.delete(projectId);
    } else {
      // Clean up all
      console.log('🧹 Cleaning up all thumbnail timers');
      periodicTimers.current.forEach((timerId) => clearInterval(timerId));
      periodicTimers.current.clear();
      captureInProgress.current.clear();
    }
  }, [stopPeriodicCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    captureThumbnail,
    debouncedCapture,
    generateFallback,
    checkServerAccessibility,
    startPeriodicCapture,
    stopPeriodicCapture,
    captureOnProjectOpen,
    captureOnProjectCreate,
    cleanup
  };
};