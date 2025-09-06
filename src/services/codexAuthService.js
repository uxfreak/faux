import { spawn } from 'child_process';
import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Simple Codex Authentication Service
 * 
 * Handles authentication with OpenAI Codex using browser-based OAuth flow.
 * This is a simplified version focused on the MCP integration.
 */
class CodexAuthService {
  constructor() {
    this.authWindow = null;
    this.loginProcess = null;
  }

  /**
   * Save authentication state to persistent storage
   */
  saveAuthState(authenticated, method = 'chatgpt') {
    try {
      const userDataPath = app ? app.getPath('userData') : path.join(os.homedir(), '.config', 'faux-app');
      
      // Ensure directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      const authStatePath = path.join(userDataPath, 'codex-auth-state.json');
      
      const authState = {
        authenticated,
        method,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(authStatePath, JSON.stringify(authState, null, 2));
      console.log('💾 Codex auth state saved:', authState);
    } catch (error) {
      console.error('❌ Error saving Codex auth state:', error);
    }
  }

  /**
   * Check current authentication status
   */
  async checkAuthStatus() {
    try {
      // Check stored auth state
      const userDataPath = app ? app.getPath('userData') : path.join(os.homedir(), '.config', 'faux-app');
      const authStatePath = path.join(userDataPath, 'codex-auth-state.json');
      
      if (fs.existsSync(authStatePath)) {
        const authState = JSON.parse(fs.readFileSync(authStatePath, 'utf8'));
        if (authState && authState.authenticated) {
          console.log('✅ Found valid Codex auth state');
          return { authenticated: true, method: authState.method || 'chatgpt' };
        }
      }
    } catch (error) {
      console.error('⚠️ Error checking Codex auth state:', error);
    }
    
    return { authenticated: false };
  }

  /**
   * Authenticate with ChatGPT OAuth
   * 
   * This launches the `codex login` command which opens a browser window
   * for OAuth authentication with OpenAI.
   */
  async authenticateWithChatGPT(parentWindow) {
    return new Promise((resolve, reject) => {
      // Check if already authenticated
      this.checkAuthStatus().then(status => {
        if (status.authenticated) {
          resolve({ success: true, method: status.method });
          return;
        }

        console.log('🔐 Starting Codex authentication...');

        // Start the login process
        this.loginProcess = spawn('codex', ['login']);
        let authUrl = null;
        let loginComplete = false;
        let outputBuffer = '';

        this.loginProcess.stdout.on('data', (data) => {
          const output = data.toString();
          outputBuffer += output;
          console.log('📤 Codex login output:', output);

          // Look for the auth URL
          if (!authUrl && (output.includes('localhost:') || output.includes('auth.openai.com'))) {
            // Extract auth URL from output
            const urlMatch = output.match(/(https?:\/\/[^\s\n]+)/);
            if (urlMatch) {
              authUrl = urlMatch[1];
              console.log('🌐 Opening auth URL:', authUrl);
              this.openAuthWindow(authUrl, parentWindow);
            }
          }

          // Check for success message
          if (output.includes('Successfully logged in') || output.includes('Login successful')) {
            loginComplete = true;
            console.log('✅ Codex login successful');
            if (this.authWindow && !this.authWindow.isDestroyed()) {
              this.authWindow.close();
            }
          }
        });

        this.loginProcess.stderr.on('data', (data) => {
          const output = data.toString();
          outputBuffer += output;
          console.log('📤 Codex login stderr:', output);
          
          // Check for success message in stderr too
          if (output.includes('Successfully logged in') || output.includes('Login successful')) {
            loginComplete = true;
            console.log('✅ Codex login successful (from stderr)');
            if (this.authWindow && !this.authWindow.isDestroyed()) {
              this.authWindow.close();
            }
          }
        });

        this.loginProcess.on('error', (error) => {
          console.error('❌ Failed to start codex login:', error);
          reject(new Error(`Failed to start authentication: ${error.message}`));
        });

        this.loginProcess.on('close', (code) => {
          console.log(`🔐 Codex login process closed with code ${code}`);
          
          if (loginComplete || code === 0) {
            // Authentication was successful
            this.saveAuthState(true, 'chatgpt');
            resolve({ success: true, method: 'chatgpt' });
          } else {
            reject(new Error(`Authentication process exited with code ${code}`));
          }
        });

        // Timeout after 2 minutes
        setTimeout(() => {
          if (!loginComplete) {
            this.cleanup();
            reject(new Error('Authentication timed out'));
          }
        }, 120000);
      });
    });
  }

  /**
   * Open authentication window
   */
  openAuthWindow(authUrl, parentWindow) {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.focus();
      return;
    }

    this.authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      },
      parent: parentWindow,
      modal: true,
      title: 'Authenticate with OpenAI',
      show: false
    });

    // Load the auth URL
    this.authWindow.loadURL(authUrl);

    // Show window after it's ready
    this.authWindow.once('ready-to-show', () => {
      this.authWindow.show();
    });

    // Listen for successful authentication
    this.authWindow.webContents.on('did-navigate', (event, url) => {
      console.log('🌐 Auth window navigated to:', url);
      
      // Check if we've reached a success page
      if (url.includes('callback') || url.includes('success') || url.includes('complete')) {
        console.log('✅ Authentication callback detected');
        setTimeout(() => {
          if (this.authWindow && !this.authWindow.isDestroyed()) {
            this.authWindow.close();
          }
        }, 1500);
      }
    });

    // Handle window close
    this.authWindow.on('closed', () => {
      this.authWindow = null;
    });

    // Handle load errors
    this.authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Auth window failed to load:', errorCode, errorDescription);
    });
  }

  /**
   * Logout from codex
   */
  async logout() {
    return new Promise((resolve, reject) => {
      const logoutProcess = spawn('codex', ['logout']);
      let output = '';

      logoutProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      logoutProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      logoutProcess.on('close', (code) => {
        if (code === 0 || output.includes('logged out') || output.includes('Not logged in')) {
          this.saveAuthState(false, null);
          resolve({ success: true });
        } else {
          reject(new Error(`Logout failed with code ${code}`));
        }
      });

      logoutProcess.on('error', (error) => {
        console.error('❌ Logout error:', error);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        logoutProcess.kill();
        this.saveAuthState(false, null); // Force logged out state
        resolve({ success: true });
      }, 10000);
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
      this.authWindow = null;
    }
    if (this.loginProcess) {
      this.loginProcess.kill();
      this.loginProcess = null;
    }
  }
}

// Export singleton instance
export const codexAuthService = new CodexAuthService();
export default codexAuthService;