import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  pipe, 
  compose, 
  curry,
  isPortAvailable,
  findAvailablePort,
  createServerManager,
  createServerKey,
  parseServerKey,
  ServerInfo,
  handleServerError,
  ServerError,
  fileExists,
  directoryExists,
  readFile,
  writeFile,
  createViteServer,
  createStorybookServer,
  startProjectServers,
  stopServer,
  isServerHealthy
} from '../services/serverUtils';

// Mock net module
const mockServer = {
  listen: vi.fn(),
  close: vi.fn(),
  on: vi.fn()
};

vi.mock('net', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createServer: vi.fn(() => mockServer)
  };
});

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
  };
});

// Mock child_process
const mockChildProcess = {
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  kill: vi.fn(),
  killed: false,
  pid: 12345
};

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn(() => mockChildProcess),
    exec: vi.fn()
  };
});

// Mock util
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promisify: vi.fn((fn) => vi.fn().mockResolvedValue({ stdout: '', stderr: '' }))
  };
});

// Mock global fetch for health checks
global.fetch = vi.fn();

describe('Functional Utilities', () => {
  describe('pipe', () => {
    it('should pipe functions left to right', () => {
      const add1 = (x: number) => x + 1;
      const multiply2 = (x: number) => x * 2;
      const subtract3 = (x: number) => x - 3;
      
      const pipeline = pipe(add1, multiply2, subtract3);
      const result = pipeline(5); // (5 + 1) * 2 - 3 = 9
      
      expect(result).toBe(9);
    });
    
    it('should handle single function', () => {
      const double = (x: number) => x * 2;
      const pipeline = pipe(double);
      
      expect(pipeline(5)).toBe(10);
    });
  });

  describe('compose', () => {
    it('should compose functions right to left', () => {
      const add1 = (x: number) => x + 1;
      const multiply2 = (x: number) => x * 2;
      const subtract3 = (x: number) => x - 3;
      
      const composition = compose(subtract3, multiply2, add1);
      const result = composition(5); // ((5 + 1) * 2) - 3 = 9
      
      expect(result).toBe(9);
    });
  });

  describe('curry', () => {
    it('should curry a function', () => {
      const add = (a: number, b: number, c: number) => a + b + c;
      const curriedAdd = curry(add);
      
      expect(curriedAdd(1)(2)(3)).toBe(6);
      expect(curriedAdd(1, 2)(3)).toBe(6);
      expect(curriedAdd(1, 2, 3)).toBe(6);
    });
  });
});

describe('Port Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPortAvailable', () => {
    it('should return true for available port', async () => {
      // Mock successful port listen
      mockServer.listen.mockImplementation((port, callback) => {
        setTimeout(() => callback(), 0);
      });
      mockServer.close.mockImplementation((callback) => {
        setTimeout(() => callback(), 0);
      });
      
      // Ensure createServer returns our mock
      const net = await import('net');
      vi.mocked(net.createServer).mockReturnValue(mockServer as any);

      const result = await isPortAvailable(3000);
      expect(result).toBe(true);
      expect(net.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it('should return false for occupied port', async () => {
      // Mock port listen error
      mockServer.listen.mockImplementation((port, callback) => {
        // Don't call callback, simulate port busy
      });
      mockServer.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('EADDRINUSE')), 0);
        }
      });
      
      // Ensure createServer returns our mock
      const net = await import('net');
      vi.mocked(net.createServer).mockReturnValue(mockServer as any);

      const result = await isPortAvailable(80);
      expect(result).toBe(false);
    });
  });

  describe('findAvailablePort', () => {
    it('should find first available port', async () => {
      let callCount = 0;
      const net = await import('net');
      
      // Create a fresh mock for each call
      vi.mocked(net.createServer).mockImplementation(() => {
        callCount++;
        const serverMock = {
          listen: vi.fn((port, callback) => {
            if (callCount === 1) {
              // First call (port 3000) - simulate occupied, don't call callback
            } else {
              // Second call (port 3001) - simulate available
              setTimeout(() => callback(), 0);
            }
          }),
          close: vi.fn((callback) => {
            setTimeout(() => callback(), 0);
          }),
          on: vi.fn((event, callback) => {
            if (event === 'error' && callCount === 1) {
              setTimeout(() => callback(new Error('EADDRINUSE')), 0);
            }
          })
        };
        return serverMock as any;
      });

      const port = await findAvailablePort(3000, 5);
      expect(port).toBe(3001);
    });

    it('should throw error when no ports available', async () => {
      const net = await import('net');
      
      // Mock all ports as occupied
      vi.mocked(net.createServer).mockImplementation(() => {
        const serverMock = {
          listen: vi.fn(() => {
            // Never call callback - simulate all ports busy
          }),
          close: vi.fn((callback) => {
            setTimeout(() => callback(), 0);
          }),
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('EADDRINUSE')), 0);
            }
          })
        };
        return serverMock as any;
      });

      await expect(findAvailablePort(3000, 3))
        .rejects
        .toThrow('No available port found starting from 3000');
    });
  });
});

