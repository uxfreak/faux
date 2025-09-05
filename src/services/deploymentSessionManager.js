/**
 * Deployment Session Management System
 * Handles multiple deployments, prevents conflicts, manages UI state
 */

import { EventEmitter } from 'events';

// Session Status Types
export const SessionStatus = {
  PENDING: 'pending',
  ACTIVE: 'active', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Deployment Session Class
export class DeploymentSession extends EventEmitter {
  constructor(projectId, options = {}) {
    super();
    this.id = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    this.projectId = projectId;
    this.status = SessionStatus.PENDING;
    this.method = null; // 'api' | 'cli' | 'hybrid'
    this.progress = null;
    this.result = null;
    this.options = options;
    this.createdAt = new Date();
    this.completedAt = null;
    this.error = null;
    
    console.log(`[DeploymentSession] Created session ${this.id} for project ${projectId}`);
  }
  
  start(deploymentFunction) {
    if (this.status !== SessionStatus.PENDING) {
      throw new Error(`Cannot start session in ${this.status} state`);
    }
    
    this.status = SessionStatus.ACTIVE;
    this.emit('started', this);
    
    console.log(`[DeploymentSession] Starting deployment ${this.id}`);
    
    // Execute deployment with progress tracking
    return deploymentFunction({
      ...this.options,
      onProgress: (progress) => {
        this.progress = { ...progress, sessionId: this.id };
        this.method = progress.method || this.method;
        this.emit('progress', this.progress);
      }
    }).then(result => {
      this.complete(result);
      return result;
    }).catch(error => {
      this.fail(error);
      throw error;
    });
  }
  
  complete(result) {
    if (this.status !== SessionStatus.ACTIVE) return;
    
    this.status = SessionStatus.COMPLETED;
    this.result = result;
    this.completedAt = new Date();
    
    console.log(`[DeploymentSession] Completed session ${this.id}:`, result.success);
    this.emit('completed', this);
  }
  
  fail(error) {
    if (this.status !== SessionStatus.ACTIVE) return;
    
    this.status = SessionStatus.FAILED;
    this.error = error;
    this.completedAt = new Date();
    
    console.log(`[DeploymentSession] Failed session ${this.id}:`, error.message);
    this.emit('failed', this);
  }
  
  cancel() {
    if (this.status !== SessionStatus.ACTIVE) return false;
    
    this.status = SessionStatus.CANCELLED;
    this.completedAt = new Date();
    
    console.log(`[DeploymentSession] Cancelled session ${this.id}`);
    this.emit('cancelled', this);
    return true;
  }
  
  isActive() {
    return this.status === SessionStatus.ACTIVE;
  }
  
  isFinished() {
    return [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CANCELLED].includes(this.status);
  }
  
  getDuration() {
    if (!this.completedAt) return Date.now() - this.createdAt.getTime();
    return this.completedAt.getTime() - this.createdAt.getTime();
  }
  
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      status: this.status,
      method: this.method,
      progress: this.progress,
      result: this.result,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      duration: this.getDuration(),
      error: this.error?.message
    };
  }
}

// Project Deployment State
export class ProjectDeploymentState {
  constructor(projectId) {
    this.projectId = projectId;
    this.currentSession = null;
    this.lastSuccessfulDeployment = null;
    this.deploymentUrl = null;
    this.lastDeployedAt = null;
    this.sessionHistory = [];
  }
  
  setActiveSession(session) {
    // Clean up previous session
    if (this.currentSession && this.currentSession.isActive()) {
      console.log(`[ProjectState] Replacing active session for project ${this.projectId}`);
    }
    
    this.currentSession = session;
    this.sessionHistory.push(session);
    
    // Keep only last 10 sessions for history
    if (this.sessionHistory.length > 10) {
      this.sessionHistory = this.sessionHistory.slice(-10);
    }
  }
  
  updateFromSession(session) {
    if (session.status === SessionStatus.COMPLETED && session.result?.success) {
      this.lastSuccessfulDeployment = session.result;
      this.deploymentUrl = session.result.siteUrl || session.result.deployUrl;
      this.lastDeployedAt = session.completedAt;
    }
  }
  
  hasActiveSession() {
    return this.currentSession && this.currentSession.isActive();
  }
  
  getLastDeploymentMethod() {
    return this.lastSuccessfulDeployment?.method;
  }
}

// Main Deployment Manager
export class DeploymentManager extends EventEmitter {
  constructor() {
    super();
    this.projectStates = new Map(); // ProjectId -> ProjectDeploymentState
    this.activeSessions = new Map(); // ProjectId -> DeploymentSession
    this.allSessions = new Map(); // SessionId -> DeploymentSession
    
    // Cleanup finished sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupFinishedSessions(), 5 * 60 * 1000);
    
    console.log('[DeploymentManager] Initialized');
  }
  
