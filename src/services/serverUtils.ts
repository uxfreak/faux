import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// === Pure Functional Utilities ===

export const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T): T => 
  fns.reduce((acc, fn) => fn(acc), value);

export const compose = <T>(...fns: Array<(arg: T) => T>) => (value: T): T => 
  fns.reduceRight((acc, fn) => fn(acc), value);

export const curry = <T extends any[], R>(fn: (...args: T) => R) => 
  (...args: Partial<T>): any => 
    args.length >= fn.length ? fn(...args as T) : curry(fn.bind(null, ...args));

// === Types ===

export interface ServerInfo {
  name: string;
  url: string;
  port: number;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
  pid?: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  vitePort?: number;
  storybookPort?: number;
}

export interface ServerManager {
  servers: Map<string, ServerInfo>;
  getServer: (key: string) => ServerInfo | undefined;
  addServer: (key: string, server: ServerInfo) => ServerManager;
  removeServer: (key: string) => ServerManager;
  updateServer: (key: string, updates: Partial<ServerInfo>) => ServerManager;
}

// === Port Management ===

export const isPortAvailable = (port: number): Promise<boolean> => 
  new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });

export const findAvailablePort = async (startPort = 3000, maxAttempts = 100): Promise<number> => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
};

export const findAvailablePorts = async (count: number, startPort = 3000): Promise<number[]> => {
  const ports: number[] = [];
  let currentPort = startPort;
  
  while (ports.length < count) {
    const port = await findAvailablePort(currentPort);
    ports.push(port);
    currentPort = port + 1;
  }
  
  return ports;
};

// === File System Utilities ===

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const directoryExists = fileExists;

export const readFile = (filePath: string) => fs.readFile(filePath, 'utf8');

export const writeFile = curry((filePath: string, content: string) => 
  fs.writeFile(filePath, content, 'utf8')
);

export const createDirectory = (dirPath: string) => 
  fs.mkdir(dirPath, { recursive: true });

// === Server Manager ===

export const createServerManager = (): ServerManager => ({
  servers: new Map(),
  
  getServer(key: string) {
    return this.servers.get(key);
  },
  
  addServer(key: string, server: ServerInfo) {
    const newServers = new Map(this.servers);
    newServers.set(key, server);
    return { ...this, servers: newServers };
  },
  
  removeServer(key: string) {
    const newServers = new Map(this.servers);
    newServers.delete(key);
    return { ...this, servers: newServers };
  },
  
  updateServer(key: string, updates: Partial<ServerInfo>) {
    const server = this.servers.get(key);
    if (!server) return this;
    
    const newServers = new Map(this.servers);
    newServers.set(key, { ...server, ...updates });
    return { ...this, servers: newServers };
  }
});

// === Server Creation Functions ===

export const createViteServer = curry((projectPath: string, port: number) => (): Promise<ServerInfo> => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
      cwd: projectPath,
      stdio: 'pipe',
      detached: false
    });

    let output = '';
    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Vite server failed to start within timeout'));
    }, 30000);

    const server: ServerInfo = {
      name: 'Vite',
      url: `http://localhost:${port}`,
      port,
      process: serverProcess,
      status: 'starting',
      pid: serverProcess.pid
    };

    serverProcess.stdout?.on('data', (data) => {
      output += data.toString();
      
      if (output.includes('Local:') && output.includes(`localhost:${port}`)) {
        clearTimeout(timeout);
        const updatedServer = { ...server, status: 'running' as const };
        resolve(updatedServer);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('warn')) {
        console.error('Vite error:', error);
      }
    });

    serverProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Vite server exited with code ${code}`));
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
});

export const createStorybookServer = curry((projectPath: string, port: number) => (): Promise<ServerInfo> => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npm', ['run', 'storybook', '--', '--port', port.toString(), '--quiet'], {
      cwd: projectPath,
      stdio: 'pipe',
      detached: false
    });

    let output = '';
    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Storybook server failed to start within timeout'));
    }, 45000); // Storybook takes longer

    const server: ServerInfo = {
      name: 'Storybook',
      url: `http://localhost:${port}`,
      port,
      process: serverProcess,
      status: 'starting',
      pid: serverProcess.pid
    };

    serverProcess.stdout?.on('data', (data) => {
      output += data.toString();
      
      if (output.includes('Storybook') && (output.includes('started') || output.includes('manager'))) {
        clearTimeout(timeout);
        const updatedServer = { ...server, status: 'running' as const };
        resolve(updatedServer);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('warn') && !error.includes('info')) {
        console.error('Storybook error:', error);
      }
    });

    serverProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Storybook server exited with code ${code}`));
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
});

// === Server Lifecycle Management ===

export const stopServer = (server: ServerInfo): Promise<void> => {
  return new Promise((resolve) => {
    if (server.process && !server.process.killed) {
      server.process.on('close', () => resolve());
      server.process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!server.process.killed) {
          server.process.kill('SIGKILL');
        }
      }, 5000);
    } else {
      resolve();
    }
  });
};

export const isServerHealthy = async (server: ServerInfo): Promise<boolean> => {
  try {
    const response = await fetch(server.url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const waitForServerHealth = async (server: ServerInfo, maxAttempts = 30): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerHealthy(server)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
};

// === Project Server Management ===

export const startProjectServers = async (project: ProjectConfig): Promise<{
  viteServer: ServerInfo;
  storybookServer: ServerInfo;
}> => {
  const [vitePort, storybookPort] = await findAvailablePorts(2, 5173);
  
  const [viteServer, storybookServer] = await Promise.all([
    createViteServer(project.path, vitePort)(),
    createStorybookServer(project.path, storybookPort)()
  ]);

  return { viteServer, storybookServer };
};

export const stopProjectServers = async (servers: { viteServer?: ServerInfo; storybookServer?: ServerInfo }): Promise<void> => {
  const stopPromises = [];
  
  if (servers.viteServer) {
    stopPromises.push(stopServer(servers.viteServer));
  }
  
  if (servers.storybookServer) {
    stopPromises.push(stopServer(servers.storybookServer));
  }
  
  await Promise.all(stopPromises);
};

// === Server Status Monitoring ===

export const getServerStatus = (server: ServerInfo): Promise<'running' | 'stopped' | 'error'> => {
  return new Promise((resolve) => {
    if (!server.process || server.process.killed) {
      resolve('stopped');
      return;
    }

    if (server.process.exitCode !== null) {
      resolve(server.process.exitCode === 0 ? 'stopped' : 'error');
      return;
    }

    // Check if process is actually running
    try {
      process.kill(server.pid!, 0);
      resolve('running');
    } catch {
      resolve('stopped');
    }
  });
};

// === Utility Functions ===

export const createServerKey = (projectId: string, serverType: 'vite' | 'storybook'): string => 
  `${projectId}-${serverType}`;

export const parseServerKey = (key: string): { projectId: string; serverType: 'vite' | 'storybook' } => {
  const [projectId, serverType] = key.split('-');
  return { projectId, serverType: serverType as 'vite' | 'storybook' };
};

// === Error Handling ===

export class ServerError extends Error {
  constructor(
    message: string,
    public serverName: string,
    public port?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ServerError';
  }
}

export const handleServerError = curry((serverName: string, error: Error) => {
  console.error(`Server error (${serverName}):`, error.message);
  return new ServerError(`Failed to manage ${serverName} server`, serverName, undefined, error);
});