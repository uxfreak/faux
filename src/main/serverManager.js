import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { createServer as createNetServer, Socket } from 'net';
import { promisify } from 'util';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import { scaffoldProject } from './projectScaffold.js';
import getPort from 'get-port';
import { request } from 'http';
import { createServer as createViteServer } from 'vite';

const execAsync = promisify(exec);

// Track running servers by project ID
const runningServers = new Map();

// Helper functions using get-port library for reliable port detection
const checkServerReadyHTTP = (port, maxAttempts = 30, interval = 1000) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      const req = request({
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 3000
      }, (res) => {
        console.log(`HTTP check on port ${port} successful - status: ${res.statusCode}`);
        resolve(true);
      });
      
      req.on('error', (err) => {
        console.log(`HTTP check on port ${port} error:`, err.code);
        tryAgain();
      });
      
      req.on('timeout', () => {
        console.log(`HTTP check on port ${port} timed out`);
        req.abort();
        tryAgain();
      });
      
      req.end();
    };
    
    const tryAgain = () => {
      attempts++;
      if (attempts >= maxAttempts) {
        console.log(`HTTP server on port ${port} failed to become ready after ${maxAttempts} attempts`);
        reject(new Error(`HTTP server on port ${port} not ready after ${maxAttempts * interval}ms`));
        return;
      }
      
      console.log(`Checking HTTP server readiness on port ${port}, attempt ${attempts}/${maxAttempts}`);
      setTimeout(check, interval);
    };
    
    // Start checking
    check();
  });
};
const checkServerReady = (port, maxAttempts = 30, interval = 1000) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      const socket = new Socket();
      
      socket.setTimeout(5000); // Increase timeout to 5 seconds
      
      socket.on('connect', () => {
        socket.destroy();
        console.log(`Server on port ${port} is ready!`);
        resolve(true);
      });
      
      socket.on('timeout', () => {
        console.log(`TCP connection to port ${port} timed out`);
        socket.destroy();
        tryAgain();
      });
      
      socket.on('error', (err) => {
        console.log(`TCP connection to port ${port} error:`, err.code, err.message);
        socket.destroy();
        tryAgain();
      });
      
      socket.connect(port, '127.0.0.1');
    };
    
    const tryAgain = () => {
      attempts++;
      if (attempts >= maxAttempts) {
        console.log(`Server on port ${port} failed to become ready after ${maxAttempts} attempts`);
        reject(new Error(`Server on port ${port} not ready after ${maxAttempts * interval}ms`));
        return;
      }
      
      console.log(`Checking server readiness on port ${port}, attempt ${attempts}/${maxAttempts}`);
      setTimeout(check, interval);
    };
    
    // Start checking
    check();
  });
};

const createViteServerProgrammatic = async (projectPath, port) => {
  try {
    console.log(`Creating Vite server programmatically for ${projectPath} on port ${port}`);
    
    const server = await createViteServer({
      configFile: false,
      root: projectPath,
      server: {
        port: port,
        strictPort: true,
        host: '127.0.0.1'
      }
    });
    
    await server.listen();
    
    console.log(`Vite server ready on port ${port}!`);
    server.printUrls();
    
    return {
      name: 'Vite',
      url: `http://localhost:${port}`,
      port: port,
      server: server, // Store the actual server instance
      status: 'running'
    };
    
  } catch (error) {
    console.error('Failed to create Vite server:', error);
    throw error;
  }
};

const createViteServerSpawn = (projectPath, port) => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--strictPort'], {
      cwd: projectPath,
      stdio: 'pipe',
      detached: false
    });

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        serverProcess.kill();
        reject(new Error('Vite server failed to start within timeout'));
      }
    }, 30000); // 30 second timeout

    // Start HTTP readiness check for Vite (more reliable than TCP)
    checkServerReadyHTTP(port, 30, 1000).then(() => {
      if (!isResolved) {
        console.log(`Vite server confirmed ready on port ${port} via HTTP check!`);
        
        isResolved = true;
        clearTimeout(timeout);
        resolve({
          name: 'Vite',
          url: `http://localhost:${port}`,
          port: port,
          process: serverProcess,
          status: 'running'
        });
      }
    }).catch((error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        serverProcess.kill();
        reject(error);
      }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Vite stdout: ${output}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.log(`Vite stderr: ${data}`);
    });

    serverProcess.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(new Error(`Vite server exited with code ${code}`));
      }
    });

    serverProcess.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
};

const createStorybookServer = (projectPath, port) => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npm', ['run', 'storybook', '--', '--port', port.toString(), '--quiet', '--no-open'], {
      cwd: projectPath,
      stdio: 'pipe',
      detached: false
    });

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        serverProcess.kill();
        reject(new Error('Storybook server failed to start within timeout'));
      }
    }, 120000); // 120 second timeout for Storybook - can take time to build

    // Start TCP readiness check instead of parsing stdout  
    checkServerReady(port, 60, 2000).then(() => { // More attempts and longer interval for Storybook
      if (!isResolved) {
        console.log(`Storybook server confirmed ready on port ${port} via TCP check!`);
        
        isResolved = true;
        clearTimeout(timeout);
        resolve({
          name: 'Storybook',
          url: `http://localhost:${port}`,
          port: port,
          process: serverProcess,
          status: 'running'
        });
      }
    }).catch((error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        serverProcess.kill();
        reject(error);
      }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Storybook stdout: ${output}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.log(`Storybook stderr: ${data}`);
    });

    serverProcess.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(new Error(`Storybook server exited with code ${code}`));
      }
    });

    serverProcess.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
};

