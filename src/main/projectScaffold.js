import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// File/folder exclusion patterns for project duplication
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
  'coverage',
  '.nyc_output',
  '.parcel-cache',
  '.nuxt',
  '.output',
  '.vercel',
  '.netlify',
  'tmp',
  'temp'
];

// Get the projects directory (~/faux-projects)
const getProjectsDirectory = () => {
  const homeDir = os.homedir();
  return path.join(homeDir, 'faux-projects');
};

// Check if directory exists
const directoryExists = async (dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

// Check if file exists
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// Create directory with parents
const createDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

// Read file content
const readFile = async (filePath) => {
  return await fs.readFile(filePath, 'utf8');
};

// Write file content
const writeFile = async (filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8');
};

// Validate project name
const validateProjectName = (name) => {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty';
  }
  
  if (name.length > 50) {
    return 'Project name must be 50 characters or less';
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Project name can only contain letters, numbers, hyphens, and underscores';
  }
  
  return null;
};

// Scaffold a new project with progress reporting
export const scaffoldProject = async (options, progressCallback) => {
  const { projectName, targetPath, skipExisting = false } = options;
  
  // Validate project name
  const nameError = validateProjectName(projectName);
  if (nameError) {
    return { success: false, error: nameError };
  }

  // Determine project path
  const projectPath = targetPath || path.join(getProjectsDirectory(), projectName);
  
  // Check if project already exists
  if (await directoryExists(projectPath) && !skipExisting) {
    return { success: false, error: 'Project already exists' };
  }

  // Initialize progress steps
  const steps = [
    { id: 'create', label: 'Creating Vite project', status: 'pending' },
    { id: 'install', label: 'Installing dependencies', status: 'pending' },
    { id: 'tailwind', label: 'Setting up Tailwind CSS', status: 'pending' },
    { id: 'storybook', label: 'Installing Storybook', status: 'pending' },
    { id: 'customize', label: 'Customizing templates', status: 'pending' },
    { id: 'finalize', label: 'Finalizing setup', status: 'pending' }
  ];

  let currentStepIndex = 0;
  const updateProgress = (status, error = null) => {
    if (currentStepIndex < steps.length) {
      steps[currentStepIndex].status = status;
    }
    const progress = Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100);
    if (progressCallback) {
      progressCallback({ steps: [...steps], progress, error, currentStep: currentStepIndex });
    }
  };

  try {
    // Ensure projects directory exists
    await createDirectory(getProjectsDirectory());

    // Step 1: Create Vite project
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    console.log(`Creating Vite project: ${projectName}`);
    await execAsync(`npm create vite@latest ${projectName} -- --template react-ts`, {
      cwd: getProjectsDirectory()
    });
    
    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
    updateProgress('completed');

    // Step 2: Install dependencies
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    console.log('Installing dependencies...');
    await execAsync('npm install', { cwd: projectPath });
    
    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
    updateProgress('completed');

    // Step 3: Setup Tailwind CSS
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    console.log('Setting up Tailwind CSS...');
    await execAsync('npm install -D tailwindcss @tailwindcss/postcss autoprefixer', { cwd: projectPath });
    
    // Create PostCSS configuration for Tailwind v4
    const postCssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}`;
    await writeFile(path.join(projectPath, 'postcss.config.js'), postCssConfig);
    
    // Update vite.config.ts with explicit PostCSS configuration for Tailwind v4
    const viteConfigPath = path.join(projectPath, 'vite.config.ts');
    if (await fileExists(viteConfigPath)) {
      const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
})`;
      await writeFile(viteConfigPath, viteConfig);
    }

    // Create Tailwind config
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
    await writeFile(path.join(projectPath, 'tailwind.config.js'), tailwindConfig);

    // Update src/index.css with Tailwind v4 import syntax
    const indexCssPath = path.join(projectPath, 'src', 'index.css');
    const indexCssContent = `@import "tailwindcss";

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}`;
    await writeFile(indexCssPath, indexCssContent);

    // Update App.tsx with Tailwind example
    const appContent = `import React from 'react'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
            Faux Project
          </div>
          <h1 className="block mt-1 text-lg leading-tight font-medium text-black">
            ${projectName}
          </h1>
          <p className="mt-2 text-gray-500">
            Your Vite + React + TypeScript + Tailwind project is ready!
          </p>
          <div className="mt-4">
            <button className="bg-black hover:bg-black text-white font-bold py-2 px-4 rounded">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App`;
    await writeFile(path.join(projectPath, 'src', 'App.tsx'), appContent);

    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
    updateProgress('completed');

    // Step 4: Install Storybook
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    console.log('Installing Storybook...');
    
    // Use spawn for Storybook installation with CI=true to prevent auto-start
    await new Promise((resolve, reject) => {
      const storybookProcess = spawn('npx', ['storybook@latest', 'init', '--yes'], {
        cwd: projectPath,
        stdio: 'pipe',
        env: { 
          ...process.env, 
          CI: 'true' // Prevents auto-start after installation
        }
      });

      const timeout = setTimeout(() => {
        storybookProcess.kill();
        reject(new Error('Storybook installation timeout'));
      }, 120000); // 2 minute timeout

      storybookProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Storybook stdout: ${output}`);
        
        if (output.includes('Storybook was successfully installed')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      storybookProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Storybook installation failed with code ${code}`));
        }
      });

      storybookProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Update Storybook configuration for Tailwind integration (part of Storybook step)
    const storybookMainPath = path.join(projectPath, '.storybook', 'main.ts');
    if (await fileExists(storybookMainPath)) {
      const storybookMain = await readFile(storybookMainPath);
      
      // Add Tailwind plugin and unique cache directory
      const updatedStorybookMain = storybookMain.replace(
        /addons: \[([\s\S]*?)\]/,
        `addons: [
    $1,
    {
      name: '@storybook/addon-postcss',
      options: {
        postcssLoaderOptions: {},
      },
    },
  ]`
      ).replace(
        /viteFinal: async \(config\) => \{([\s\S]*?)return config;[\s]*\}/,
        `viteFinal: async (config) => {
    $1
    
    // Add unique cache directory for Storybook
    config.cacheDir = 'node_modules/.vite/storybook';
    
    return config;
  }`
      );
      
      await writeFile(storybookMainPath, updatedStorybookMain);
    }

    // Update Storybook preview configuration
    const storybookPreviewPath = path.join(projectPath, '.storybook', 'preview.ts');
    if (await fileExists(storybookPreviewPath)) {
      const storybookPreview = await readFile(storybookPreviewPath);
      
      // Add CSS import and layout parameter
      const updatedStorybookPreview = `import '../src/index.css';

${storybookPreview.replace(
        /export default \{([\s\S]*?)\};/,
        `export default {
  $1,
  parameters: {
    ...parameters,
    layout: 'fullscreen',
  },
};`
      )}`;
      
      await writeFile(storybookPreviewPath, updatedStorybookPreview);
    }

    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
    updateProgress('completed');

    // Step 5: Customize templates  
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    console.log('Customizing templates...');
    
    // Create a simple story for the App component
    const storyContent = `import type { Meta, StoryObj } from '@storybook/react';
import App from '../App';

const meta: Meta<typeof App> = {
  title: 'App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};`;

    const storiesDir = path.join(projectPath, 'src', 'stories');
    if (await directoryExists(storiesDir)) {
      await writeFile(path.join(storiesDir, 'App.stories.ts'), storyContent);
    }

    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
    updateProgress('completed');

    // Step 6: Finalize
    steps[currentStepIndex].status = 'active';
    updateProgress('active');
    
    // Update package.json scripts if needed
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await readFile(packageJsonPath));
      
      // Ensure proper scripts exist
      packageJson.scripts = {
        ...packageJson.scripts,
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build'
      };
      
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    steps[currentStepIndex].status = 'completed';
    updateProgress('completed');

    console.log(`Project ${projectName} scaffolded successfully at ${projectPath}`);
    
    // Add Claude MCP Figma integration in the background
    try {
      console.log('Setting up Claude MCP Figma integration...');
      execAsync('claude mcp add --transport sse figma-dev-mode-mcp-server http://127.0.0.1:3845/sse', {
        cwd: projectPath,
        timeout: 10000 // 10 second timeout
      }).then(() => {
        console.log('Claude MCP Figma integration added successfully');
      }).catch((error) => {
        console.log('Failed to add Claude MCP Figma integration (non-critical):', error.message);
      });
    } catch (error) {
      // Non-critical error, don't fail the scaffolding
      console.log('Claude MCP setup failed (non-critical):', error.message);
    }
    
    return {
      success: true,
      projectPath,
      steps,
      message: `Project ${projectName} created successfully!`
    };

  } catch (error) {
    console.error('Scaffolding error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    updateProgress('error', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      steps,
      projectPath
    };
  }
};

