import os from 'os';
import fs from 'fs';
import * as pty from 'node-pty';
import { EventEmitter } from 'events';

/**
 * Terminal Manager for Electron main process
 * Manages multiple terminal sessions using node-pty
 */
class TerminalManager extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map(); // Map<sessionId, terminalInstance>
    this.nextSessionId = 1;
  }

  /**
   * Create a new terminal session
   * @param {Object} options - Terminal creation options
   * @param {string} options.projectPath - Working directory for the terminal
   * @param {string} options.projectId - Project ID for context
   * @param {number} options.cols - Terminal columns
   * @param {number} options.rows - Terminal rows
   * @returns {Object} Terminal session info
   */
  createTerminal({ projectPath, projectId, cols = 80, rows = 24 }) {
    try {
      const sessionId = `terminal-${this.nextSessionId++}`;
      
      // Platform-specific shell detection
      const shell = this.getDefaultShell();
      
      // Expand tilde in project path
      const expandedPath = this.expandPath(projectPath || process.env.HOME || process.env.USERPROFILE);
      
      // Check if directory exists, fallback to home if not
      let workingDir = expandedPath;
      try {
        if (!fs.existsSync(expandedPath)) {
          console.warn(`[TerminalManager] Directory ${expandedPath} does not exist, using home directory`);
          workingDir = process.env.HOME || process.env.USERPROFILE;
        }
      } catch (error) {
        console.warn(`[TerminalManager] Error checking directory ${expandedPath}:`, error.message);
        workingDir = process.env.HOME || process.env.USERPROFILE;
      }
      
      console.log(`[TerminalManager] Creating terminal with shell: ${shell}, cwd: ${workingDir}`);
      
      // Spawn terminal process
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: cols,
        rows: rows,
        cwd: workingDir,
        env: { ...process.env, TERM_SESSION_ID: sessionId }
      });

      // Store terminal instance
      const terminalInstance = {
        sessionId,
        projectId,
        projectPath,
        ptyProcess,
        cols,
        rows,
        createdAt: new Date().toISOString()
      };

      this.terminals.set(sessionId, terminalInstance);

      // Set up event handlers
      this.setupTerminalEventHandlers(terminalInstance);

      console.log(`[TerminalManager] Created terminal ${sessionId} for project ${projectId} in ${projectPath}`);

      return {
        sessionId,
        projectId,
        projectPath,
        cols,
        rows,
        shell
      };
    } catch (error) {
      console.error('[TerminalManager] Error creating terminal:', error);
      throw new Error(`Failed to create terminal: ${error.message}`);
    }
  }

  /**
   * Set up event handlers for a terminal instance
   * @param {Object} terminalInstance - Terminal instance object
   */
  setupTerminalEventHandlers(terminalInstance) {
    const { sessionId, ptyProcess } = terminalInstance;

    // Handle terminal output
    ptyProcess.on('data', (data) => {
      this.emit('terminal:data', { sessionId, data });
    });

    // Handle terminal exit
    ptyProcess.on('exit', (exitCode, signal) => {
      console.log(`[TerminalManager] Terminal ${sessionId} exited with code ${exitCode}, signal ${signal}`);
      this.emit('terminal:exit', { sessionId, exitCode, signal });
      this.terminals.delete(sessionId);
    });

    // Handle errors
    ptyProcess.on('error', (error) => {
      console.error(`[TerminalManager] Terminal ${sessionId} error:`, error);
      this.emit('terminal:error', { sessionId, error: error.message });
    });
  }

  /**
   * Write data to a terminal session
   * @param {string} sessionId - Terminal session ID
   * @param {string} data - Data to write
   */
  writeToTerminal(sessionId, data) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    try {
      terminal.ptyProcess.write(data);
    } catch (error) {
      console.error(`[TerminalManager] Error writing to terminal ${sessionId}:`, error);
      throw new Error(`Failed to write to terminal: ${error.message}`);
    }
  }

  /**
   * Resize a terminal session
   * @param {string} sessionId - Terminal session ID
   * @param {number} cols - New column count
   * @param {number} rows - New row count
   */
  resizeTerminal(sessionId, cols, rows) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    try {
      terminal.ptyProcess.resize(cols, rows);
      terminal.cols = cols;
      terminal.rows = rows;
      
      console.log(`[TerminalManager] Resized terminal ${sessionId} to ${cols}x${rows}`);
    } catch (error) {
      console.error(`[TerminalManager] Error resizing terminal ${sessionId}:`, error);
      throw new Error(`Failed to resize terminal: ${error.message}`);
    }
  }

  /**
   * Destroy a terminal session
   * @param {string} sessionId - Terminal session ID
   */
  destroyTerminal(sessionId) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal) {
      console.warn(`[TerminalManager] Terminal session ${sessionId} not found for destruction`);
      return;
    }

    try {
      terminal.ptyProcess.kill();
      this.terminals.delete(sessionId);
      
      console.log(`[TerminalManager] Destroyed terminal ${sessionId}`);
      this.emit('terminal:destroyed', { sessionId });
    } catch (error) {
      console.error(`[TerminalManager] Error destroying terminal ${sessionId}:`, error);
    }
  }

  /**
   * Destroy all terminals for a specific project
   * @param {string} projectId - Project ID
   */
  destroyProjectTerminals(projectId) {
    const projectTerminals = Array.from(this.terminals.values())
      .filter(terminal => terminal.projectId === projectId);

    projectTerminals.forEach(terminal => {
      this.destroyTerminal(terminal.sessionId);
    });

    console.log(`[TerminalManager] Destroyed ${projectTerminals.length} terminals for project ${projectId}`);
  }

  /**
   * Get information about a terminal session
   * @param {string} sessionId - Terminal session ID
   * @returns {Object|null} Terminal info or null if not found
   */
  getTerminalInfo(sessionId) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal) {
      return null;
    }

    return {
      sessionId: terminal.sessionId,
      projectId: terminal.projectId,
      projectPath: terminal.projectPath,
      cols: terminal.cols,
      rows: terminal.rows,
      createdAt: terminal.createdAt,
      isAlive: !terminal.ptyProcess.killed
    };
  }

  /**
   * Get all active terminal sessions
   * @returns {Array} Array of terminal info objects
   */
  getAllTerminals() {
    return Array.from(this.terminals.values()).map(terminal => ({
      sessionId: terminal.sessionId,
      projectId: terminal.projectId,
      projectPath: terminal.projectPath,
      cols: terminal.cols,
      rows: terminal.rows,
      createdAt: terminal.createdAt,
      isAlive: !terminal.ptyProcess.killed
    }));
  }

  /**
   * Get terminals for a specific project
   * @param {string} projectId - Project ID
   * @returns {Array} Array of terminal info objects
   */
  getProjectTerminals(projectId) {
    return this.getAllTerminals().filter(terminal => terminal.projectId === projectId);
  }

  /**
   * Get the default shell for the current platform
   * @returns {string} Shell path/command
   */
  getDefaultShell() {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        return process.env.SHELL || 'powershell.exe';
      case 'darwin':
      case 'linux':
        return process.env.SHELL || '/bin/bash';
      default:
        return process.env.SHELL || '/bin/sh';
    }
  }

  /**
   * Expand tilde (~) in path to full home directory path
   * @param {string} filePath - Path that may contain tilde
   * @returns {string} Expanded path
   */
  expandPath(filePath) {
    if (!filePath) return filePath;
    
    // Handle tilde expansion
    if (filePath.startsWith('~/')) {
      const homedir = os.homedir();
      return filePath.replace('~', homedir);
    }
    
    return filePath;
  }

  /**
   * Clean up all terminals on shutdown
   */
  cleanup() {
    console.log(`[TerminalManager] Cleaning up ${this.terminals.size} terminals...`);
    
    const terminalIds = Array.from(this.terminals.keys());
    terminalIds.forEach(sessionId => {
      this.destroyTerminal(sessionId);
    });

    this.removeAllListeners();
  }

  /**
   * Get statistics about terminal usage
   * @returns {Object} Terminal statistics
   */
  getStats() {
    const terminals = this.getAllTerminals();
    const aliveCount = terminals.filter(t => t.isAlive).length;
    const projects = new Set(terminals.map(t => t.projectId));

    return {
      total: terminals.length,
      alive: aliveCount,
      dead: terminals.length - aliveCount,
      projects: projects.size,
      sessions: terminals.map(t => ({
        sessionId: t.sessionId,
        projectId: t.projectId,
        isAlive: t.isAlive,
        createdAt: t.createdAt
      }))
    };
  }
}

// Singleton instance
let terminalManager = null;

/**
 * Get the singleton terminal manager instance
 * @returns {TerminalManager} Terminal manager instance
 */
export function getTerminalManager() {
  if (!terminalManager) {
    terminalManager = new TerminalManager();
  }
  return terminalManager;
}

/**
 * Clean up terminal manager on app shutdown
 */
export function cleanupTerminalManager() {
  if (terminalManager) {
    terminalManager.cleanup();
    terminalManager = null;
  }
}