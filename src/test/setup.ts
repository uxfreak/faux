import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron APIs
global.window.electronAPI = {
  getProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  startServer: vi.fn(),
  stopServer: vi.fn(),
  getServerStatus: vi.fn(),
};

// Mock CSS custom properties for tests
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: (prop: string) => {
      const mockValues: Record<string, string> = {
        '--color-text-primary': '#000000',
        '--color-text-secondary': '#666666',
        '--color-bg-primary': '#ffffff',
        '--color-bg-secondary': '#f8f9fa',
        '--color-action-primary': '#007bff',
        '--color-border-secondary': '#e9ecef',
      };
      return mockValues[prop] || '';
    },
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));