// Duplicate project files with smart exclusions
export const duplicateProjectFiles = async (sourcePath, destPath, progressCallback = null) => {
  console.log('Starting project file duplication...');
  console.log('Source:', sourcePath);
  console.log('Destination:', destPath);

  const updateProgress = (status, message, progress = 0) => {
    if (progressCallback) {
      progressCallback({
        status,
        message,
        progress,
        timestamp: Date.now()
      });
    }
    console.log(`[${status}] ${message} (${progress}%)`);
  };

  try {
    // Validate source exists
    if (!(await directoryExists(sourcePath))) {
      throw new Error(`Source project directory does not exist: ${sourcePath}`);
    }

    // Check if destination already exists
    if (await directoryExists(destPath)) {
      throw new Error(`Destination directory already exists: ${destPath}`);
    }

    updateProgress('info', 'Analyzing source project...', 5);

    // Get total size and file count for progress tracking
    const { totalSize, totalFiles } = await analyzeProjectSize(sourcePath);
    console.log(`Project analysis: ${totalFiles} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    updateProgress('info', `Copying ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)...`, 10);

    // Create destination directory
    await createDirectory(destPath);

    // Copy files with exclusions and progress tracking
    let copiedSize = 0;
    await copyDirectoryRecursive(sourcePath, destPath, (fileSize) => {
      copiedSize += fileSize;
      const progress = Math.min(90, 10 + (copiedSize / totalSize) * 70); // 10-80% for copying
      updateProgress('info', 'Copying files...', Math.floor(progress));
    });

    updateProgress('info', 'Updating project configuration...', 85);

    // Update package.json with new project name
    await updateProjectConfig(destPath, path.basename(destPath));

    updateProgress('info', 'Installing dependencies...', 90);

    // Install dependencies in the duplicated project
    try {
      await execAsync('npm install', { cwd: destPath });
      console.log('Dependencies installed successfully in duplicated project');
    } catch (installError) {
      console.warn('Failed to install dependencies (non-critical):', installError.message);
      // Continue without failing the duplication
    }

    updateProgress('success', 'Project duplicated successfully!', 100);

    return {
      success: true,
      sourcePath,
      destPath,
      totalFiles,
      totalSize
    };

  } catch (error) {
    console.error('Failed to duplicate project files:', error);
    
    // Cleanup on failure
    try {
      if (await directoryExists(destPath)) {
        updateProgress('info', 'Cleaning up failed duplication...', 0);
        await fs.rm(destPath, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup after duplication error:', cleanupError);
    }

    updateProgress('error', error.message, 0);
    
    return {
      success: false,
      error: error.message,
      sourcePath,
      destPath
    };
  }
};

// Analyze project size for progress tracking
const analyzeProjectSize = async (dirPath) => {
  let totalSize = 0;
  let totalFiles = 0;

  const analyzeRecursive = async (currentPath) => {
    const items = await fs.readdir(currentPath);
    
    for (const item of items) {
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.includes(item)) {
        continue;
      }

      const itemPath = path.join(currentPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        await analyzeRecursive(itemPath);
      } else {
        totalSize += stats.size;
        totalFiles++;
      }
    }
  };

  await analyzeRecursive(dirPath);
  return { totalSize, totalFiles };
};

// Copy directory recursively with exclusions
const copyDirectoryRecursive = async (src, dest, progressCallback = null) => {
  const items = await fs.readdir(src);

  for (const item of items) {
    // Skip excluded patterns
    if (EXCLUDE_PATTERNS.includes(item)) {
      console.log('Skipping excluded item:', item);
      continue;
    }

    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stats = await fs.stat(srcPath);

    if (stats.isDirectory()) {
      // Create directory and recurse
      await createDirectory(destPath);
      await copyDirectoryRecursive(srcPath, destPath, progressCallback);
    } else {
      // Copy file
      await fs.copyFile(srcPath, destPath);
      if (progressCallback) {
        progressCallback(stats.size);
      }
    }
  }
};

// Update project configuration files
const updateProjectConfig = async (projectPath, newProjectName) => {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  try {
    if (await fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await readFile(packageJsonPath));
      
      // Update name field
      packageJson.name = newProjectName;
      
      // Remove any version/private fields that might conflict
      delete packageJson.version;
      
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('Updated package.json name to:', newProjectName);
    }
  } catch (error) {
    console.warn('Failed to update package.json:', error.message);
    // Non-critical error, continue
  }
};