const stopServer = (serverInfo) => {
  return new Promise(async (resolve) => {
    if (!serverInfo) {
      resolve();
      return;
    }

    // Handle programmatic Vite server (has server property)
    if (serverInfo.server && typeof serverInfo.server.close === 'function') {
      try {
        console.log(`Closing programmatic server on port ${serverInfo.port}`);
        await serverInfo.server.close();
        resolve();
        return;
      } catch (error) {
        console.error('Error closing programmatic server:', error);
      }
    }

    // Handle spawned process servers (has process property)
    if (serverInfo.process) {
      const process = serverInfo.process;
      
      // Try graceful shutdown first
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not responding
      const forceKillTimeout = setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);

      process.on('close', () => {
        clearTimeout(forceKillTimeout);
        resolve();
      });
      return;
    }

    // If neither type, just resolve
    resolve();
  });
};

export const setupServerIPCHandlers = (mainWindow) => {
  // Start servers for a project
  ipcMain.handle('server:start', async (event, projectConfig) => {
    try {
      console.log('Starting servers for project:', projectConfig);
      
      // Stop any existing servers for this project
      if (runningServers.has(projectConfig.id)) {
        await stopProjectServers(projectConfig.id);
      }

      // Find available ports using get-port library for reliability
      console.log('Finding available ports...');
      const vitePort = await getPort({ port: 5174 }); // Start from 5174 to avoid main app's 5173
      const storybookPort = await getPort({ port: 6006 });
      
      console.log(`Found available ports - Vite: ${vitePort}, Storybook: ${storybookPort}`);

      // Start both servers - use programmatic Vite API and spawn for Storybook
      const [viteServer, storybookServer] = await Promise.all([
        createViteServerProgrammatic(projectConfig.path, vitePort),
        createStorybookServer(projectConfig.path, storybookPort)
      ]);

      // Store server references
      runningServers.set(projectConfig.id, {
        viteServer,
        storybookServer,
        isHealthy: true,
        error: null
      });

      // Send status update to renderer (only serializable data)
      mainWindow.webContents.send('server:status-update', {
        projectId: projectConfig.id,
        viteServer: {
          name: viteServer.name,
          url: viteServer.url,
          port: viteServer.port,
          status: viteServer.status
        },
        storybookServer: {
          name: storybookServer.name,
          url: storybookServer.url,
          port: storybookServer.port,
          status: storybookServer.status
        },
        isHealthy: true,
        error: null
      });

      console.log('Servers started successfully:', {
        vite: viteServer.url,
        storybook: storybookServer.url
      });

    } catch (error) {
      console.error('Failed to start servers:', error);
      
      // Send error to renderer
      mainWindow.webContents.send('server:error', {
        projectId: projectConfig.id,
        error: error.message
      });
      
      throw error;
    }
  });

  // Stop servers for a project
  ipcMain.handle('server:stop', async (event, projectId) => {
    try {
      await stopProjectServers(projectId);
      
      // Send status update to renderer
      mainWindow.webContents.send('server:status-update', {
        projectId,
        viteServer: null,
        storybookServer: null,
        isHealthy: false,
        error: null
      });
      
    } catch (error) {
      console.error('Failed to stop servers:', error);
      throw error;
    }
  });

  // Get server status for a project
  ipcMain.handle('server:status', async (event, projectId) => {
    const servers = runningServers.get(projectId);
    if (!servers) {
      return {
        projectId,
        viteServer: null,
        storybookServer: null,
        isHealthy: false,
        error: null
      };
    }

    return {
      projectId,
      viteServer: servers.viteServer ? {
        name: servers.viteServer.name,
        url: servers.viteServer.url,
        port: servers.viteServer.port,
        status: servers.viteServer.status
      } : null,
      storybookServer: servers.storybookServer ? {
        name: servers.storybookServer.name,
        url: servers.storybookServer.url,
        port: servers.storybookServer.port,
        status: servers.storybookServer.status
      } : null,
      isHealthy: servers.isHealthy,
      error: servers.error
    };
  });

  // Scaffold new project
  ipcMain.handle('project:scaffold', async (event, options) => {
    try {
      console.log('Scaffolding project:', options);
      
      const result = await scaffoldProject(options, (progress) => {
        // Send progress updates to renderer
        mainWindow.webContents.send('project:scaffold-progress', {
          projectName: options.projectName,
          ...progress
        });
      });

      console.log('Scaffolding result:', result);
      return result;
      
    } catch (error) {
      console.error('Failed to scaffold project:', error);
      throw error;
    }
  });

  console.log('Server IPC handlers setup complete');
};

// Helper function to stop all servers for a project
const stopProjectServers = async (projectId) => {
  const servers = runningServers.get(projectId);
  if (!servers) return;

  const promises = [];
  
  if (servers.viteServer) {
    promises.push(stopServer(servers.viteServer));
  }
  
  if (servers.storybookServer) {
    promises.push(stopServer(servers.storybookServer));
  }

  await Promise.all(promises);
  runningServers.delete(projectId);
  
  console.log('Stopped all servers for project:', projectId);
};

// Cleanup function to stop all servers on app quit
export const cleanupAllServers = async () => {
  console.log('Cleaning up all running servers...');
  const promises = [];
  
  for (const [projectId] of runningServers) {
    promises.push(stopProjectServers(projectId));
  }
  
  await Promise.all(promises);
  console.log('All servers stopped');
};