describe('Server Manager', () => {
  let manager: ReturnType<typeof createServerManager>;
  let mockServer: ServerInfo;

  beforeEach(() => {
    manager = createServerManager();
    mockServer = {
      name: 'Test Server',
      url: 'http://localhost:3000',
      port: 3000,
      process: {} as any,
      status: 'running'
    };
  });

  it('should create empty server manager', () => {
    expect(manager.servers.size).toBe(0);
  });

  it('should add server', () => {
    const newManager = manager.addServer('test', mockServer);
    expect(newManager.servers.get('test')).toEqual(mockServer);
    expect(newManager.servers.size).toBe(1);
  });

  it('should maintain immutability when adding server', () => {
    const newManager = manager.addServer('test', mockServer);
    expect(manager.servers.size).toBe(0);
    expect(newManager.servers.size).toBe(1);
  });

  it('should get server', () => {
    const newManager = manager.addServer('test', mockServer);
    expect(newManager.getServer('test')).toEqual(mockServer);
    expect(newManager.getServer('nonexistent')).toBeUndefined();
  });

  it('should update server', () => {
    const newManager = manager
      .addServer('test', mockServer)
      .updateServer('test', { status: 'stopped' });
    
    const updatedServer = newManager.getServer('test');
    expect(updatedServer?.status).toBe('stopped');
    expect(updatedServer?.name).toBe('Test Server'); // Other properties preserved
  });

  it('should remove server', () => {
    const newManager = manager
      .addServer('test', mockServer)
      .removeServer('test');
    
    expect(newManager.getServer('test')).toBeUndefined();
    expect(newManager.servers.size).toBe(0);
  });
});

describe('Utility Functions', () => {
  describe('createServerKey', () => {
    it('should create server key', () => {
      expect(createServerKey('project-123', 'vite')).toBe('project-123-vite');
      expect(createServerKey('my-app', 'storybook')).toBe('my-app-storybook');
    });
  });

  describe('parseServerKey', () => {
    it('should parse server key', () => {
      expect(parseServerKey('project123-vite')).toEqual({
        projectId: 'project123',
        serverType: 'vite'
      });
      
      expect(parseServerKey('myapp-storybook')).toEqual({
        projectId: 'myapp',
        serverType: 'storybook'
      });
    });
  });
});

describe('Error Handling', () => {
  describe('ServerError', () => {
    it('should create server error', () => {
      const error = new ServerError('Test error', 'Vite', 3000);
      
      expect(error.message).toBe('Test error');
      expect(error.serverName).toBe('Vite');
      expect(error.port).toBe(3000);
      expect(error.name).toBe('ServerError');
    });
  });

  describe('handleServerError', () => {
    it('should handle server error', () => {
      const originalError = new Error('Original error');
      const handleError = handleServerError('Vite');
      const serverError = handleError(originalError);
      
      expect(serverError).toBeInstanceOf(ServerError);
      expect(serverError.serverName).toBe('Vite');
      expect(serverError.cause).toBe(originalError);
    });
  });
});

describe('File System Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      const result = await fileExists('/test/file.txt');
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false when file does not exist', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      
      const result = await fileExists('/test/nonexistent.txt');
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const fs = await import('fs/promises');
      const mockContent = 'file content';
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      
      const result = await readFile('/test/file.txt');
      expect(result).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf8');
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const writeFileFn = writeFile('/test/file.txt');
      await writeFileFn('test content');
      
      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'test content', 'utf8');
    });
  });
});