  getProjectState(projectId) {
    if (!this.projectStates.has(projectId)) {
      this.projectStates.set(projectId, new ProjectDeploymentState(projectId));
    }
    return this.projectStates.get(projectId);
  }
  
  canStartDeployment(projectId) {
    const projectState = this.getProjectState(projectId);
    return !projectState.hasActiveSession();
  }
  
  startDeployment(projectId, deploymentFunction, options = {}) {
    console.log(`[DeploymentManager] Request to start deployment for project ${projectId}`);
    
    // Check if deployment is already in progress
    if (!this.canStartDeployment(projectId)) {
      const activeSession = this.activeSessions.get(projectId);
      console.log(`[DeploymentManager] Deployment already in progress for project ${projectId} (session: ${activeSession.id})`);
      
      this.emit('deploymentBlocked', {
        projectId,
        reason: 'deployment_in_progress',
        activeSession: activeSession.toJSON()
      });
      
      return { 
        success: false, 
        error: 'Deployment already in progress',
        activeSession: activeSession.toJSON()
      };
    }
    
    // Create new session
    const session = new DeploymentSession(projectId, options);
    const projectState = this.getProjectState(projectId);
    
    // Set up session event handlers
    this.setupSessionHandlers(session);
    
    // Register session
    this.activeSessions.set(projectId, session);
    this.allSessions.set(session.id, session);
    projectState.setActiveSession(session);
    
    // Start deployment
    session.start(deploymentFunction).catch(error => {
      console.error(`[DeploymentManager] Deployment failed for session ${session.id}:`, error);
    });
    
    this.emit('deploymentStarted', { projectId, session: session.toJSON() });
    
    return { 
      success: true, 
      session: session.toJSON()
    };
  }
  
  setupSessionHandlers(session) {
    session.on('progress', (progress) => {
      this.emit('deploymentProgress', {
        projectId: session.projectId,
        sessionId: session.id,
        progress
      });
    });
    
    session.on('completed', (session) => {
      this.handleSessionComplete(session);
    });
    
    session.on('failed', (session) => {
      this.handleSessionComplete(session);
    });
    
    session.on('cancelled', (session) => {
      this.handleSessionComplete(session);
    });
  }
  
  handleSessionComplete(session) {
    const projectState = this.getProjectState(session.projectId);
    
    // Update project state with results
    projectState.updateFromSession(session);
    
    // Remove from active sessions
    this.activeSessions.delete(session.projectId);
    
    // Emit completion event
    this.emit('deploymentComplete', {
      projectId: session.projectId,
      sessionId: session.id,
      session: session.toJSON()
    });
    
    console.log(`[DeploymentManager] Session ${session.id} completed with status: ${session.status}`);
  }
  
  cancelDeployment(projectId) {
    const session = this.activeSessions.get(projectId);
    if (!session) {
      return { success: false, error: 'No active deployment found' };
    }
    
    const cancelled = session.cancel();
    if (cancelled) {
      this.emit('deploymentCancelled', { 
        projectId, 
        sessionId: session.id 
      });
    }
    
    return { success: cancelled };
  }
  
  getActiveSession(projectId) {
    return this.activeSessions.get(projectId);
  }
  
  getProjectSessions(projectId) {
    const projectState = this.getProjectState(projectId);
    return projectState.sessionHistory.map(session => session.toJSON());
  }
  
  getAllActiveSessions() {
    const activeSessions = {};
    for (const [projectId, session] of this.activeSessions) {
      activeSessions[projectId] = session.toJSON();
    }
    return activeSessions;
  }
  
  cleanupFinishedSessions() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [sessionId, session] of this.allSessions) {
      if (session.isFinished() && session.createdAt.getTime() < cutoffTime) {
        this.allSessions.delete(sessionId);
        console.log(`[DeploymentManager] Cleaned up old session ${sessionId}`);
      }
    }
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Cancel all active sessions
    for (const session of this.activeSessions.values()) {
      session.cancel();
    }
    
    this.removeAllListeners();
    console.log('[DeploymentManager] Destroyed');
  }
}

// Singleton instance
let deploymentManager = null;

export const getDeploymentManager = () => {
  if (!deploymentManager) {
    deploymentManager = new DeploymentManager();
  }
  return deploymentManager;
};

export const createDeploymentSession = (projectId, options) => {
  return new DeploymentSession(projectId, options);
};