describe('Server Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChildProcess.stdout.on.mockClear();
    mockChildProcess.stderr.on.mockClear();
    mockChildProcess.on.mockClear();
  });

  describe('createViteServer', () => {
    it('should create Vite server successfully', async () => {
      const childProcess = await import('child_process');
      vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any);
      
      // Mock successful server start
      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Local: http://localhost:3000')), 10);
        }
      });

      const createServer = createViteServer('/test/project', 3000);
      const promise = createServer();
      
      expect(vi.mocked(childProcess.spawn)).toHaveBeenCalledWith(
        'npm', 
        ['run', 'dev', '--', '--port', '3000'],
        { cwd: '/test/project', stdio: 'pipe', detached: false }
      );

      const server = await promise;
      expect(server.name).toBe('Vite');
      expect(server.port).toBe(3000);
      expect(server.url).toBe('http://localhost:3000');
      expect(server.status).toBe('running');
    });

    it('should handle Vite server start failure', async () => {
      const childProcess = await import('child_process');
      vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any);
      
      // Mock server error
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      const createServer = createViteServer('/test/project', 3000);
      await expect(createServer()).rejects.toThrow('Vite server exited with code 1');
    });

    it('should handle Vite server timeout', async () => {
      const childProcess = await import('child_process');
      vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any);
      
      // Don't emit any success events - should timeout
      mockChildProcess.stdout.on.mockImplementation(() => {});
      
      const createServer = createViteServer('/test/project', 3000);
      await expect(createServer()).rejects.toThrow('Vite server failed to start within timeout');
    });
  });

  describe('createStorybookServer', () => {
    it('should create Storybook server successfully', async () => {
      const childProcess = await import('child_process');
      vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any);
      
      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Storybook started')), 10);
        }
      });

      const createServer = createStorybookServer('/test/project', 6006);
      const promise = createServer();
      
      expect(vi.mocked(childProcess.spawn)).toHaveBeenCalledWith(
        'npm', 
        ['run', 'storybook', '--', '--port', '6006', '--quiet'],
        { cwd: '/test/project', stdio: 'pipe', detached: false }
      );

      const server = await promise;
      expect(server.name).toBe('Storybook');
      expect(server.port).toBe(6006);
      expect(server.status).toBe('running');
    });
  });
});

describe('Server Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stopServer', () => {
    it('should stop server gracefully', async () => {
      const mockServerInfo: ServerInfo = {
        name: 'Test Server',
        url: 'http://localhost:3000',
        port: 3000,
        process: mockChildProcess as any,
        status: 'running'
      };

      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(callback, 10);
        }
      });

      await stopServer(mockServerInfo);
      
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should force kill server if not responding', async () => {
      const mockServerInfo: ServerInfo = {
        name: 'Test Server',
        url: 'http://localhost:3000',
        port: 3000,
        process: mockChildProcess as any,
        status: 'running'
      };

      mockChildProcess.on.mockImplementation(() => {
        // Don't call close callback - simulate hanging process
      });

      // Use shorter timeout for testing
      const stopPromise = stopServer(mockServerInfo);
      
      // Wait for force kill timeout (shorter for testing)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Complete the promise to avoid timeout
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(), 0);
        }
      });
    }, 1000);
  });

  describe('isServerHealthy', () => {
    it('should return true for healthy server', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true
      } as Response);

      const mockServerInfo: ServerInfo = {
        name: 'Test Server',
        url: 'http://localhost:3000',
        port: 3000,
        process: mockChildProcess as any,
        status: 'running'
      };

      const result = await isServerHealthy(mockServerInfo);
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000', {
        method: 'HEAD',
        signal: expect.any(AbortSignal)
      });
    });

    it('should return false for unhealthy server', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Connection refused'));

      const mockServerInfo: ServerInfo = {
        name: 'Test Server',
        url: 'http://localhost:3000',
        port: 3000,
        process: mockChildProcess as any,
        status: 'running'
      };

      const result = await isServerHealthy(mockServerInfo);
      expect(result).toBe(false);
    });
  });
});

describe('Project Server Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startProjectServers', () => {
    it('should start both Vite and Storybook servers', async () => {
      const net = await import('net');
      const childProcess = await import('child_process');
      
      // Mock port finding
      vi.mocked(net.createServer).mockImplementation(() => {
        const serverMock = {
          listen: vi.fn((port, callback) => setTimeout(() => callback(), 0)),
          close: vi.fn((callback) => setTimeout(() => callback(), 0)),
          on: vi.fn()
        };
        return serverMock as any;
      });
      
      // Mock child process spawn
      vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any);

      // Mock successful server starts
      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Local: http://localhost:5173')), 10);
        }
      });

      const projectConfig = {
        id: 'test-project',
        name: 'Test Project',
        path: '/test/project'
      };

      const servers = await startProjectServers(projectConfig);
      
      expect(servers.viteServer.name).toBe('Vite');
      expect(servers.storybookServer.name).toBe('Storybook');
      
      expect(vi.mocked(childProcess.spawn)).toHaveBeenCalledTimes(2);
    });
  });
});